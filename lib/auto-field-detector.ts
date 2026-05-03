/**
 * lib/auto-field-detector.ts
 *
 * Automatic field detection from DOCX documents using 2 layers of rules:
 *
 * L3 — Structural Rules (visual document structure analysis):
 *   · Pattern A : "Label : _______" lines  → extract label as field name
 *   · Pattern B : 2-column tables (label | empty/fillable) → each row = 1 field
 *   · Pattern C : Tables with header + repeating empty rows → loop field
 *   · Pattern D : Underline blanks after labels (no colon)
 *   · Pattern E : Form-style boxes / checkbox areas
 *
 * L5 — Lexical Rules (label text & value analysis):
 *   · Dictionary : "date" → date, "email" → email, "price" → number, etc.
 *   · Format regex: value "15/01/2025" → date, "$5,000" → number, etc.
 *   · Multi-language support (EN + ID)
 *
 * Purely rule-based, deterministic. No ML / AI.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AutoFieldType =
  | "text"
  | "date"
  | "number"
  | "email"
  | "phone"
  | "loop"
  | "condition"
  | "condition_inverse";

type InferredFieldType = "date" | "number" | "email" | "phone";

export interface AutoDetectedField {
  id: string;
  name: string;
  label: string;
  type: AutoFieldType;
  required: boolean;
  placeholder: string;
  /** 0.0 – 1.0, used in review UI for confidence indicator */
  confidence: number;
  /** Which pattern detected this field */
  source:
    | "label_colon"
    | "table_2col"
    | "table_loop"
    | "underline_blank"
    | "form_box"
    | "recipient_block"
    | "manual";
  /** Exact raw text the DOCX injector should replace, when available. */
  targetText?: string;
  /** Paragraph/cell text used to scope replacement when targetText is ambiguous. */
  contextText?: string;
  /** Explicit DOCX replacement. Defaults to placeholder when omitted. */
  replacementText?: string;
  /** Placeholder found/generated before user edits the field in review. */
  originalPlaceholder?: string;
  subFields?: Omit<AutoDetectedField, "subFields">[];
}

// ── Utilities ─────────────────────────────────────────────────────────────────

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

/** Collect all <w:t> in a single XML fragment */
function extractText(xml: string): string {
  const parts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) parts.push(decodeXmlEntities(m[1]));
  return parts.join("").trim();
}

/** "Full Name" → "full_name" */
function toName(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[*:：（）\[\]\/\\]/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "field"
  );
}

/** "full_name" → "Full Name" */
function normalizeBusinessFieldName(rawLabel: string, baseName: string): string {
  const compact = rawLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (compact === "nomor" || compact === "no" || compact === "no_surat") {
    return "nomor_surat";
  }
  if (compact === "lampiran") {
    return "jumlah_lampiran";
  }
  if (/^(kepada|penerima|nama_penerima|yth)$/.test(compact)) {
    return "nama_penerima";
  }

  return baseName;
}

function fieldNameFromLabel(rawLabel: string): string {
  return normalizeBusinessFieldName(rawLabel, toName(rawLabel));
}

/** Does this text look like a "blank area"? (___, ..., etc.) */
function isBlank(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^[_\-\.…]{2,}$/.test(t)) return true;
  if (/^\s+$/.test(t)) return true;
  // Common fillable indicators
  if (/^(\(|\[)\s*(\)|\])$/.test(t)) return true; // () or []
  return false;
}

/** Is this text a likely header/footer element (not a field)? */
function isHeaderFooterNoise(text: string): boolean {
  const t = text.trim().toLowerCase();
  const noisePatterns = [
    /^page\s*\d+/i,
    /^\d+\s*of\s*\d+/i,
    /^(confidential|draft|internal|private)/i,
    /^(approved by|prepared by|reviewed by)/i,
    /^(date|time):?\s*$/i,
    /^(doc|document)\s*(no|number|#)/i,
    /^rev(ision)?\.?\s*\d+/i,
  ];
  return noisePatterns.some((re) => re.test(t));
}

// ── L5 — Dictionary & format inference ───────────────────────────────────────

const LABEL_DICT: Record<InferredFieldType, string[]> = {
  date: [
    "date",
    "tanggal",
    "tgl",
    "waktu",
    "time",
    "bulan",
    "month",
    "tahun",
    "year",
    "hari",
    "day",
    "periode",
    "period",
    "masa",
    "jatuh",
    "tempo",
    "deadline",
    "lahir",
    "birth",
    "dob",
    "expiry",
    "expiration",
    "valid",
    "until",
    "sampai",
    "dari",
    "from",
    "to",
    "sampai",
    "hingga",
    "start",
    "end",
    "mulai",
    "selesai",
  ],
  number: [
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
    "pay",
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
    "tax",
    "pajak",
    "ppn",
    "vat",
    "fee",
    "charge",
    "sum",
    "jumlah",
    "nilai",
    "budget",
    "anggaran",
    "estimate",
    "estimasi",
    "quotation",
    "quote",
    "harga",
  ],
  email: [
    "email",
    "e_mail",
    "surel",
    "mail",
    "elektronik",
    "electronic",
    "e-mail",
  ],
  phone: [
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
    "contact",
    "kontak",
    "no",
    "number",
    "tel",
    "cell",
  ],
};

/** L5: type from label (dictionary) */
function inferTypeFromLabel(label: string): AutoFieldType {
  const name = toName(label);
  if (name === "nomor" || name === "no" || name.includes("surat")) {
    return "text";
  }
  for (const [type, keywords] of Object.entries(LABEL_DICT) as [
    InferredFieldType,
    string[],
  ][]) {
    if (keywords.some((kw) => name.includes(kw))) return type;
  }
  return "text";
}

/** L5: type from sample value (format regex) */
function inferTypeFromValue(value: string): AutoFieldType | null {
  const v = value.trim();
  if (v.length < 2) return null;
  if (/^[\w.+\-]+@[\w.\-]+\.\w{2,}$/.test(v)) return "email";
  if (
    /^(\+62|08|\+1|\+44|\+91|\+33|\+49)\d{7,15}$/.test(
      v.replace(/[\s\-()]/g, "")
    )
  )
    return "phone";
  // Various date formats
  if (
    /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(v) ||
    /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(v) ||
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[,.]?\s*\d{2,4}$/i.test(
      v
    )
  )
    return "date";
  // Currency (IDR, USD, EUR, etc.)
  if (/^(Rp\.?|IDR|USD|\$|€|£)\s?[\d.,]+/i.test(v)) return "number";
  // Pure numbers
  if (/^[\d.,]+$/.test(v) && v.length <= 25) return "number";
  // Percentage
  if (/^[\d.,]+%$/.test(v)) return "number";
  return null;
}

function inferType(label: string, value?: string): AutoFieldType {
  if (value && !isBlank(value)) {
    const fromValue = inferTypeFromValue(value);
    if (fromValue) return fromValue;
  }
  return inferTypeFromLabel(label);
}

// ── L3 — Pattern A: Paragraph "Label : ___" ────────────────────────────────────

function detectLabelColon(paragraphTexts: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();

  // Label: 2–50 chars, then ":" or "：", then optional value/blank
  const re = /^([^\n\r:：]{2,50}?)\s*[:：]\s*(.{0,80})?$/;

  for (const raw of paragraphTexts) {
    const line = raw.trim();
    if (!line || line.length > 130) continue;
    if (isHeaderFooterNoise(line)) continue;

    const match = re.exec(line);
    if (!match) continue;

    const rawLabel = match[1].trim();
    const rawValue = (match[2] ?? "").trim();

    // Filters
    if (rawLabel.split(/\s+/).length > 7) continue;
    if (/[.!?;،]/.test(rawLabel.slice(0, -1))) continue;
    if (rawLabel.length < 2) continue;
    if (/^\d/.test(rawLabel)) continue;
    // Skip if label is just a number or date itself
    if (/^\d+[\/\-\.]\d+/.test(rawLabel)) continue;

    const cleanLabel = rawLabel.replace(/[:*]/g, "").trim();
    const name = fieldNameFromLabel(cleanLabel);
    if (!name || name === "field" || name.length < 2 || seen.has(name))
      continue;
    seen.add(name);

    const type = inferType(rawLabel, rawValue);
    const confidence = isBlank(rawValue) ? 0.85 : 0.72;

    fields.push({
      id: makeId(),
      name,
      label: cleanLabel,
      type,
      required: true,
      placeholder: `{{${name}}}`,
      confidence,
      source: "label_colon",
      targetText: rawValue || undefined,
      contextText: line,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields;
}

// ── L3 — Pattern D: Underline blanks without colon ────────────────────────────

function detectUnderlineBlanks(paragraphTexts: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();

  // Pattern: "Label _____" or "Label ........." (label followed by blanks)
  const re = /^([^\n\r_\-\.]{2,40}?)\s+([_\-\.…]{3,80})\s*$/;

  for (const raw of paragraphTexts) {
    const line = raw.trim();
    if (!line || line.length > 120) continue;
    if (isHeaderFooterNoise(line)) continue;

    const match = re.exec(line);
    if (!match) continue;

    const rawLabel = match[1].trim();
    if (rawLabel.split(/\s+/).length > 7) continue;
    if (/[.!?;،]/.test(rawLabel.slice(0, -1))) continue;
    if (rawLabel.length < 2) continue;
    if (/^\d/.test(rawLabel)) continue;

    const cleanLabel = rawLabel.replace(/[:*]/g, "").trim();
    const name = fieldNameFromLabel(cleanLabel);
    if (!name || name === "field" || name.length < 2 || seen.has(name))
      continue;
    seen.add(name);

    const type = inferType(rawLabel);
    const confidence = 0.78;

    fields.push({
      id: makeId(),
      name,
      label: cleanLabel,
      type,
      required: true,
      placeholder: `{{${name}}}`,
      confidence,
      source: "underline_blank",
      targetText: match[2]?.trim() || undefined,
      contextText: line,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields;
}

// ── L3 — Pattern B: 2-column tables ────────────────────────────────────────────

interface ParsedRow {
  cells: string[];
}

function parseTableRows(tableXml: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const rowRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  let rowM: RegExpExecArray | null;

  while ((rowM = rowRe.exec(tableXml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<w:tc[ >][\s\S]*?<\/w:tc>/g;
    let cellM: RegExpExecArray | null;

    while ((cellM = cellRe.exec(rowM[0])) !== null) {
      cells.push(extractText(cellM[0]));
    }
    if (cells.length > 0) rows.push({ cells });
  }

  return rows;
}

function detect2ColTable(tableXml: string): AutoDetectedField[] {
  const rows = parseTableRows(tableXml);
  if (rows.length < 1) return [];

  // Must be dominated by 2 columns
  const twoColCount = rows.filter((r) => r.cells.length === 2).length;
  if (twoColCount < rows.length * 0.55) return [];

  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.cells.length !== 2) continue;

    const rawLabel = row.cells[0].trim();
    const rawValue = row.cells[1].trim();

    if (!rawLabel || rawLabel.length < 2 || rawLabel.length > 70) continue;
    if (rawLabel.split(/\s+/).length > 7) continue;
    if (/[.!?;]/.test(rawLabel.slice(0, -1))) continue;
    if (/^\d/.test(rawLabel)) continue;
    if (isHeaderFooterNoise(rawLabel)) continue;

    const cleanLabel = rawLabel.replace(/[:*№#]/g, "").trim();
    const name = fieldNameFromLabel(cleanLabel);
    if (!name || name === "field" || name.length < 2 || seen.has(name))
      continue;
    seen.add(name);

    const type = inferType(rawLabel, rawValue);
    const confidence = isBlank(rawValue) ? 0.92 : 0.8;

    fields.push({
      id: makeId(),
      name,
      label: cleanLabel,
      type,
      required: true,
      placeholder: `{{${name}}}`,
      confidence,
      source: "table_2col",
      targetText: rawValue || undefined,
      contextText: rawLabel,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields;
}

// ── L3 — Pattern C: Repeating row tables → loop ───────────────────────────────

function detectLoopTable(tableXml: string): AutoDetectedField | null {
  const rows = parseTableRows(tableXml);
  if (rows.length < 2) return null;

  const colCount = rows[0].cells.length;
  if (colCount < 2) return null;

  // Column consistency
  const consistent = rows.filter((r) => r.cells.length === colCount).length;
  if (consistent < rows.length * 0.65) return null;

  // First row = header: all cells have short text
  const headerRow = rows[0];
  const headerTexts = headerRow.cells.map((c) => c.trim()).filter(Boolean);
  if (headerTexts.length < 2) return null;
  if (!headerTexts.every((h) => h.length < 70 && h.split(/\s+/).length <= 6))
    return null;
  if (headerTexts.some((h) => inferTypeFromValue(h) !== null)) return null;

  // Data rows: mostly blank/empty
  const dataRows = rows.slice(1);
  if (dataRows.length === 0) return null;

  const avgBlankRatio =
    dataRows.reduce((sum, row) => {
      return (
        sum +
        row.cells.filter((c) => isBlank(c)).length /
          Math.max(row.cells.length, 1)
      );
    }, 0) / dataRows.length;

  if (avgBlankRatio < 0.4) return null;

  // Build subfields from header
  const seenSub = new Set<string>();
  const subFields: Omit<AutoDetectedField, "subFields">[] = headerTexts
    .map((h) => {
      const cleanLabel = h.replace(/[#*:№]/g, "").trim();
      const name = fieldNameFromLabel(cleanLabel);
      if (!name || name === "field" || seenSub.has(name)) return null;
      seenSub.add(name);
      return {
        id: makeId(),
        name,
        label: cleanLabel,
        type: inferTypeFromLabel(h),
        required: false,
        placeholder: `{{${name}}}`,
        confidence: 0.82,
        source: "table_loop" as const,
        originalPlaceholder: `{{${name}}}`,
      };
    })
    .filter(Boolean) as Omit<AutoDetectedField, "subFields">[];

  if (subFields.length < 2) return null;

  return {
    id: makeId(),
    name: "items",
    label: "Items",
    type: "loop",
    required: true,
    placeholder: "{{#items}}...{{/items}}",
    confidence: 0.88,
    source: "table_loop",
    originalPlaceholder: "{{#items}}",
    subFields,
  };
}

// ── L3 — Pattern E: Form-style boxes / checkboxes ─────────────────────────────

function detectFormBoxes(paragraphTexts: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();

  // Pattern: "☐ Option" or "□ Option" or "[ ] Option" or "( ) Option"
  const checkboxRe = /^(?:[☐□▢\[\(]\s*[\]\)]?\s+)([^\n\r]{1,60})$/;
  // Pattern: "Label: [    ]" or "Label: (    )"
  const boxRe = /^([^\n\r:（(]{2,40}?)\s*[:：]\s*[\[\(]\s*[\]\)]\s*$/;

  for (const raw of paragraphTexts) {
    const line = raw.trim();
    if (!line || line.length > 100) continue;

    const match = checkboxRe.exec(line) || boxRe.exec(line);
    if (!match) continue;

    const rawLabel = match[1].trim();
    if (rawLabel.length < 2 || rawLabel.length > 60) continue;
    if (/^\d/.test(rawLabel)) continue;

    const cleanLabel = rawLabel.replace(/[:*]/g, "").trim();
    const name = fieldNameFromLabel(cleanLabel);
    if (!name || name === "field" || name.length < 2 || seen.has(name))
      continue;
    seen.add(name);

    const type = inferType(rawLabel);
    const confidence = 0.75;

    fields.push({
      id: makeId(),
      name,
      label: cleanLabel,
      type,
      required: false,
      placeholder: `{{${name}}}`,
      confidence,
      source: "form_box",
      targetText: line,
      contextText: line,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields;
}

// ── Main detector ─────────────────────────────────────────────────────────────

/**
 * Automatic field detection from DOCX buffer.
 *
 * Priority order:
 *   1. Loop tables (highest confidence, most specific)
 *   2. 2-column tables
 *   3. Label-colon paragraphs
 *   4. Underline blanks
 *   5. Form boxes
 *
 * Duplicate names (case-insensitive) are merged — higher confidence wins.
 */
function detectRecipientBlocks(paragraphTexts: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const ignored = /^(di\s+tempat|tempat|alamat|perihal|hal|lampiran|nomor)\b/i;

  for (let i = 0; i < paragraphTexts.length - 1; i++) {
    const line = paragraphTexts[i].trim();
    if (!/^(kepada|kepada\s+yth\.?|yth\.?)\b/i.test(line)) continue;

    const candidate = paragraphTexts
      .slice(i + 1, i + 4)
      .map((item) => item.trim())
      .find(
        (item) =>
          item.length >= 3 &&
          item.length <= 80 &&
          !ignored.test(item) &&
          !isHeaderFooterNoise(item) &&
          !/[:{}]/.test(item)
      );

    if (!candidate) continue;

    const name = "nama_penerima";
    fields.push({
      id: makeId(),
      name,
      label: "Nama Penerima",
      type: "text",
      required: true,
      placeholder: `{{${name}}}`,
      confidence: 0.74,
      source: "recipient_block",
      targetText: candidate,
      contextText: candidate,
      originalPlaceholder: `{{${name}}}`,
    });
    break;
  }

  return fields;
}

export async function autoDetectFields(
  buffer: ArrayBuffer
): Promise<AutoDetectedField[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  // Scan document.xml + headers (footers usually don't have fillable fields)
  const targets = [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/header3.xml",
  ];

  const allCandidates: AutoDetectedField[] = [];
  const seenNames = new Set<string>();

  for (const path of targets) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");

    // ── L3 Pattern A: Label : blank ──────────────────────────────────────
    const paraTexts: string[] = [];
    const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
    let pm: RegExpExecArray | null;
    while ((pm = paraRe.exec(xml)) !== null) {
      const t = extractText(pm[0]);
      if (t) paraTexts.push(t);
    }
    const labelColonFields = detectLabelColon(paraTexts);
    const underlineFields = detectUnderlineBlanks(paraTexts);
    const formBoxFields = detectFormBoxes(paraTexts);
    const recipientFields = detectRecipientBlocks(paraTexts);

    // ── L3 Pattern B & C: Tables ─────────────────────────────────────────
    const tableFields2col: AutoDetectedField[] = [];
    const tableFieldsLoop: AutoDetectedField[] = [];

    const tableRe = /<w:tbl[ >][\s\S]*?<\/w:tbl>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tableRe.exec(xml)) !== null) {
      const twoCol = detect2ColTable(tm[0]);
      if (twoCol.length > 0) tableFields2col.push(...twoCol);

      const loop = detectLoopTable(tm[0]);
      if (loop) tableFieldsLoop.push(loop);
    }

    // Merge: loop > 2col > label-colon > underline > form-box, sort by confidence desc
    const candidates = [
      ...tableFieldsLoop,
      ...tableFields2col,
      ...labelColonFields,
      ...recipientFields,
      ...underlineFields,
      ...formBoxFields,
    ].sort((a, b) => b.confidence - a.confidence);

    for (const f of candidates) {
      if (seenNames.has(f.name)) continue;
      seenNames.add(f.name);
      allCandidates.push(f);
    }
  }

  return allCandidates;
}
