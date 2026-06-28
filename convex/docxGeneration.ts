/* eslint-disable @typescript-eslint/no-explicit-any */
// convex\docxGeneration.ts
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ── Template-not-found sentinel ────────────────────────────────────────────

export class TemplateNotFoundError extends Error {
  constructor() {
    super("Template not found");
    this.name = "TemplateNotFoundError";
  }
}

// ── Filename sanitizer ─────────────────────────────────────────────────────

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

// ── Preprocessor: stitch {{placeholders}} split across Word XML runs ────────

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

// ── Core document generation internal action ──────────────────────────────

export const generateDocxFromTemplate = internalAction({
  args: {
    submissionId: v.id("formSubmissions"),
    templateId: v.id("templates"),
    fieldValues: v.any(),
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    const { submissionId, templateId, fieldValues } = args;
    const convexSiteUrl = process.env.CONVEX_SITE_URL!;

    const template = await ctx.runQuery(internal.templates.getByIdInternal, {
      id: templateId,
    });
    if (!template) throw new TemplateNotFoundError();

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

    const outBuffer: ArrayBuffer = doc.getZip().generate({
      type: "arraybuffer",
    });
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
    const generatedFileUrl = `${convexSiteUrl}/getFile?storageId=${newStorageId}&filename=${encodeURIComponent(args.filename)}`;

    await ctx.runMutation(internal.formConnections.updateSubmissionInternal, {
      id: submissionId,
      storageId: newStorageId,
      fileUrl: generatedFileUrl,
      status: "generated",
    });
  },
});

export { buildFilename };
