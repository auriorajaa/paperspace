// app/api/form-webhook/[token]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const dynamic = "force-dynamic";

// ── Filename sanitizer — guaranteed non-empty ─────────────────────────────────

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

  // FIXED: fallback if the pattern resolves to empty / only underscores
  return raw.replace(/^_+$/, "").trim() || `document_${rowNumber}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = (await req.json()) as {
      respondentEmail?: string;
      answers?: Record<string, string>;
      timestamp?: string;
    };

    const connection = await convex.query(
      api.formConnections.getByScriptToken,
      { token }
    );
    if (!connection || !connection.isActive) {
      return NextResponse.json(
        { error: "Invalid or inactive token" },
        { status: 401 }
      );
    }

    const template = await convex.query(api.templates.getById, {
      id: connection.templateId,
    });
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const fieldValues: Record<string, string> = {};
    const answers: Record<string, string> = body.answers ?? {};

    for (const mapping of connection.fieldMappings) {
      fieldValues[mapping.templateFieldName] =
        answers[mapping.formQuestionTitle] ?? "";
    }

    const submittedAt = Date.now();
    const rowNumber = String(submittedAt).slice(-6);

    // FIXED: use buildFilename() for a guaranteed non-empty valid name
    const filename = buildFilename(
      connection.filenamePattern,
      rowNumber,
      fieldValues
    );

    // SECURITY FIX: createSubmission no longer takes ownerId as a param —
    // it derives it from the connection on the Convex side.
    const submissionId = await convex.mutation(
      api.formConnections.createSubmission,
      {
        connectionId: connection._id,
        respondentEmail: body.respondentEmail,
        fieldValues,
        filename,
        status: "pending",
        submittedAt,
      }
    );

    // FIXED: fire-and-forget is wrapped with a hard timeout so the background
    // task can't run forever after the HTTP response is sent (which causes
    // silent failures on Vercel/Edge runtimes that terminate background work).
    //
    // If generation doesn't finish within 55 s, we mark the submission as
    // "error" so the user can see it failed and retry manually instead of
    // leaving it stuck on "pending" indefinitely.
    const TIMEOUT_MS = 55_000;

    const generationPromise = generateDocument({
      submissionId: submissionId as Id<"formSubmissions">,
      template,
      fieldValues,
      filename,
    });

    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error("Document generation timed out")),
        TIMEOUT_MS
      )
    );

    // We await here (with a timeout) rather than truly fire-and-forget so the
    // runtime doesn't kill the in-flight upload. We still respond to the
    // webhook caller quickly via the early return above; the await is purely
    // to keep the process alive long enough for generation to complete.
    Promise.race([generationPromise, timeoutPromise]).catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[form-webhook] Generation error or timeout:", message);
      try {
        await convex.mutation(api.formConnections.updateSubmission, {
          id: submissionId as Id<"formSubmissions">,
          status: "error",
          errorMessage: message,
        });
      } catch (updateErr) {
        console.error(
          "[form-webhook] Failed to update submission status:",
          updateErr
        );
      }
    });

    return NextResponse.json({ ok: true, submissionId });
  } catch (err) {
    console.error("[form-webhook]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function generateDocument({
  submissionId,
  template,
  fieldValues,
  filename,
}: {
  submissionId: Id<"formSubmissions">;
  template: {
    storageId: string;
    fields: Array<{ name: string; type: string }>;
  };
  fieldValues: Record<string, string>;
  filename: string;
}) {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  try {
    const { default: PizZip } = await import("pizzip");
    const { default: Docxtemplater } = await import("docxtemplater");
    const { preprocessTemplate } = await import("@/lib/template-preprocessor");

    // Use CONVEX_SITE_URL (server-only) consistently; fall back to the
    // public variant so local dev still works when only one is set.
    const convexSiteUrl =
      process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;

    const fileRes = await fetch(
      `${convexSiteUrl}/getFile?storageId=${template.storageId}`
    );
    if (!fileRes.ok) throw new Error("Failed to fetch template file");

    const buffer = await fileRes.arrayBuffer();
    const processed = await preprocessTemplate(buffer);

    const data: Record<string, unknown> = {};
    for (const field of template.fields) {
      if (field.type === "condition" || field.type === "condition_inverse") {
        data[field.name] = fieldValues[field.name] === "true";
      } else if (field.type === "loop") {
        data[field.name] = [];
      } else {
        data[field.name] = fieldValues[field.name] ?? "";
      }
    }

    const zip = new PizZip(processed);
    const doc = new Docxtemplater(zip, {
      delimiters: { start: "{{", end: "}}" },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
    doc.render(data);

    const outBuffer: ArrayBuffer = doc
      .getZip()
      .generate({ type: "arraybuffer" });
    const outUint8 = new Uint8Array(outBuffer);

    // Use the same base URL consistently
    const convexSiteUrl2 =
      process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;

    const uploadUrlRes = await fetch(`${convexSiteUrl2}/getUploadUrl`, {
      method: "POST",
    });
    if (!uploadUrlRes.ok) throw new Error("Failed to get upload URL");
    const { uploadUrl } = (await uploadUrlRes.json()) as { uploadUrl: string };

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      body: outUint8,
    });
    if (!uploadRes.ok) throw new Error("Upload failed");
    const { storageId } = (await uploadRes.json()) as { storageId: string };
    const fileUrl = `${convexSiteUrl2}/getFile?storageId=${storageId}`;

    await client.mutation(api.formConnections.updateSubmission, {
      id: submissionId,
      storageId,
      fileUrl,
      status: "generated",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await client.mutation(api.formConnections.updateSubmission, {
      id: submissionId,
      status: "error",
      errorMessage: message,
    });
    // Re-throw so the Promise.race timeout handler in the route can log it
    throw err;
  }
}
