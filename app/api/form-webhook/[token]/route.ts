// app/api/form-webhook/[token]/route.ts
//
// CHANGES vs previous version:
//   - Pass scriptToken in body when calling /getUploadUrl so the now-auth-gated
//     endpoint can verify the caller without a Clerk session.

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const dynamic = "force-dynamic";

// ── Rate limiter ──────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60_000;

function checkRateLimit(token: string): {
  allowed: boolean;
  retryAfter: number;
} {
  const now = Date.now();

  if (Math.random() < 0.02) {
    for (const [k, e] of rateLimitMap.entries()) {
      if (now > e.resetAt) rateLimitMap.delete(k);
    }
  }

  const entry = rateLimitMap.get(token);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(token, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
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

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const rl = checkRateLimit(token);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfter),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Window": String(RATE_LIMIT_WINDOW / 1000),
          },
        }
      );
    }

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

    const template = await convex.query(
      api.templates.getTemplateByScriptToken,
      {
        scriptToken: token,
      }
    );
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
    const filename = buildFilename(
      connection.filenamePattern,
      rowNumber,
      fieldValues
    );

    const submissionId = await convex.mutation(
      api.formConnections.createSubmission,
      {
        scriptToken: token,
        connectionId: connection._id,
        respondentEmail: body.respondentEmail,
        fieldValues,
        filename,
        status: "pending",
        submittedAt,
      }
    );

    const TIMEOUT_MS = 55_000;

    const generationPromise = generateDocument({
      submissionId: submissionId as Id<"formSubmissions">,
      scriptToken: token,
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

    Promise.race([generationPromise, timeoutPromise]).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[form-webhook] Generation error or timeout:", message);
    });

    return NextResponse.json({ ok: true, submissionId });
  } catch (err) {
    console.error("[form-webhook]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── Generate document ─────────────────────────────────────────────────────────

async function generateDocument({
  submissionId,
  scriptToken,
  template,
  fieldValues,
  filename,
}: {
  submissionId: Id<"formSubmissions">;
  scriptToken: string;
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

    // FIX: pass scriptToken in body so /getUploadUrl can verify the caller
    // at the HTTP layer (previously the endpoint had zero auth).
    const uploadUrlRes = await fetch(`${convexSiteUrl}/getUploadUrl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptToken }),
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
    const fileUrl = `${convexSiteUrl}/getFile?storageId=${storageId}`;

    await client.mutation(api.formConnections.updateSubmissionForWebhook, {
      scriptToken,
      id: submissionId,
      storageId,
      fileUrl,
      status: "generated",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await client.mutation(api.formConnections.updateSubmissionForWebhook, {
      scriptToken,
      id: submissionId,
      status: "error",
      errorMessage: message,
    });
    throw err;
  }
}
