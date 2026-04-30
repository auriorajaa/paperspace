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

// Helper: cek internal secret
function isInternalAuthorized(request: Request): boolean {
  const secret = request.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;

  // console.log("[auth] Checking secret:", {
  //   hasSecret: !!secret,
  //   hasExpected: !!expected,
  //   match: secret === expected,
  //   secretPrefix: secret?.slice(0, 10),
  //   expectedPrefix: expected?.slice(0, 10),
  // });

  return !!secret && !!expected && secret === expected;
}

// ── /getFile ────────────────────────────────────────────────────────────────
http.route({
  path: "/getFile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // ... sama seperti sebelumnya
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

// ── /getUploadUrl ───────────────────────────────────────────────────────────
// Auth via x-internal-secret (shared antara Next.js dan Convex)

http.route({
  path: "/getUploadUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // ── Auth jalur 1: internal secret (server-to-server dari Next.js) ──────
    if (isInternalAuthorized(request)) {
      const uploadUrl = await ctx.storage.generateUploadUrl();
      return new Response(JSON.stringify({ uploadUrl }), {
        headers: { "Content-Type": "application/json", ...getCorsHeaders() },
      });
    }

    // ── Auth jalur 2: scriptToken (form connection) ────────────────────────
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

// ── /onlyofficeCallback ─────────────────────────────────────────────────────
// Endpoint internal untuk menerima callback dari Next.js API route.

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
      //console.error("[onlyofficeCallback] Error:", err);
      return new Response(
        JSON.stringify({ error: "Internal error", message: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ── CORS preflight ──────────────────────────────────────────────────────────
for (const path of ["/getUploadUrl", "/onlyofficeCallback"]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => {
      return new Response(null, { headers: getCorsHeaders() });
    }),
  });
}

export default http;
