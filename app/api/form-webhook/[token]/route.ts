// app\api\form-webhook\[token]\route.ts

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const dynamic = "force-dynamic";

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
    const filename = (connection.filenamePattern || `document_{{row_number}}`)
      .replace(/{{row_number}}/g, rowNumber)
      .replace(/{{(\w+)}}/g, (_: string, key: string) => fieldValues[key] ?? "")
      .replace(/[<>:"/\\|?*]/g, "_");

    const submissionId = await convex.mutation(
      api.formConnections.createSubmission,
      {
        connectionId: connection._id,
        templateId: connection.templateId,
        ownerId: connection.ownerId,
        respondentEmail: body.respondentEmail,
        fieldValues,
        filename,
        status: "pending",
        submittedAt,
      }
    );

    // Fire and forget
    generateDocument({
      submissionId: submissionId as Id<"formSubmissions">,
      template,
      fieldValues,
      filename,
    }).catch(console.error);

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

    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;
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
    });
    doc.render(data);

    const outBuffer: ArrayBuffer = doc
      .getZip()
      .generate({ type: "arraybuffer" });
    const outUint8 = new Uint8Array(outBuffer);

    const uploadUrlRes = await fetch(`${convexSiteUrl}/getUploadUrl`, {
      method: "POST",
    });
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
  }
}
