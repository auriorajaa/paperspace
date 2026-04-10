/* eslint-disable @typescript-eslint/no-explicit-any */
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ── Token refresh helper ──────────────────────────────────────────────────────

async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token?: string;
  expires_in?: number;
  error?: string;
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
): Promise<{ token: string | null; error?: string }> {
  const account = await ctx.runQuery(
    internal.googleAccounts.getByOwnerInternal,
    { ownerId }
  );
  if (!account) return { token: null, error: "No Google account connected" };

  if (Date.now() < account.expiresAt - 60_000) {
    return { token: account.accessToken };
  }

  // Refresh
  const refreshed = await refreshGoogleToken(account.refreshToken);
  if (!refreshed.access_token) {
    const errMsg =
      refreshed.error === "invalid_grant"
        ? "Google token has been revoked. Please reconnect your Google account."
        : "Token refresh failed. Please reconnect your Google account.";
    return { token: null, error: errMsg };
  }

  await ctx.runMutation(internal.googleAccounts.updateTokenInternal, {
    ownerId,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
  });

  return { token: refreshed.access_token };
}

// ── Core document generation logic (shared by pollConnection and retrySubmission) ──

async function generateDocxFromTemplate(
  ctx: any,
  params: {
    submissionId: Id<"formSubmissions">;
    templateId: Id<"templates">;
    fieldValues: Record<string, string>;
    filename: string;
  }
): Promise<void> {
  const { submissionId, templateId, fieldValues } = params;
  const convexSiteUrl = process.env.CONVEX_SITE_URL!;

  const template = await ctx.runQuery(internal.templates.getByIdInternal, {
    id: templateId,
  });
  if (!template) throw new Error("Template not found");

  const PizZip = (await import("pizzip")).default;
  const Docxtemplater = (await import("docxtemplater")).default;
  const { preprocessTemplate } = await import("@/lib/template-preprocessor");

  const fileUrl = await ctx.storage.getUrl(
    template.storageId as Id<"_storage">
  );
  if (!fileUrl) throw new Error("Template file not found in storage");

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error("Failed to fetch template file");
  const rawBuffer = await fileRes.arrayBuffer();

  // Fix split XML runs — Word often breaks {{tag}} across multiple runs,
  // which makes docxtemplater fail to parse them. preprocessTemplate joins them back.
  const buffer = await preprocessTemplate(rawBuffer);

  // Build data object with correct type coercion
  const data: Record<string, unknown> = {};
  for (const field of template.fields) {
    if (field.type === "condition" || field.type === "condition_inverse") {
      // Case-insensitive comparison for boolean conditions
      data[field.name] = fieldValues[field.name]?.toLowerCase() === "true";
    } else if (field.type === "loop") {
      // Loop fields are not mappable from Google Forms — leave as empty array
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
    // Return empty string for any variable not present in data
    nullGetter: () => "",
  });
  try {
    doc.render(data);
  } catch (err: any) {
    // Extract human-readable message from docxtemplater multi-error
    if (err?.properties?.errors?.length) {
      const details = (err.properties.errors as any[])
        .map((e: any) => e?.properties?.explanation ?? e?.message ?? String(e))
        .join("; ");
      throw new Error(`Template render failed: ${details}`);
    }
    throw err;
  }

  const outBuffer: ArrayBuffer = doc.getZip().generate({ type: "arraybuffer" });
  const outUint8 = new Uint8Array(outBuffer);

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

  await ctx.runMutation(internal.formConnections.updateSubmissionInternal, {
    id: submissionId,
    storageId: newStorageId,
    fileUrl: generatedFileUrl,
    status: "generated",
  });
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

    const { token: accessToken, error: tokenError } = await getValidToken(
      ctx,
      connection.ownerId
    );
    if (!accessToken) {
      console.error(
        `[pollConnection] Token error for owner ${connection.ownerId}: ${tokenError}`
      );
      // Mark connection as inactive so UI can surface the error
      await ctx.runMutation(internal.formConnections.updateLastPolledInternal, {
        id: args.connectionId,
        lastPolledAt: Date.now(),
      });
      return;
    }

    // Fetch responses from Google Forms API
    const url = new URL(
      `https://forms.googleapis.com/v1/forms/${connection.googleFormId}/responses`
    );
    if (connection.lastPolledAt) {
      url.searchParams.set(
        "filter",
        `timestamp >= ${new Date(connection.lastPolledAt).toISOString()}`
      );
    }

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

    for (const response of responses) {
      const submittedAt = new Date(response.createTime).getTime();
      const responseId: string = response.responseId ?? "";

      if (connection.lastPolledAt && submittedAt <= connection.lastPolledAt) {
        continue;
      }

      // Dedup: skip if this Google responseId was already processed for this connection
      if (responseId) {
        const existing = await ctx.runQuery(
          internal.formConnections.getSubmissionByResponseIdInternal,
          { connectionId: connection._id, responseId }
        );
        if (existing) continue;
      }

      // Map answers → fieldValues
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
          responseId: responseId || undefined,
        }
      );

      try {
        await generateDocxFromTemplate(ctx, {
          submissionId: submissionId as Id<"formSubmissions">,
          templateId: connection.templateId,
          fieldValues,
          filename,
        });
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
    // Process sequentially to avoid race conditions
    for (const conn of connections) {
      try {
        await ctx.runAction(internal.processFormResponses.pollConnection, {
          connectionId: conn._id,
        });
      } catch (err) {
        console.error(`[pollAll] Error polling connection ${conn._id}:`, err);
      }
    }
  },
});

// ── Public action: "Sync Now" button (works even when paused) ─────────────────

export const syncConnection = action({
  args: { connectionId: v.id("formConnections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const conn = await ctx.runQuery(internal.formConnections.getByIdInternal, {
      id: args.connectionId,
    });
    if (!conn || conn.ownerId !== identity.subject) {
      throw new Error("Connection not found");
    }

    // Allow sync even when paused (force poll)
    await ctx.runAction(internal.processFormResponses.pollConnection, {
      connectionId: args.connectionId,
    });
  },
});

// ── Public action: Retry a failed submission ──────────────────────────────────

export const retrySubmission = action({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const submission = await ctx.runQuery(
      internal.formConnections.getSubmissionByIdInternal,
      { id: args.submissionId }
    );
    if (!submission || submission.ownerId !== identity.subject) {
      throw new Error("Submission not found");
    }
    if (submission.status !== "error") {
      throw new Error("Only error submissions can be retried");
    }

    // Reset to pending
    await ctx.runMutation(internal.formConnections.resetSubmissionInternal, {
      id: args.submissionId,
    });

    // Re-generate
    try {
      await generateDocxFromTemplate(ctx, {
        submissionId: args.submissionId,
        templateId: submission.templateId,
        fieldValues: submission.fieldValues as Record<string, string>,
        filename: submission.filename,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.formConnections.updateSubmissionInternal, {
        id: args.submissionId,
        status: "error",
        errorMessage: message,
      });
      throw new Error(message);
    }
  },
});