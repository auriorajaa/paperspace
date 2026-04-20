import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ── Get file from storage ─────────────────────────────────────────────────────
http.route({
  path: "/getFile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const storageId = url.searchParams.get("storageId");
    // Opsional: nama file untuk Content-Disposition
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
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    };

    // Kalau ada filename, set Content-Disposition supaya browser tau nama filenya
    if (filename) {
      // inline = buka di browser (bukan langsung download)
      // encodeURIComponent untuk handle spasi & karakter spesial
      headers["Content-Disposition"] =
        `inline; filename="${filename}.docx"; filename*=UTF-8''${encodeURIComponent(filename)}.docx`;
    }

    return new Response(blob, { headers });
  }),
});

// ── Generate upload URL ───────────────────────────────────────────────────────
http.route({
  path: "/getUploadUrl",
  method: "POST",
  handler: httpAction(async (ctx) => {
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return new Response(JSON.stringify({ uploadUrl }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
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
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      console.error("[updateFileStorage]", err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
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
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }),
  });
}

export default http;
