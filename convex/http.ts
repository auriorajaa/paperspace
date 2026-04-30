import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ── /getFile — sengaja unauthenticated ────────────────────────────────────────
// OnlyOffice server tidak bisa kirim auth header saat fetch dokumen.
// Security: storageId adalah UUID random yang tidak pernah diekspos publik.

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
// Dua jalur auth:
//   1. scriptToken  — untuk form connections (submit dari Google Forms, dll)
//   2. x-deploy-key — untuk server-to-server call dari Next.js (onlyoffice-callback)
//      Deploy key dari Convex dashboard, disimpan di CONVEX_DEPLOY_KEY env var.

http.route({
  path: "/getUploadUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // ── Auth jalur 1: deploy key (server-to-server) ────────────────────────
    const deployKey = request.headers.get("x-deploy-key");
    if (deployKey && deployKey === process.env.CONVEX_DEPLOY_KEY) {
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

// ── /updateFileStorage — internal only, tidak perlu HTTP endpoint lagi ────────
// Endpoint ini dihapus dari HTTP router karena sekarang callback langsung
// memanggil mutation via Convex admin API (CONVEX_DEPLOY_KEY).
// Kalau masih dibutuhkan untuk keperluan lain, tambahkan auth yang proper.

for (const path of ["/getUploadUrl"]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => {
      return new Response(null, { headers: getCorsHeaders() });
    }),
  });
}

export default http;
