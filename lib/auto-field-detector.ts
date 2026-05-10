/**
 * lib/auto-field-detector.ts
 *
 * Layer-3 deterministic rule-based field detection for DOCX template documents.
 *
 * Operates entirely offline via structural pattern analysis of the document XML.
 * No external services, no machine learning, no probabilistic scoring.
 * All detection is performed through deterministic pattern matching.
 *
 * Supported document conventions:
 *   · Indonesian official letters (surat dinas, nota dinas, undangan,
 *     surat tugas, surat permohonan, surat kuasa)
 *   · Generic form documents (invoice, contract, work order)
 *   · PDF-converted DOCX with fragmented line structure
 *
 * Detection patterns (processed in priority order):
 *   A — Standalone date paragraphs     ("29 Januari 2026", "Jakarta, 12 Feb 2026")
 *   B — "Label : Value" colon pairs    ("Nomor  : 101/DST/…", "Perihal : …")
 *   C — Recipient blocks               ("Yth.", "Kepada", "Kepada Yth.")
 *   D — Underline / dash blank fields  ("Nama  ___________")
 *   E — Form-style empty brackets      ("[ ] Setuju", "Pilihan : ( )")
 *
 * Table handling:
 *   · Two-column table rows are synthesised into "Label : Value" pairs
 *     and fed into Pattern B, enabling detection without a separate table pass.
 *   · Multi-column table content is also included as individual cell lines.
 *
 * This module is the fallback detector used when the remote extraction
 * service (lib/document-field-analyzer.ts) is unavailable.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type AutoFieldType =
  | "text"
  | "date"
  | "number"
  | "email"
  | "phone"
  | "loop"
  | "condition"
  | "condition_inverse";

export interface AutoDetectedField {
  id: string;
  name: string;
  label: string;
  type: AutoFieldType;
  required: boolean;
  placeholder: string;
  /**
   * Retained for interface compatibility with the review UI.
   * Always 1.0 for this module — no probabilistic scoring is performed.
   */
  confidence: number;
  /** Which pattern produced this field. */
  source:
    | "label_colon" // Pattern B
    | "underline_blank" // Pattern D
    | "form_box" // Pattern E
    | "standalone_date" // Pattern A
    | "recipient_block" // Pattern C
    | "ai_primary" // Remote extraction service (see document-field-analyzer.ts)
    | "manual"; // User-written {{placeholder}} syntax
  /** Exact raw text the DOCX injector should replace. */
  targetText?: string;
  /** Paragraph text used to scope replacement when targetText is ambiguous. */
  contextText?: string;
  /** Explicit DOCX replacement; defaults to placeholder when omitted. */
  replacementText?: string;
  /** Placeholder before user edits the field in the review step. */
  originalPlaceholder?: string;
  subFields?: Omit<AutoDetectedField, "subFields">[];
}

// ── XML utilities ──────────────────────────────────────────────────────────────

function makeId(): string {
  return `af_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function decodeXmlEntities(t: string): string {
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

function extractText(xml: string): string {
  const parts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) parts.push(decodeXmlEntities(m[1]));
  return parts.join("").trim();
}

/**
 * Split one <w:p> into visual lines.
 * Handles PDF-converted DOCX where <w:br/> splits lines inside one paragraph.
 */
function extractParagraphLines(paragraphXml: string): string[] {
  const lines: string[] = [];
  let current = "";

  const tokenRe = /(<w:br(?:\s[^>]*)?\/>)|(<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>)/g;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(paragraphXml)) !== null) {
    if (m[1]) {
      const isPageBreak =
        m[1].includes('type="page"') || m[1].includes("type='page'");
      if (!isPageBreak) {
        if (current.trim()) lines.push(current.trim());
        current = "";
      }
    } else if (m[3] !== undefined) {
      current += decodeXmlEntities(m[3]);
    }
  }

  if (current.trim()) lines.push(current.trim());
  return lines.filter(Boolean);
}

// ── Field-name normalisation ───────────────────────────────────────────────────

function toSlug(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[*:（）\[\]\/\\]/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "field"
  );
}

/**
 * Map common Indonesian official-letter label variants to canonical
 * field names used throughout the template system.
 */
function normalizeFieldName(rawLabel: string, fallback: string): string {
  const key = rawLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (/^(nomor|no|no_surat|nomer|number)$/.test(key)) return "nomor_surat";
  if (/^lampiran$/.test(key)) return "jumlah_lampiran";
  if (/^(kepada|penerima|nama_penerima|yth|ditujukan)$/.test(key))
    return "nama_penerima";
  if (/^(hari_tanggal|tanggal|tgl|tanggal_surat)$/.test(key))
    return "tanggal_kegiatan";
  if (/^(waktu|pukul|jam)$/.test(key)) return "waktu_kegiatan";
  if (/^(tempat|lokasi|ruang|ruangan|venue|tempat_kegiatan)$/.test(key))
    return "tempat_kegiatan";
  if (/^(perihal|hal|pokok_surat|subject|re)$/.test(key))
    return "perihal_surat";

  return fallback;
}

function fieldNameFromLabel(rawLabel: string): string {
  return normalizeFieldName(rawLabel, toSlug(rawLabel));
}

// ── Structural predicates ──────────────────────────────────────────────────────

function isBlank(text: string): boolean {
  const t = text.trim();
  return (
    !t ||
    /^[_\-\.…]{2,}$/.test(t) ||
    /^\s+$/.test(t) ||
    /^(\(|\[)\s*(\)|\])$/.test(t)
  );
}

function isHeaderFooterNoise(text: string): boolean {
  return [
    /^page\s*\d+/i,
    /^\d+\s*of\s*\d+/i,
    /^(confidential|draft|internal|private)/i,
    /^(approved by|prepared by|reviewed by)/i,
    /^(date|time):?\s*$/i,
    /^(doc|document)\s*(no|number|#)/i,
    /^rev(ision)?\.?\s*\d+/i,
  ].some((re) => re.test(text.trim()));
}

/**
 * Labels that belong to the institutional letterhead — not fillable fields.
 * These appear in kop surat (letterhead) and should never become placeholders.
 */
const HEADER_NOISE_LABELS = new Set([
  "laman",
  "website",
  "web",
  "url",
  "telepon",
  "telp",
  "telephone",
  "fax",
  "faks",
  "facsimile",
  "e_pos",
  "epos",
  "e_mail",
  "email",
  "alamat",
  "address",
  "jalan",
  "jl",
]);

function isInstitutionalValue(value: string): boolean {
  const v = value.trim();
  return (
    /^https?:\/\//i.test(v) ||
    /^www\./i.test(v) ||
    /^\(\d{2,4}\)\s*\d{5,}/.test(v)
  );
}

// ── Field type inference (keyword-based, deterministic) ────────────────────────
//
// Maps label words to field types using fixed keyword sets.
// No probabilistic scoring — each keyword maps to exactly one type.

const DATE_KEYWORDS = new Set([
  "tanggal",
  "tgl",
  "hari",
  "bulan",
  "tahun",
  "date",
  "waktu",
  "time",
  "pukul",
  "jam",
  "deadline",
  "lahir",
  "birth",
  "mulai",
  "selesai",
  "hingga",
  "sampai",
  "periode",
  "masa",
  "tempo",
  "dari",
  "until",
  "jatuh",
  "expiry",
  "expiration",
  "valid",
  "start",
  "end",
]);

const NUMBER_KEYWORDS = new Set([
  "harga",
  "price",
  "jumlah",
  "amount",
  "total",
  "qty",
  "quantity",
  "nilai",
  "biaya",
  "cost",
  "bayar",
  "nominal",
  "angka",
  "gaji",
  "salary",
  "upah",
  "wage",
  "tarif",
  "rate",
  "diskon",
  "discount",
  "subtotal",
  "pajak",
  "tax",
  "ppn",
  "vat",
  "fee",
  "charge",
  "sum",
  "budget",
  "anggaran",
]);

const EMAIL_KEYWORDS = new Set(["email", "e_mail", "surel", "mail"]);

const PHONE_KEYWORDS = new Set([
  "telepon",
  "telp",
  "phone",
  "hp",
  "handphone",
  "mobile",
  "whatsapp",
  "wa",
  "fax",
  "faks",
  "kontak",
  "contact",
]);

function inferFieldType(rawLabel: string): AutoFieldType {
  const words = rawLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // "Nomor" / "No." fields are document reference numbers — always text.
  if (words.includes("nomor") || (words.length <= 2 && words.includes("no")))
    return "text";

  for (const word of words) {
    if (DATE_KEYWORDS.has(word)) return "date";
    if (NUMBER_KEYWORDS.has(word)) return "number";
    if (EMAIL_KEYWORDS.has(word)) return "email";
    if (PHONE_KEYWORDS.has(word)) return "phone";
  }

  return "text";
}

// ── PDF split-line reconstruction ──────────────────────────────────────────────
//
// PDF-to-DOCX conversion often produces fragmented lines where a single
// "Label : Value" pair is split across multiple paragraphs, e.g.:
//
//   Line 0: "Nomor"
//   Line 1: ":"
//   Line 2: "101/DST/2026"
//
// reconstructSplitLines() merges these back into canonical pairs.

const ID_MONTHS =
  "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember";

const STANDALONE_DATE_RES = [
  // "29 Januari 2026"
  new RegExp(`^\\d{1,2}\\s+(${ID_MONTHS})\\s+\\d{4}$`, "i"),
  // "Jakarta, 29 Januari 2026"
  new RegExp(`^\\w[\\w\\s]*,\\s+\\d{1,2}\\s+(${ID_MONTHS})\\s+\\d{4}$`, "i"),
  // "2026-01-29"
  /^\d{4}-\d{2}-\d{2}$/,
  // "29/01/2026"
  /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/,
];

function isStandaloneDateLine(t: string): boolean {
  return STANDALONE_DATE_RES.some((re) => re.test(t.trim()));
}

function isLabelCandidate(t: string): boolean {
  const trimmed = t.trim();
  return (
    trimmed.length >= 2 &&
    trimmed.length <= 60 &&
    !trimmed.includes(":") &&
    !trimmed.includes("：") &&
    trimmed.split(/\s+/).length <= 7 &&
    !isStandaloneDateLine(trimmed)
  );
}

function reconstructSplitLines(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const cur = lines[i].trim();
    const next = i + 1 < lines.length ? lines[i + 1].trim() : null;

    // Skip lines that are only a colon separator
    if (/^[:：]\s*$/.test(cur)) {
      i++;
      continue;
    }

    // Case 1: "Label" + ": Value" (colon leads next line)
    if (
      next !== null &&
      /^[:：]/.test(next) &&
      !/^[:：]\s*$/.test(next) &&
      isLabelCandidate(cur)
    ) {
      result.push(`${cur} : ${next.replace(/^[:：]\s*/, "").trim()}`);
      i += 2;
      continue;
    }

    // Case 2: "Label :" + "Value" (colon trails current line, value on next)
    if (next !== null && /[:：]\s*$/.test(cur) && !/^[:：]/.test(next)) {
      const nextLooksLikeLabel =
        !next.includes(":") &&
        !next.includes("：") &&
        next.split(/\s+/).length <= 3 &&
        next.length <= 30;

      if (!nextLooksLikeLabel) {
        result.push(`${cur} ${next}`.trim());
        i += 2;
        continue;
      }
    }

    result.push(cur);
    i++;
  }

  return result.filter(Boolean);
}

// ── Pattern A — Standalone date ────────────────────────────────────────────────

function detectStandaloneDate(lines: string[]): AutoDetectedField[] {
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes(":") || line.includes("：")) continue;
    if (line.length > 45) continue;
    if (!isStandaloneDateLine(line)) continue;

    return [
      {
        id: makeId(),
        name: "tanggal_surat",
        label: "Tanggal Surat",
        type: "date",
        required: true,
        placeholder: "{{tanggal_surat}}",
        confidence: 1,
        source: "standalone_date",
        targetText: line,
        contextText: line,
        originalPlaceholder: "{{tanggal_surat}}",
      },
    ];
  }
  return [];
}

// ── Pattern B — Label : Value ──────────────────────────────────────────────────

function detectLabelColon(lines: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();

  // Match "Label : Value" or "Label :" (value may be absent / blank)
  const LINE_RE = /^([^\n\r:：]{2,60}?)\s*[:：]\s*(.{0,120})?$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length > 160) continue;
    if (isHeaderFooterNoise(line)) continue;

    const match = LINE_RE.exec(line);
    if (!match) continue;

    const rawLabel = match[1].trim();
    const rawValue = (match[2] ?? "").trim();

    // Label quality gates — reject noise, sentence fragments, numeric prefixes
    if (rawLabel.split(/\s+/).length > 7) continue;
    if (/[.!?;،]/.test(rawLabel.slice(0, -1))) continue;
    if (rawLabel.length < 2) continue;
    if (/^\d/.test(rawLabel)) continue;
    if (/^\d+[\/\-\.]\d+/.test(rawLabel)) continue;

    const labelSlug = toSlug(rawLabel);
    if (HEADER_NOISE_LABELS.has(labelSlug)) continue;
    if (rawValue && isInstitutionalValue(rawValue)) continue;

    const cleanLabel = rawLabel.replace(/[:*]/g, "").trim();
    const name = fieldNameFromLabel(cleanLabel);
    if (!name || name === "field" || name.length < 2) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    fields.push({
      id: makeId(),
      name,
      label: cleanLabel,
      type: inferFieldType(rawLabel),
      required: true,
      placeholder: `{{${name}}}`,
      confidence: 1,
      source: "label_colon",
      targetText: rawValue || undefined,
      contextText: line,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields;
}

// ── Pattern C — Recipient block ────────────────────────────────────────────────

function detectRecipientBlocks(lines: string[]): AutoDetectedField[] {
  // Lines that look like address/location components — not the recipient name
  const IGNORED_LINE =
    /^(di\s+|tempat\b|alamat\b|perihal\b|hal\b|lampiran\b|nomor\b)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!/^(kepada|kepada\s+yth\.?|yth\.?)\b/i.test(line)) continue;

    // Inline form: "Yth. Dr. Budi Santoso, M.Eng."
    const inline = line.match(/^(?:kepada\s+)?yth\.?\s+(.{3,80})$/i);
    if (inline) {
      const candidate = inline[1].trim();
      if (
        !IGNORED_LINE.test(candidate) &&
        !isHeaderFooterNoise(candidate) &&
        !/[:{}]/.test(candidate)
      ) {
        return [
          {
            id: makeId(),
            name: "nama_penerima",
            label: "Nama Penerima",
            type: "text",
            required: true,
            placeholder: "{{nama_penerima}}",
            confidence: 1,
            source: "recipient_block",
            targetText: candidate,
            contextText: candidate,
            originalPlaceholder: "{{nama_penerima}}",
          },
        ];
      }
    }

    // Block form: recipient name appears on the next line(s)
    const candidate = lines
      .slice(i + 1, i + 5)
      .map((l) => l.trim())
      .find(
        (l) =>
          l.length >= 3 &&
          l.length <= 80 &&
          !IGNORED_LINE.test(l) &&
          !isHeaderFooterNoise(l) &&
          !/[:{}]/.test(l)
      );

    if (candidate) {
      return [
        {
          id: makeId(),
          name: "nama_penerima",
          label: "Nama Penerima",
          type: "text",
          required: true,
          placeholder: "{{nama_penerima}}",
          confidence: 1,
          source: "recipient_block",
          targetText: candidate,
          contextText: candidate,
          originalPlaceholder: "{{nama_penerima}}",
        },
      ];
    }
  }

  return [];
}

// ── Pattern D — Underline blanks ───────────────────────────────────────────────

function detectUnderlineBlanks(lines: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();

  // Match "Label  _________" or "Label  ---------" or "Label  ........."
  const LINE_RE = /^([^\n\r_\-\.]{2,40}?)\s+([_\-\.…]{3,80})\s*$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length > 130) continue;
    if (isHeaderFooterNoise(line)) continue;

    const match = LINE_RE.exec(line);
    if (!match) continue;

    const rawLabel = match[1].trim();
    if (rawLabel.split(/\s+/).length > 7) continue;
    if (/[.!?;،]/.test(rawLabel.slice(0, -1))) continue;
    if (rawLabel.length < 2) continue;
    if (/^\d/.test(rawLabel)) continue;

    const cleanLabel = rawLabel.replace(/[:*]/g, "").trim();
    const name = fieldNameFromLabel(cleanLabel);
    if (!name || name === "field" || name.length < 2) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    fields.push({
      id: makeId(),
      name,
      label: cleanLabel,
      type: inferFieldType(rawLabel),
      required: true,
      placeholder: `{{${name}}}`,
      confidence: 1,
      source: "underline_blank",
      targetText: match[2]?.trim() || undefined,
      contextText: line,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields;
}

// ── Pattern E — Form boxes / checkboxes ───────────────────────────────────────

function detectFormBoxes(lines: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();

  const CHECKBOX_RE = /^(?:[☐□▢\[\(]\s*[\]\)]?\s+)([^\n\r]{1,60})$/;
  const BOX_RE = /^([^\n\r:（(]{2,40}?)\s*[:：]\s*[\[\(]\s*[\]\)]\s*$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length > 100) continue;

    const match = CHECKBOX_RE.exec(line) ?? BOX_RE.exec(line);
    if (!match) continue;

    const rawLabel = match[1].trim();
    if (rawLabel.length < 2 || rawLabel.length > 60) continue;
    if (/^\d/.test(rawLabel)) continue;

    const cleanLabel = rawLabel.replace(/[:*]/g, "").trim();
    const name = fieldNameFromLabel(cleanLabel);
    if (!name || name === "field" || name.length < 2) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    fields.push({
      id: makeId(),
      name,
      label: cleanLabel,
      type: inferFieldType(rawLabel),
      required: false,
      placeholder: `{{${name}}}`,
      confidence: 1,
      source: "form_box",
      targetText: line,
      contextText: line,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields;
}

// ── Table content extraction ───────────────────────────────────────────────────

function extractTableLines(xml: string): string[] {
  const lines: string[] = [];
  const ROW_RE = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = ROW_RE.exec(xml)) !== null) {
    const rowXml = rowMatch[0];
    const CELL_RE = /<w:tc[ >][\s\S]*?<\/w:tc>/g;
    let cellMatch: RegExpExecArray | null;
    const cells: string[] = [];

    while ((cellMatch = CELL_RE.exec(rowXml)) !== null) {
      const cellText = extractText(cellMatch[0]);
      if (cellText) cells.push(cellText);
    }

    if (cells.length === 0) continue;

    // Two-column rows are the primary carrier of label:value pairs in
    // Indonesian official letters. Synthesise a colon-pair line so Pattern B
    // can pick them up without a dedicated table-specific pattern.
    if (cells.length === 2) {
      lines.push(`${cells[0]} : ${cells[1]}`);
    }

    // Also include the row as joined text and individual cells
    if (cells.length > 2) lines.push(cells.join(" "));
    lines.push(...cells);
  }

  return lines.filter((l) => l.length > 0 && l.length < 200);
}

// ── Deduplication ─────────────────────────────────────────────────────────────
//
// When the same field name is found by multiple patterns, the pattern with
// the higher structural specificity wins. Priority is defined by the order
// below — lower index = higher priority.

const PATTERN_PRIORITY: Array<AutoDetectedField["source"]> = [
  "standalone_date", // most specific: exact date text
  "label_colon", // high reliability: explicit colon separator
  "recipient_block", // specific to addressee blocks
  "underline_blank", // reliable but less specific
  "form_box", // lowest: most ambiguous
];

function deduplicateByPriority(
  candidates: AutoDetectedField[]
): AutoDetectedField[] {
  const byName = new Map<string, AutoDetectedField>();

  for (const field of candidates) {
    const existing = byName.get(field.name);
    if (!existing) {
      byName.set(field.name, field);
      continue;
    }

    const existingRank = PATTERN_PRIORITY.indexOf(
      existing.source as (typeof PATTERN_PRIORITY)[number]
    );
    const newRank = PATTERN_PRIORITY.indexOf(
      field.source as (typeof PATTERN_PRIORITY)[number]
    );

    // A lower index means higher priority; −1 means not in the list (lowest)
    if (newRank !== -1 && (existingRank === -1 || newRank < existingRank)) {
      byName.set(field.name, field);
    }
  }

  return [...byName.values()];
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Detect all fillable template fields in a DOCX buffer using Layer-3
 * structural pattern matching (offline, deterministic).
 *
 * Used directly by the remote extraction service (document-field-analyzer.ts)
 * as its fallback strategy when the remote inference endpoint is unavailable.
 */
export async function autoDetectFields(
  buffer: ArrayBuffer
): Promise<AutoDetectedField[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const file = zip.file("word/document.xml");
  if (!file) return [];
  const xml = await file.async("string");

  // Strip tables from the body for paragraph scanning; collect table lines
  // separately so they are not double-processed.
  const tableLines: string[] = [];
  const bodyWithoutTables = xml.replace(
    /<w:tbl[ >][\s\S]*?<\/w:tbl>/g,
    (match) => {
      tableLines.push(...extractTableLines(match));
      return "";
    }
  );

  // Collect visual lines from body paragraphs
  const rawLines: string[] = [];
  const PARA_RE = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = PARA_RE.exec(bodyWithoutTables)) !== null) {
    rawLines.push(...extractParagraphLines(pm[0]));
  }
  rawLines.push(...tableLines);

  // Merge fragmented lines produced by PDF→DOCX converters
  const lines = reconstructSplitLines(rawLines);

  // Run all patterns and resolve conflicts by structural priority
  const candidates: AutoDetectedField[] = [
    ...detectStandaloneDate(lines),
    ...detectLabelColon(lines),
    ...detectRecipientBlocks(lines),
    ...detectUnderlineBlanks(lines),
    ...detectFormBoxes(lines),
  ];

  return deduplicateByPriority(candidates);
}
