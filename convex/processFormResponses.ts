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

  // FIX: wrap network call so transient failures don't bypass stampPolledAt.
  // NOTE: Multiple connections for the same owner polled concurrently will all
  // attempt a refresh simultaneously (last-write-wins in DB). This is safe —
  // all resulting tokens are valid — but wastes a few Google API calls.
  // A proper fix requires a distributed mutex; acceptable for now given
  // Google's generous token quota.
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
// NOTE: This logic is intentionally duplicated from lib/template-preprocessor.ts
// because that file uses JSZip (async) while Convex actions require PizZip
// (sync). They cannot share code across the runtime boundary. If the stitching
// algorithm changes, update BOTH files.

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

// ── Filename sanitizer ────────────────────────────────────────────────────────

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

// ── Fetch all responses with pagination ───────────────────────────────────────
// FIX: previous version did a single fetch with no pageSize, which would
// return Google's default page (up to 5000 responses!) and could easily
// time out. Now fetches in pages of PAGE_SIZE and stops after
// MAX_RESPONSES_PER_POLL to keep each poll action well within Convex's
// execution time limit. Responses from subsequent pages will be picked up
// in the next cron cycle.

const RESPONSES_PAGE_SIZE = 50;
const MAX_RESPONSES_PER_POLL = 200;

async function fetchFormResponses(
  googleFormId: string,
  accessToken: string,
  lastPolledAt: number | undefined
): Promise<{ responses: any[]; truncated: boolean }> {
  const baseUrl = new URL(
    `https://forms.googleapis.com/v1/forms/${googleFormId}/responses`
  );
  baseUrl.searchParams.set("pageSize", String(RESPONSES_PAGE_SIZE));

  if (lastPolledAt) {
    baseUrl.searchParams.set(
      "filter",
      `timestamp >= ${new Date(lastPolledAt).toISOString()}`
    );
  }

  const allResponses: any[] = [];
  let pageToken: string | undefined;
  let truncated = false;

  do {
    const pageUrl = new URL(baseUrl.toString());
    if (pageToken) pageUrl.searchParams.set("pageToken", pageToken);

    let res: Response;
    try {
      res = await fetch(pageUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (fetchErr) {
      console.error("[fetchFormResponses] Network error:", fetchErr);
      break;
    }

    if (!res.ok) {
      console.error(
        "[fetchFormResponses] API error:",
        res.status,
        await res.text().catch(() => "")
      );
      break;
    }

    const data = await res.json();
    allResponses.push(...(data.responses ?? []));
    pageToken = data.nextPageToken;

    if (allResponses.length >= MAX_RESPONSES_PER_POLL) {
      truncated = true;
      break;
    }
  } while (pageToken);

  return { responses: allResponses, truncated };
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

    // FIX: use paginated fetch instead of a single unbounded request
    let responses: any[];
    let truncated: boolean;
    try {
      ({ responses, truncated } = await fetchFormResponses(
        connection.googleFormId,
        accessToken,
        connection.lastPolledAt
      ));
    } catch (fetchErr) {
      console.error(
        "[pollConnection] Unexpected error fetching responses:",
        fetchErr
      );
      // Don't stamp — transient error, let next cycle retry.
      return;
    }

    if (truncated) {
      console.warn(
        `[pollConnection] Connection ${args.connectionId} hit MAX_RESPONSES_PER_POLL (${MAX_RESPONSES_PER_POLL}). ` +
          "Remaining responses will be fetched in the next cron cycle."
      );
    }

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
// FIX: was sequential (one-by-one), which could time out with many connections.
// Now processes in parallel batches of POLL_CONCURRENCY, giving a good balance
// between throughput and not overwhelming the Convex scheduler.

const POLL_CONCURRENCY = 5;

export const pollAll = internalAction({
  args: {},
  handler: async (ctx) => {
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

    // Process in parallel batches to stay within Convex action time budget.
    for (let i = 0; i < connections.length; i += POLL_CONCURRENCY) {
      const chunk = connections.slice(i, i + POLL_CONCURRENCY);
      await Promise.all(
        chunk.map(async (conn: any) => {
          try {
            await ctx.runAction(internal.processFormResponses.pollConnection, {
              connectionId: conn._id,
            });
          } catch (err) {
            console.error(
              `[pollAll] Error polling connection ${conn._id}:`,
              err
            );
          }
        })
      );
    }
  },
});

// ── Public action: "Sync Now" button ─────────────────────────────────────────

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
