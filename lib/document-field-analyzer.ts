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
 * DESIGN CONSTRAINT — AI output must stay aligned with L3:
 *   The AI prompt is intentionally constrained to the same structural
 *   rules as the L3 rule-based detector. This means:
 *     · Only "Label : Value" pairs, standalone dates, and recipient blocks
 *       are extracted — not free-form prose inference.
 *     · Field names follow the same canonical table as normalizeFieldName()
 *       in auto-field-detector.ts.
 *     · Repeating label blocks produce indexed fields (nama_1 / nama_2)
 *       matching the two-pass indexing logic in detectLabelColon().
 *   This alignment ensures the field review UI behaves consistently
 *   regardless of which detection path ran.
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

const AI_EXTRACTION_KEY: string | undefined =
  process.env.AI_EXTRACTION_KEY ?? process.env.GEMINI_API_KEY;

const AI_MODEL: string = process.env.AI_MODEL ?? "gemini-2.5-flash-lite";

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
    if (cells.length === 0) continue;

    // Two-column rows: synthesise an explicit "Label : Value" colon pair.
    // This is critical for correct detection of repeated label blocks
    // (e.g. multiple Nama/NIP/Pangkat/Jabatan entries in Surat Tugas).
    // Without the colon pair, the AI sees identical space-joined strings
    // for same-value fields (e.g. two people with the same pangkat/jabatan)
    // and incorrectly deduplicates them into a single field.
    // Matching the same synthesis logic used by extractTableLines() in
    // auto-field-detector.ts keeps both paths consistent.
    if (cells.length === 2) {
      lines.push(`${cells[0]} : ${cells[1]}`);
    }

    // For wider tables, include the space-joined row for context
    if (cells.length > 2) lines.push(cells.join(" "));

    // Always include individual cell text as well
    lines.push(...cells);
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
//
// DESIGN NOTE:
//   The prompt is deliberately constrained to mirror the structural rules
//   of the L3 rule-based detector (auto-field-detector.ts). This prevents
//   the AI from "going too smart" and inferring fields from free-form prose,
//   which would produce results inconsistent with L3 and confuse users when
//   they switch between AI-detected and rule-based results.
//
//   The key constraints enforced in the prompt:
//     1. Only extract from explicit "Label : Value" pairs, standalone dates,
//        and clear recipient blocks — not from body prose.
//     2. Field names must follow the same canonical table as normalizeFieldName()
//        in auto-field-detector.ts.
//     3. Repeated labels → indexed names (nama_1/nama_2) matching L3's two-pass
//        logic.
//     4. Institutional text (phone, URL, signing official's NIP) is excluded,
//        same as L3's HEADER_NOISE_LABELS and isInstitutionalValue().

function buildExtractionPrompt(rawLines: string[]): string {
  const docContext = rawLines.slice(0, 200).join("\n");

  return `You are a document template field extractor for Indonesian official letters.

DOCUMENT TEXT (one line per visual element — paragraphs and table rows):
${docContext}

━━━ STEP 1 — IDENTIFY DOCUMENT TYPE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Classify as ONE of:
  undangan | surat_tugas | nota_dinas | pengumuman | surat_permohonan | surat_kuasa | other

━━━ STEP 2 — DETECT FILLABLE FIELDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ONLY extract fields found in these three structural patterns:
  A) Explicit "Label : Value" pairs — e.g. "Nomor  : 101/DST/2026"
  B) Standalone date lines           — e.g. "29 Januari 2026" (top of letter)
  C) Recipient blocks                — lines after "Yth." or "Kepada Yth."

DO NOT extract:
  ✗ Fields inferred from body paragraph prose (e.g. names mentioned in a sentence)
  ✗ Institutional letterhead data: institution name, phone, fax, URL, address
  ✗ NIP / signature of the signing official at the bottom
  ✗ Table header rows ("No", "Waktu", "Kegiatan", "Nama", "Jabatan" AS HEADERS)
  ✗ Static labels that never change between letters

━━━ STEP 3 — HANDLE REPEATED LABEL BLOCKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the same label (e.g. "Nama", "NIP", "Jabatan") appears MORE THAN ONCE
in the document (e.g. a Surat Tugas listing two or more assigned staff):

  - Create INDEXED fields using suffix _1, _2, etc.
  - The first occurrence becomes field_1, the second becomes field_2, and so on.
  - If a label appears only once, use NO suffix.
  - NEVER reuse the same field name — every output item must have a unique name.

  CRITICAL — INDEX BY POSITION, NOT BY VALUE UNIQUENESS:
  Even if two or more occurrences of a label have IDENTICAL values
  (e.g. two staff members with the same pangkat/golongan or the same jabatan),
  you MUST still create a SEPARATE indexed field for each occurrence.
  They belong to DIFFERENT persons and must be filled independently.
  DO NOT merge or deduplicate based on identical targetText values.

  Example (Surat Tugas, two dosen with same pangkat and jabatan):

    Nama               : Fajar Septian, M.Kom.
    NIP                : 198909092025061002
    Pangkat dan Golongan : III/b-Penata Muda Tingkat I
    Jabatan            : Dosen Jurusan Teknik Informatika dan Komputer
    Nama               : Dwi Ermawati, M.T.
    NIP                : 199106202025062002
    Pangkat dan Golongan : III/b-Penata Muda Tingkat I
    Jabatan            : Dosen Jurusan Teknik Informatika dan Komputer

  Correct output — 8 separate fields, one per occurrence:
    nama_1 / Nama 1 / Fajar Septian, M.Kom.
    nip_1 / NIP 1 / 198909092025061002
    pangkat_golongan_1 / Pangkat Golongan 1 / III/b-Penata Muda Tingkat I
    jabatan_1 / Jabatan 1 / Dosen Jurusan Teknik Informatika dan Komputer
    nama_2 / Nama 2 / Dwi Ermawati, M.T.
    nip_2 / NIP 2 / 199106202025062002
    pangkat_golongan_2 / Pangkat Golongan 2 / III/b-Penata Muda Tingkat I
    jabatan_2 / Jabatan 2 / Dosen Jurusan Teknik Informatika dan Komputer

  WRONG (DO NOT merge same-value entries):
    pangkat_golongan_1 only — missing _2
    jabatan_1 only — missing _2

━━━ CANONICAL FIELD NAMES (use exactly these — no variations) ━━━━━━━━━━━━━━━
Universal (all document types):
  tanggal_surat      → document date at the top of the letter (Pattern B)
  nomor_surat        → reference/document number
  jumlah_lampiran    → attachment count ("1 lembar", "2 (dua) lembar")
  perihal_surat      → letter subject / topic

Undangan:
  nama_penerima      → recipient name/title (after "Yth." — Pattern C only)
  tanggal_kegiatan   → event date (inside letter body, "hari/tanggal" label)
  waktu_kegiatan     → event time ("waktu" or "pukul" label)
  tempat_kegiatan    → event venue ("tempat" or "lokasi" label)

Surat Tugas / SK / Personnel:
  nama               → person name (indexed if repeated: nama_1, nama_2 …)
  nip                → NIP number (indexed if repeated: nip_1, nip_2 …)
  pangkat_golongan   → rank and grade (indexed: pangkat_golongan_1 …)
  jabatan            → position / title (indexed: jabatan_1 …)
  kegiatan_tugas     → task/activity description

IMPORTANT DISTINCTIONS:
  · "Lampiran" value = the COUNT (e.g. "1 lembar"), NOT the subject line.
  · "Perihal" value = the SUBJECT, NOT the attachment count.
  · tanggal_surat = date at TOP of letter (before "Yth.").
  · tanggal_kegiatan = date in the event details section (inside body).
  · NIP of the SIGNING OFFICIAL at the bottom → DO NOT extract (static).
  · NIP of ASSIGNED STAFF in Surat Tugas body → DO extract (variable).

━━━ FIELD TYPES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  text   → ALL non-date values: names, reference numbers, NIP, pangkat,
           jabatan, addresses, phone numbers, email addresses, amounts —
           the template engine applies identical string substitution for all
           of these, so there is no distinction between sub-types.
  date   → any date or time value (document date, event date, time)

━━━ OUTPUT FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY a valid JSON array — no markdown fences, no explanation, nothing else:
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
