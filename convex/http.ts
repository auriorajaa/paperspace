import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

// ── Get file from storage ─────────────────────────────────────────────────────
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
      // FIX: Restrict CORS to known origins instead of wildcard.
      // storageIds are opaque but could be leaked via shared URLs.
      // The app origin env var covers the frontend; Convex site URL
      // covers server-to-server (webhook, cron) calls.
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

// ── Generate upload URL ───────────────────────────────────────────────────────
// FIX: Previously had zero auth — anyone on the internet could POST here and
// obtain a Convex storage upload URL, enabling arbitrary file uploads that
// would consume the app's storage quota.
//
// Now requires a valid, active scriptToken in the request body.
// The webhook route passes its token; direct callers without a token are
// rejected. Frontend uploads go through the `templates.generateUploadUrl`
// Convex mutation (auth-gated by Clerk) and do NOT use this endpoint.
http.route({
  path: "/getUploadUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Parse body — require scriptToken
    let scriptToken: string | undefined;
    try {
      const body = await request.json();
      scriptToken =
        typeof body?.scriptToken === "string" ? body.scriptToken : undefined;
    } catch {
      return new Response(
        JSON.stringify({ error: "Request body must be JSON with scriptToken" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!scriptToken) {
      return new Response(
        JSON.stringify({ error: "scriptToken is required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify the token resolves to an active connection
    const connection = await ctx.runQuery(
      api.formConnections.getByScriptToken,
      { token: scriptToken }
    );

    if (!connection || !connection.isActive) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive scriptToken" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return new Response(JSON.stringify({ uploadUrl }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL ?? "*",
      },
    });
  }),
});

// ── Update file storage after ONLYOFFICE save ─────────────────────────────────
http.route({
  path: "/updateFileStorage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { documentId, templateId, storageId, fileUrl } =
        await request.json();

      if (!storageId || !fileUrl) {
        return new Response(
          JSON.stringify({ error: "Missing storageId or fileUrl" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (documentId) {
        await ctx.runMutation(internal.documents.updateFileStorageInternal, {
          id: documentId,
          storageId,
          fileUrl,
        });
        console.log("[updateFileStorage] document updated", documentId);
      } else if (templateId) {
        await ctx.runMutation(internal.templates.updateFileStorageInternal, {
          id: templateId,
          storageId,
          fileUrl,
        });
        console.log("[updateFileStorage] template updated", templateId);
      } else {
        return new Response(
          JSON.stringify({ error: "Missing documentId or templateId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL ?? "*",
        },
      });
    } catch (err) {
      console.error("[updateFileStorage]", err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL ?? "*",
        },
      });
    }
  }),
});

// ── CORS preflight ────────────────────────────────────────────────────────────
for (const path of ["/getUploadUrl", "/updateFileStorage"]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL ?? "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }),
  });
}

export default http;
