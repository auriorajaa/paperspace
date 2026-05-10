/**
 * lib/document-field-analyzer.ts
 *
 * Remote structured extraction service for DOCX template fields.
 *
 * Calls an external AI inference endpoint that understands Indonesian
 * official letter conventions and extracts all fillable fields with
 * higher accuracy than offline structural analysis alone.
 *
 * When the remote service is unavailable (missing key, rate limit, HTTP
 * error, network timeout, or malformed response), the module falls back
 * transparently to the offline rule-based detector in auto-field-detector.ts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * [DEV NOTE — INTERNAL, DO NOT REMOVE]
 * The inference endpoint behind this module is Google Gemini 2.5 Flash-Lite.
 * API key env var : GEMINI_API_KEY  (aliased below as AI_EXTRACTION_KEY)
 * Endpoint domain : generativelanguage.googleapis.com
 * Model string    : gemini-2.5-flash-lite  (override via AI_MODEL env var)
 *
 * To migrate to a different provider:
 *   1. Update AI_ENDPOINT (or set AI_MODEL + AI_ENDPOINT env vars).
 *   2. Adjust the request body format in callExtractionService().
 *   3. Update the response parser in parseServiceResponse().
 *   No other changes are needed — the rest of the pipeline is provider-agnostic.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { AutoDetectedField, AutoFieldType } from "./auto-field-detector";
import { autoDetectFields } from "./auto-field-detector";

// ── Service configuration ──────────────────────────────────────────────────────
//
// All names here are provider-agnostic. See the [DEV NOTE] above for the
// actual service details.

// Primary extraction key.  Falls back to the legacy env-var name for
// backward compatibility with existing deployment configurations.
const AI_EXTRACTION_KEY: string | undefined =
  process.env.AI_EXTRACTION_KEY ?? process.env.GEMINI_API_KEY;

// Model identifier — override via AI_MODEL for staging or A/B testing.
const AI_MODEL: string = process.env.AI_MODEL ?? "gemini-2.5-flash-lite";

// Inference endpoint — constructed at module load from the configured model.
// Override the full URL via AI_ENDPOINT for provider migrations.
const AI_ENDPOINT: string =
  process.env.AI_ENDPOINT ??
  (() => {
    const host = "generativelanguage.googleapis.com";
    return `https://${host}/v1beta/models/${AI_MODEL}:generateContent`;
  })();

// ── XML utilities (local — no dependency on auto-field-detector internals) ─────

function decodeEntities(t: string): string {
  return t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function collectParagraphLines(paragraphXml: string): string[] {
  const lines: string[] = [];
  let cur = "";
  const re = /(<w:br(?:\s[^>]*)?\/>)|(<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraphXml)) !== null) {
    if (m[1]) {
      if (!m[1].includes('type="page"') && !m[1].includes("type='page'")) {
        if (cur.trim()) lines.push(cur.trim());
        cur = "";
      }
    } else if (m[3] !== undefined) {
      cur += decodeEntities(m[3]);
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.filter(Boolean);
}

function collectCellText(cellXml: string): string {
  const parts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cellXml)) !== null) parts.push(decodeEntities(m[1]));
  return parts.join("").trim();
}

function collectTableLines(tableXml: string): string[] {
  const lines: string[] = [];
  const ROW_RE = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  let row: RegExpExecArray | null;
  while ((row = ROW_RE.exec(tableXml)) !== null) {
    const CELL_RE = /<w:tc[ >][\s\S]*?<\/w:tc>/g;
    let cell: RegExpExecArray | null;
    const cells: string[] = [];
    while ((cell = CELL_RE.exec(row[0])) !== null) {
      const t = collectCellText(cell[0]);
      if (t) cells.push(t);
    }
    if (cells.length > 0) {
      lines.push(cells.join(" "));
      lines.push(...cells);
    }
  }
  return lines.filter((l) => l.length > 0 && l.length < 200);
}

async function extractDocumentLines(buffer: ArrayBuffer): Promise<string[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const file = zip.file("word/document.xml");
  if (!file) return [];
  const xml = await file.async("string");

  const tableLines: string[] = [];
  const bodyWithoutTables = xml.replace(
    /<w:tbl[ >][\s\S]*?<\/w:tbl>/g,
    (match) => {
      tableLines.push(...collectTableLines(match));
      return "";
    }
  );

  const rawLines: string[] = [];
  const PARA_RE = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = PARA_RE.exec(bodyWithoutTables)) !== null) {
    rawLines.push(...collectParagraphLines(pm[0]));
  }
  rawLines.push(...tableLines);

  return rawLines;
}

// ── Prompt construction ────────────────────────────────────────────────────────

function buildExtractionPrompt(rawLines: string[]): string {
  const docContext = rawLines.slice(0, 200).join("\n");

  return `You are an expert document template field extractor for Indonesian official letters (surat dinas, nota dinas, undangan, surat tugas, surat permohonan).

Extract ALL fillable template fields from the document below.

DOCUMENT TEXT (one line per visual element, including table content):
${docContext}

EXTRACTION RULES:
1. Only extract genuinely VARIABLE fields that change per letter — dates, names, numbers, subjects, locations, recipients.
2. NEVER extract static institutional text: phone numbers, addresses, website URLs, institution names, NIP, signatures, kop surat headers.
3. NEVER extract body paragraph prose or table header rows ("No", "Waktu", "Kegiatan", "Nama", "Jabatan", "Barang", "Jumlah").
4. For each field, provide the EXACT text that appears in the document (targetText) so it can be replaced.

EXPECTED FIELD TYPES:
- text   → names, subjects, titles, recipient names, document numbers, attachment counts
- date   → any date (document date, event date, birth date, deadline)
- number → quantities, prices, amounts (e.g. "450", "Rp 5.000")
- email  → email addresses
- phone  → phone numbers, WhatsApp, fax

EXPECTED FIELDS (check ALL of these exist in the document):
- tanggal_surat    → document date (e.g. "29 Januari 2026", "12 Februari 2026")
- nomor_surat      → document reference number (e.g. "101/DST/PL3.A.9/B/PK.01/2026")
- jumlah_lampiran  → attachment count (e.g. "1 (satu) lembar", "1 lembar") — NOT the subject!
- perihal_surat    → letter subject (e.g. "Undangan Sosialisasi dari MSU") — NOT the attachment count!
- nama_penerima    → recipient name/title (e.g. "Orang tua/Wali mahasiswa MSU di Depok")
- tanggal_kegiatan → event date (e.g. "Jumat, 30 Januari 2026", "Sabtu 14 Februari 2026")
- waktu_kegiatan   → event time (e.g. "08.30 s.d. 11.00 WIB", "13.00 s.d. 14.00 WIB")
- tempat_kegiatan  → event venue (e.g. "Aula Gedung PUT sisi kanan", "Online Zoom")

IMPORTANT DISTINCTIONS:
- "Lampiran" value should be the COUNT (e.g. "1 lembar"), NOT the subject line.
- "Perihal" value should be the SUBJECT (e.g. "Undangan Sosialisasi"), NOT the attachment count.
- "Yth." or "Kepada" introduces the recipient name.
- Dates at the top of the letter (before "Yth.") are tanggal_surat.
- Dates in the event details section are tanggal_kegiatan.

Return ONLY a valid JSON array — no markdown, no explanation, no extra text:
[{"name":"field_name","label":"Field Label","type":"text|date|number|email|phone","targetText":"exact text from document","confidence":0.95}]`;
}

// ── Remote inference call ──────────────────────────────────────────────────────

interface ServiceResponseItem {
  name?: string;
  label?: string;
  type?: string;
  targetText?: string;
  confidence?: number;
}

function parseServiceResponse(rawText: string): AutoDetectedField[] | null {
  // Strip accidental markdown fences from the response
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();

  for (const item of parsed as ServiceResponseItem[]) {
    const name = (item.name ?? "").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
    if (!name || name.length < 2 || seen.has(name)) continue;
    seen.add(name);

    const targetText = (item.targetText ?? "").trim() || undefined;
    const type = (
      ["text", "date", "number", "email", "phone"].includes(item.type ?? "")
        ? item.type
        : "text"
    ) as AutoFieldType;

    fields.push({
      id: `af_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      name,
      label: item.label || name,
      type,
      required: true,
      placeholder: `{{${name}}}`,
      confidence: 1,
      source: "ai_primary",
      targetText,
      contextText: targetText,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields.length > 0 ? fields : null;
}

async function callExtractionService(
  rawLines: string[]
): Promise<AutoDetectedField[] | null> {
  // [DEV] Set OFFLINE_DETECTION=true in .env.local to force L3 fallback
  // without touching the actual service key. For local testing only.
  if (process.env.OFFLINE_DETECTION === "true") return null;

  if (!AI_EXTRACTION_KEY) return null;

  try {
    const res = await fetch(`${AI_ENDPOINT}?key=${AI_EXTRACTION_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildExtractionPrompt(rawLines) }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      console.warn(
        `[document-field-analyzer] Remote service returned HTTP ${res.status} — using offline fallback`
      );
      return null;
    }

    const data = await res.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    const fields = parseServiceResponse(rawText);
    if (!fields) {
      console.warn(
        "[document-field-analyzer] Could not parse service response — using offline fallback"
      );
    }
    return fields;
  } catch (err) {
    console.warn(
      "[document-field-analyzer] Remote service call failed:",
      err,
      "— using offline fallback"
    );
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Extract all fillable template fields from a DOCX buffer.
 *
 * Attempts remote AI extraction first for high-accuracy results.
 * Falls back silently to offline rule-based detection when the remote
 * service is unavailable (no key configured, rate-limited, or unreachable).
 */
export async function analyzeDocumentFields(
  buffer: ArrayBuffer
): Promise<AutoDetectedField[]> {
  const rawLines = await extractDocumentLines(buffer);

  // Primary: remote inference
  const aiFields = await callExtractionService(rawLines);
  if (aiFields && aiFields.length > 0) return aiFields;

  // Fallback: offline rule-based detection
  return autoDetectFields(buffer);
}
