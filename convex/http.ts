// convex/http.ts — full file including the new /callback-summarizer route

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-internal-secret",
  };
}

function isInternalAuthorized(request: Request): boolean {
  const secret = request.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;
  return !!secret && !!expected && secret === expected;
}

// ── /getFile ─────────────────────────────────────────────────────────────────
http.route({
  path: "/getFile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const storageId = url.searchParams.get("storageId");
    const filename = url.searchParams.get("filename");

    if (!storageId) {
      return new Response("Missing storageId", { status: 400 });
    }

    const blob = await ctx.storage.get(storageId as any);
    if (!blob) {
      return new Response("File not found", { status: 404 });
    }

    const contentType = blob.type || "application/octet-stream";
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL ?? "*",
      "Cache-Control": "private, no-store",
    };

    if (filename) {
      headers["Content-Disposition"] =
        `inline; filename="${filename}.docx"; filename*=UTF-8''${encodeURIComponent(filename)}.docx`;
    }

    return new Response(blob, { headers });
  }),
});

// ── /getUploadUrl ─────────────────────────────────────────────────────────────
http.route({
  path: "/getUploadUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (isInternalAuthorized(request)) {
      const uploadUrl = await ctx.storage.generateUploadUrl();
      return new Response(JSON.stringify({ uploadUrl }), {
        headers: { "Content-Type": "application/json", ...getCorsHeaders() },
      });
    }

    let scriptToken: string | undefined;
    try {
      const body = await request.clone().json();
      scriptToken =
        typeof body?.scriptToken === "string" ? body.scriptToken : undefined;
    } catch {
      return new Response(
        JSON.stringify({ error: "Request body must be JSON with scriptToken" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...getCorsHeaders() },
        }
      );
    }

    if (!scriptToken) {
      return new Response(JSON.stringify({ error: "Missing authentication" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...getCorsHeaders() },
      });
    }

    const connection = await ctx.runQuery(
      api.formConnections.getByScriptToken,
      { token: scriptToken }
    );

    if (!connection || !connection.isActive) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive scriptToken" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...getCorsHeaders() },
        }
      );
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return new Response(JSON.stringify({ uploadUrl }), {
      headers: { "Content-Type": "application/json", ...getCorsHeaders() },
    });
  }),
});

// ── /onlyofficeCallback ───────────────────────────────────────────────────────
http.route({
  path: "/onlyofficeCallback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isInternalAuthorized(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { type, id, storageId, fileUrl } = body;

      if (!id || !storageId || !fileUrl) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (type === "document" || !type) {
        await ctx.runMutation(internal.documents.updateFileStorageInternal, {
          id,
          storageId,
          fileUrl,
        });
      } else if (type === "template") {
        await ctx.runMutation(internal.templates.updateFileStorageInternal, {
          id,
          storageId,
          fileUrl,
        });
      }

      return new Response(JSON.stringify({ error: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("[onlyofficeCallback] Error:", err);
      return new Response(
        JSON.stringify({ error: "Internal error", message: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ── /callback-summarizer ─────────────────────────────────────────────────────
// The Python API posts here when it finishes processing a document.
//
// Security: we pass a shared secret + the documentId in the callback URL
// as query params, e.g.:
//   https://xxx.convex.cloud/callback-summarizer?docId=<id>&secret=<token>
//
// The Python API treats the callback_url as an opaque string and POSTs the
// result body to it — query params are preserved automatically.
http.route({
  path: "/callback-summarizer",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const docId = url.searchParams.get("docId");
    const secret = url.searchParams.get("secret");

    // ── Validate shared secret ───────────────────────────────────────────────
    const expectedSecret = process.env.SUMMARIZER_CALLBACK_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      console.error("[callback-summarizer] Unauthorized callback attempt");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Validate docId ───────────────────────────────────────────────────────
    if (!docId) {
      return new Response(JSON.stringify({ error: "Missing docId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { success, status, result, error: apiError } = body;

    // ── Error case: Python API reported a processing failure ─────────────────
    if (!success || status === "error") {
      console.error(
        `[callback-summarizer] Job failed for doc ${docId}:`,
        apiError
      );
      await ctx.runMutation(internal.documents.updateAiSummary, {
        id: docId as any,
        status: "error",
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Success case: extract summary text from the result payload ───────────
    // Priority order for picking the summary text:
    //   1. paragraph_summary  — full narrative paragraph (most useful for display)
    //   2. ringkasan.ISI      — extracted "isi surat" entity
    //   3. ringkasan.PERIHAL  — subject line as fallback
    const summaryText: string =
      result?.paragraph_summary?.trim() ||
      result?.ringkasan?.ISI?.trim() ||
      result?.ringkasan?.PERIHAL?.trim() ||
      "Summary generated but no content was returned.";

    await ctx.runMutation(internal.documents.updateAiSummary, {
      id: docId as any,
      status: "done",
      summary: summaryText,
      generatedAt: Date.now(),
    });

    console.log(
      `[callback-summarizer] Summary saved for doc ${docId} (${summaryText.length} chars)`
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ── CORS preflight ────────────────────────────────────────────────────────────
for (const path of [
  "/getUploadUrl",
  "/onlyofficeCallback",
  "/callback-summarizer",
]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => {
      return new Response(null, { headers: getCorsHeaders() });
    }),
  });
}

export default http;
