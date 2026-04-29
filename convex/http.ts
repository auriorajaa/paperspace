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

http.route({
  path: "/getFile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // NOTE: This endpoint is intentionally unauthenticated.
    //
    // OnlyOffice fetches the document URL directly from its server — it cannot
    // send a Clerk session token or an internal secret header. Adding an auth
    // gate here breaks the editor (Convex throws "Missing 'iss' claim" when
    // there is no token at all, rather than returning null).
    //
    // Security rationale: Convex storage IDs are cryptographically random
    // UUIDs. Knowing a storageId is sufficient "proof" of access, equivalent
    // to a pre-signed S3 URL. The IDs are never exposed publicly; they only
    // appear inside authenticated API responses consumed by the client.

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

http.route({
  path: "/getUploadUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const internalSecret = request.headers.get("x-internal-secret");
    if (internalSecret && internalSecret === process.env.INTERNAL_SECRET) {
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

http.route({
  path: "/updateFileStorage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const internalSecret = request.headers.get("x-internal-secret");
    const hasInternalAuth =
      internalSecret && internalSecret === process.env.INTERNAL_SECRET;

    if (!hasInternalAuth) {
      return new Response(JSON.stringify({ error: "Missing authentication" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...getCorsHeaders() },
      });
    }

    try {
      const { documentId, templateId, storageId, fileUrl } =
        await request.json();

      if (!storageId || !fileUrl) {
        return new Response(
          JSON.stringify({ error: "Missing storageId or fileUrl" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...getCorsHeaders(),
            },
          }
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
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...getCorsHeaders(),
            },
          }
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...getCorsHeaders() },
      });
    } catch (err) {
      console.error("[updateFileStorage]", err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders() },
      });
    }
  }),
});

for (const path of ["/getUploadUrl", "/updateFileStorage"]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => {
      return new Response(null, { headers: getCorsHeaders() });
    }),
  });
}

export default http;
