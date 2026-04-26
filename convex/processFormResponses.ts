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

  // FIXED: wrap the network call so a transient fetch failure (DNS, timeout)
  // is caught and surfaced as an error instead of an uncaught exception that
  // bypasses the stampPolledAt() call in the caller.
  let refreshed: { access_token?: string; expires_in?: number; error?: string };
  try {
    refreshed = await refreshGoogleToken(account.refreshToken);
  } catch (fetchErr) {
    console.error(
      "[getValidToken] Network error during token refresh:",
      fetchErr
    );
    return {
      token: null,
      error:
        "Token refresh failed due to a network error. Will retry next cycle.",
    };
  }

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

// ── Preprocessor: stitch {{placeholders}} split across Word XML runs ──────────

function stitchParagraph(para: string): string {
  const nodes: { tStart: number; tEnd: number; text: string }[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(para)) !== null) {
    const tEnd = m.index + m[0].length - 6;
    const tStart = tEnd - m[1].length;
    nodes.push({ tStart, tEnd, text: m[1] });
  }

  if (nodes.length <= 1) return para;

  const combined = nodes.map((n) => n.text).join("");
  if (!combined.includes("{{") || !combined.includes("}}")) return para;

  let result = para;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const { tStart, tEnd } = nodes[i];
    const newText = i === 0 ? combined : "";
    result = result.slice(0, tStart) + newText + result.slice(tEnd);
  }
  return result;
}

function preprocessDocxBuffer(buf: ArrayBuffer, PizZip: any): ArrayBuffer {
  const zip = new PizZip(buf);
  const xmlPaths = [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/header3.xml",
    "word/footer1.xml",
    "word/footer2.xml",
    "word/footer3.xml",
  ];

  for (const path of xmlPaths) {
    if (!zip.files[path]) continue;
    let xml: string = zip.files[path].asText();
    xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, stitchParagraph);
    zip.file(path, xml);
  }

  return zip.generate({ type: "arraybuffer" }) as ArrayBuffer;
}

// ── Filename sanitizer — guaranteed to never return an empty string ───────────

/**
 * FIXED: Previous implementation could yield an empty string (or only
 * underscores) if filenamePattern contained only special characters or all
 * template tokens resolved to "". We now guarantee a non-empty, valid filename.
 */
function buildFilename(
  pattern: string,
  rowNumber: string,
  fieldValues: Record<string, string>
): string {
  const raw = (pattern || `document_{{row_number}}`)
    .replace(/{{row_number}}/g, rowNumber)
    .replace(/{{(\w+)}}/g, (_: string, key: string) => fieldValues[key] ?? "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .trim();

  // Fallback: if everything resolved to empty / whitespace / only underscores
  return raw.replace(/^_+$/, "").trim() || `document_${rowNumber}`;
}

// ── Core document generation logic ────────────────────────────────────────────

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

  const fileUrl = await ctx.storage.getUrl(
    template.storageId as Id<"_storage">
  );
  if (!fileUrl) throw new Error("Template file not found in storage");

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error("Failed to fetch template file");
  const rawBuffer = await fileRes.arrayBuffer();

  const buffer = preprocessDocxBuffer(rawBuffer, PizZip);

  const data: Record<string, unknown> = {};
  for (const field of template.fields) {
    if (field.type === "condition" || field.type === "condition_inverse") {
      data[field.name] = fieldValues[field.name]?.toLowerCase() === "true";
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
    nullGetter: () => "",
  });

  try {
    doc.render(data);
  } catch (err: any) {
    if (err?.properties?.errors?.length) {
      const details = (err.properties.errors as any[])
        .map((e: any) => {
          const id = e?.properties?.id as string | undefined;
          const tag = e?.properties?.xtag ?? e?.properties?.tag ?? "";
          const tagHint = tag ? ` (tag: {{${tag}}})` : "";
          if (id === "unopened_tag")
            return `Closing tag {{/${tag}}} has no matching opening tag${tagHint}`;
          if (id === "unclosed_tag")
            return `Opening tag {{${tag}}} has no matching closing tag${tagHint}`;
          if (id === "closing_tag_does_not_match") {
            const openTag =
              e?.properties?.openingtag ?? e?.properties?.openTag ?? "";
            return `Mismatched tags: {{#${openTag}}} closed by {{/${tag}}} — they must match`;
          }
          if (id === "raw_tag_not_in_paragraph")
            return `Raw tag {{@${tag}}} must be the only content in its paragraph${tagHint}`;
          if (id === "loop_tag_not_in_cell")
            return `Loop tag {{#${tag}}} and its closing tag must be in separate table rows${tagHint}`;
          return e?.properties?.explanation ?? e?.message ?? String(e);
        })
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
  const generatedFileUrl = `${convexSiteUrl}/getFile?storageId=${newStorageId}&filename=${encodeURIComponent(params.filename)}`;

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

    const stampPolledAt = () =>
      ctx.runMutation(internal.formConnections.updateLastPolledInternal, {
        id: args.connectionId,
        lastPolledAt: Date.now(),
      });

    // FIXED: token fetch is now wrapped in try/catch in getValidToken itself.
    // If getValidToken throws unexpectedly (shouldn't happen now), we still
    // stamp lastPolledAt to avoid infinite retries on the same window.
    let tokenResult: { token: string | null; error?: string };
    try {
      tokenResult = await getValidToken(ctx, connection.ownerId);
    } catch (err) {
      console.error(
        `[pollConnection] Unexpected error fetching token for owner ${connection.ownerId}:`,
        err
      );
      await stampPolledAt();
      return;
    }

    const { token: accessToken, error: tokenError } = tokenResult;
    if (!accessToken) {
      console.error(
        `[pollConnection] Token error for owner ${connection.ownerId}: ${tokenError}`
      );
      await stampPolledAt();
      return;
    }

    const url = new URL(
      `https://forms.googleapis.com/v1/forms/${connection.googleFormId}/responses`
    );
    if (connection.lastPolledAt) {
      url.searchParams.set(
        "filter",
        `timestamp >= ${new Date(connection.lastPolledAt).toISOString()}`
      );
    }

    let responsesRes: Response;
    try {
      responsesRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (fetchErr) {
      console.error(
        "[pollConnection] Network error fetching form responses:",
        fetchErr
      );
      // Don't stamp — transient network error, let the next cron cycle retry.
      // We intentionally don't stamp here because no responses were processed.
      return;
    }

    if (!responsesRes.ok) {
      console.error(
        "[pollConnection] Forms API error:",
        responsesRes.status,
        await responsesRes.text().catch(() => "(body unreadable)")
      );
      // Stamp to avoid re-fetching the same window forever on persistent errors.
      await stampPolledAt();
      return;
    }

    const { responses = [] } = await responsesRes.json();
    if (responses.length === 0) {
      await stampPolledAt();
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

      // ── Dedup: primary key is (connectionId, responseId) ──────────────────
      if (responseId) {
        const existing = await ctx.runQuery(
          internal.formConnections.getSubmissionByResponseIdInternal,
          { connectionId: connection._id, responseId }
        );
        if (existing) continue;
      }

      // ── Dedup: fallback key is (connectionId, submittedAt) ─────────────────
      {
        const existing = await ctx.runQuery(
          internal.formConnections.getSubmissionByTimestampInternal,
          { connectionId: connection._id, submittedAt }
        );
        if (existing) continue;
      }

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

      // FIXED: use buildFilename() to guarantee a non-empty valid string
      const rowNumber = String(submittedAt).slice(-6);
      const filename = buildFilename(
        connection.filenamePattern,
        rowNumber,
        fieldValues
      );

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

    await stampPolledAt();
  },
});

// ── Poll all active Google connections (called by cron) ───────────────────────

export const pollAll = internalAction({
  args: {},
  handler: async (ctx) => {
    // FIXED: wrap the initial query so a DB failure doesn't silently kill the
    // whole cron without any log output.
    let connections: any[];
    try {
      connections = await ctx.runQuery(
        internal.formConnections.getAllGoogleConnectionsInternal
      );
    } catch (err) {
      console.error("[pollAll] Failed to load connections:", err);
      return;
    }

    if (connections.length === 0) return;

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

    await ctx.runMutation(internal.formConnections.resetSubmissionInternal, {
      id: args.submissionId,
    });

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
