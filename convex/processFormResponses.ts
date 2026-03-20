import { internalAction, action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ── Token refresh helper ──────────────────────────────────────────────────────

async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  return res.json();
}

// ── Get valid access token (refreshes if needed) ──────────────────────────────

async function getValidToken(
  ctx: any,
  ownerId: string
): Promise<string | null> {
  const account = await ctx.runQuery(
    internal.googleAccounts.getByOwnerInternal,
    { ownerId }
  );
  if (!account) return null;

  if (Date.now() < account.expiresAt - 60_000) {
    return account.accessToken;
  }

  // Refresh
  const refreshed = await refreshGoogleToken(account.refreshToken);
  if (!refreshed.access_token) return null;

  await ctx.runMutation(internal.googleAccounts.updateTokenInternal, {
    ownerId,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  });

  return refreshed.access_token;
}

// ── Process a single connection ───────────────────────────────────────────────

export const pollConnection = internalAction({
  args: { connectionId: v.id("formConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(
      internal.formConnections.getByIdInternal,
      { id: args.connectionId }
    );
    if (!connection || !connection.isActive || !connection.googleFormId) return;

    const accessToken = await getValidToken(ctx, connection.ownerId);
    if (!accessToken) {
      console.error(
        `[pollConnection] No valid token for owner ${connection.ownerId}`
      );
      return;
    }

    // Get template
    const template = await ctx.runQuery(api.templates.getById, {
      id: connection.templateId,
    });
    if (!template) return;

    // Fetch responses from Google Forms API, filtered by lastPolledAt
    const filterParam = connection.lastPolledAt
      ? `timestamp >= ${new Date(connection.lastPolledAt).toISOString()}`
      : undefined;

    const url = new URL(
      `https://forms.googleapis.com/v1/forms/${connection.googleFormId}/responses`
    );
    if (filterParam) url.searchParams.set("filter", filterParam);

    const responsesRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!responsesRes.ok) {
      console.error(
        "[pollConnection] Forms API error:",
        await responsesRes.text()
      );
      return;
    }

    const { responses = [] } = await responsesRes.json();
    if (responses.length === 0) {
      await ctx.runMutation(internal.formConnections.updateLastPolledInternal, {
        id: args.connectionId,
        lastPolledAt: Date.now(),
      });
      return;
    }

    const questionMap: Record<string, string> =
      connection.googleQuestionMap ?? {};

    const convexSiteUrl = process.env.CONVEX_SITE_URL!;

    for (const response of responses) {
      const submittedAt = new Date(response.createTime).getTime();

      // Skip already processed (safety check)
      if (connection.lastPolledAt && submittedAt <= connection.lastPolledAt) {
        continue;
      }

      // Map answers → fieldValues using questionMap + fieldMappings
      const fieldValues: Record<string, string> = {};
      const answers: Record<string, any> = response.answers ?? {};

      for (const [questionId, answerData] of Object.entries(answers)) {
        const questionTitle = questionMap[questionId];
        if (!questionTitle) continue;
        const mapping = connection.fieldMappings.find(
          (m: any) => m.formQuestionTitle === questionTitle
        );
        if (!mapping) continue;
        const value =
          (answerData as any).textAnswers?.answers?.[0]?.value ?? "";
        fieldValues[mapping.templateFieldName] = value;
      }

      // Build filename
      const rowNumber = String(submittedAt).slice(-6);
      const filename = (connection.filenamePattern || `document_{{row_number}}`)
        .replace(/{{row_number}}/g, rowNumber)
        .replace(
          /{{(\w+)}}/g,
          (_: string, key: string) => fieldValues[key] ?? ""
        )
        .replace(/[<>:"/\\|?*]/g, "_");

      // Create submission record
      const submissionId = await ctx.runMutation(
        internal.formConnections.createSubmissionInternal,
        {
          connectionId: connection._id,
          templateId: connection.templateId,
          ownerId: connection.ownerId,
          respondentEmail: response.respondentEmail ?? undefined,
          fieldValues,
          filename,
          status: "pending",
          submittedAt,
        }
      );

      // Generate document
      try {
        const PizZip = (await import("pizzip")).default;
        const Docxtemplater = (await import("docxtemplater")).default;

        // Fetch template file
        const fileUrl = await ctx.storage.getUrl(
          template.storageId as Id<"_storage">
        );
        if (!fileUrl) throw new Error("Template file not found in storage");

        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) throw new Error("Failed to fetch template file");
        const buffer = await fileRes.arrayBuffer();

        // Build data object
        const data: Record<string, unknown> = {};
        for (const field of template.fields) {
          if (
            field.type === "condition" ||
            field.type === "condition_inverse"
          ) {
            data[field.name] = fieldValues[field.name] === "true";
          } else if (field.type === "loop") {
            data[field.name] = [];
          } else {
            data[field.name] = fieldValues[field.name] ?? "";
          }
        }

        const zip = new PizZip(buffer);
        const doc = new Docxtemplater(zip, {
          delimiters: { start: "{{", end: "}}" },
          paragraphLoop: true,
          linebreaks: true,
        });
        doc.render(data);

        const outBuffer: ArrayBuffer = doc
          .getZip()
          .generate({ type: "arraybuffer" });
        const outUint8 = new Uint8Array(outBuffer);

        // Upload generated doc
        const uploadUrl = await ctx.storage.generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          body: outUint8,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");

        const { storageId: newStorageId } = await uploadRes.json();
        const generatedFileUrl = `${convexSiteUrl}/getFile?storageId=${newStorageId}`;

        await ctx.runMutation(
          internal.formConnections.updateSubmissionInternal,
          {
            id: submissionId as Id<"formSubmissions">,
            storageId: newStorageId,
            fileUrl: generatedFileUrl,
            status: "generated",
          }
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[pollConnection] Generation error:", message);
        await ctx.runMutation(
          internal.formConnections.updateSubmissionInternal,
          {
            id: submissionId as Id<"formSubmissions">,
            status: "error",
            errorMessage: message,
          }
        );
      }
    }

    await ctx.runMutation(internal.formConnections.updateLastPolledInternal, {
      id: args.connectionId,
      lastPolledAt: Date.now(),
    });
  },
});

// ── Poll all active Google connections (called by cron) ───────────────────────

export const pollAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.runQuery(
      internal.formConnections.getAllGoogleConnectionsInternal
    );
    for (const conn of connections) {
      await ctx.runAction(internal.processFormResponses.pollConnection, {
        connectionId: conn._id,
      });
    }
  },
});

// ── Public action: "Sync Now" button ─────────────────────────────────────────

export const syncConnection = action({
  args: { connectionId: v.id("formConnections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify ownership
    const conn = await ctx.runQuery(internal.formConnections.getByIdInternal, {
      id: args.connectionId,
    });
    if (!conn || conn.ownerId !== identity.subject) {
      throw new Error("Connection not found");
    }

    await ctx.runAction(internal.processFormResponses.pollConnection, {
      connectionId: args.connectionId,
    });
  },
});
