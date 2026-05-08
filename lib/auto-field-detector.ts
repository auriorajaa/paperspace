/**
 * lib/auto-field-detector.ts
 *
 * AI-FIRST automatic field detection pipeline.
 *
 *   Layer 1 — Gemini 2.5 Flash-Lite (Primary):
 *     · Receives raw document lines (paragraphs + table content)
 *     · Directly extracts all fillable template fields
 *     · Handles Indonesian official letters (surat dinas / nota dinas / undangan)
 *     · Correctly maps: nomor, lampiran, perihal, tanggal, waktu, tempat, penerima
 *     · Returns complete field list with proper types and targetText
 *
 *   Layer 2 — L3+L5 Rule-Based (Fallback only):
 *     · Runs ONLY when Gemini is unavailable (no API key, rate limit, timeout, error)
 *     · Pattern A: "Label : Value" paragraphs
 *     · Pattern D: Underline blanks after labels
 *     · Pattern E: Form-style boxes / checkboxes
 *     · Pattern F: Standalone date paragraphs → tanggal_surat
 *     · Recipient: "Yth." / "Kepada" blocks → nama_penerima
 *     · Dictionary-based type inference (date, number, email, phone)
 *
 * Table handling:
 *   · Table content is extracted and included in document context for Gemini
 *   · Rule-based fallback also processes table content as paragraph-like lines
 *   · Institutional header/footer noise is filtered in both layers
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
  /** Which pattern/layer detected or last modified this field */
  source:
    | "label_colon" // L3 Pattern A (fallback)
    | "underline_blank" // L3 Pattern D (fallback)
    | "form_box" // L3 Pattern E (fallback)
    | "standalone_date" // L3 Pattern F (fallback)
    | "recipient_block" // L3 Recipient (fallback)
    | "gemini_primary" // Gemini AI detection (primary)
    | "manual"; // User-written {{placeholder}} syntax

  /** Exact raw text the DOCX injector should replace */
  targetText?: string;
  /** Paragraph text used to scope replacement when targetText is ambiguous */
  contextText?: string;
  /** Explicit DOCX replacement; defaults to placeholder when omitted */
  replacementText?: string;
  /** Placeholder before user edits the field in review */
  originalPlaceholder?: string;
  subFields?: Omit<AutoDetectedField, "subFields">[];
}

// ── Shared utilities ──────────────────────────────────────────────────────────

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

/** Collect all <w:t> text nodes in an XML fragment */
function extractText(xml: string): string {
  const parts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) parts.push(decodeXmlEntities(m[1]));
  return parts.join("").trim();
}

/**
 * extractParagraphLines — split one <w:p> into visual lines.
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

// ── Field-name normalisation ──────────────────────────────────────────────────

function toName(raw: string): string {
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

function normalizeBusinessFieldName(
  rawLabel: string,
  baseName: string
): string {
  const compact = rawLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (compact === "nomor" || compact === "no" || compact === "no_surat")
    return "nomor_surat";
  if (compact === "lampiran") return "jumlah_lampiran";
  if (/^(kepada|penerima|nama_penerima|yth)$/.test(compact))
    return "nama_penerima";
  if (compact === "hari_tanggal" || compact === "tanggal")
    return "tanggal_kegiatan";
  if (compact === "waktu" || compact === "pukul" || compact === "jam")
    return "waktu_kegiatan";
  if (
    compact === "tempat" ||
    compact === "lokasi" ||
    compact === "ruang" ||
    compact === "ruangan"
  )
    return "tempat_kegiatan";
  if (compact === "perihal" || compact === "hal" || compact === "pokok_surat")
    return "perihal_surat";

  return baseName;
}

function fieldNameFromLabel(rawLabel: string): string {
  return normalizeBusinessFieldName(rawLabel, toName(rawLabel));
}

// ── Utility predicates ────────────────────────────────────────────────────────

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
  const noisePatterns = [
    /^page\s*\d+/i,
    /^\d+\s*of\s*\d+/i,
    /^(confidential|draft|internal|private)/i,
    /^(approved by|prepared by|reviewed by)/i,
    /^(date|time):?\s*$/i,
    /^(doc|document)\s*(no|number|#)/i,
    /^rev(ision)?\.?\s*\d+/i,
  ];
  return noisePatterns.some((re) => re.test(text.trim()));
}

const INSTITUTIONAL_HEADER_LABELS = new Set([
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
  if (/^https?:\/\//i.test(v)) return true;
  if (/^www\./i.test(v)) return true;
  if (/^\(\d{2,4}\)\s*\d{5,}/.test(v)) return true;
  return false;
}

// ── L5 — Dictionary & format-based type inference (FALLBACK ONLY) ─────────────

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
    "budget",
    "anggaran",
    "estimate",
    "estimasi",
    "quotation",
    "quote",
  ],
  email: ["email", "e_mail", "surel", "mail", "elektronik", "electronic"],
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

function inferTypeFromLabel(label: string): AutoFieldType {
  const name = toName(label);
  if (name === "nomor" || name === "no" || name.includes("surat"))
    return "text";
  for (const [type, keywords] of Object.entries(LABEL_DICT) as [
    InferredFieldType,
    string[],
  ][]) {
    if (keywords.some((kw) => name.includes(kw))) return type;
  }
  return "text";
}

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
  if (
    /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(v) ||
    /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(v) ||
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[,.]?\s*\d{2,4}$/i.test(
      v
    ) ||
    /^\d{1,2}\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}$/i.test(
      v
    ) ||
    /^\w+,\s+\d{1,2}\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}$/i.test(
      v
    )
  )
    return "date";
  if (/^(Rp\.?|IDR|USD|\$|€|£)\s?[\d.,]+/i.test(v)) return "number";
  if (/^[\d.,]+$/.test(v) && v.length <= 25) return "number";
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

// ── PDF split-line reconstruction (FALLBACK ONLY) ─────────────────────────────

const ID_MONTHS =
  "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember";

const STANDALONE_DATE_PATTERNS = [
  new RegExp(`^\d{1,2}\s+(${ID_MONTHS})\s+\d{4}$`, "i"),
  new RegExp(`^\w+,\s+\d{1,2}\s+(${ID_MONTHS})\s+\d{4}$`, "i"),
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/,
];

function isLabelCandidate(t: string): boolean {
  return (
    t.length >= 2 &&
    t.length <= 60 &&
    !t.includes(":") &&
    !t.includes("：") &&
    t.split(/\s+/).length <= 7 &&
    !STANDALONE_DATE_PATTERNS.some((re) => re.test(t))
  );
}

function isStandaloneColon(t: string): boolean {
  return /^[:：]\s*$/.test(t);
}

function reconstructSplitLines(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const cur = lines[i].trim();
    const next = i + 1 < lines.length ? lines[i + 1].trim() : null;

    if (isStandaloneColon(cur)) {
      i++;
      continue;
    }

    // Case 1: "Label" + ": Value"
    if (
      next !== null &&
      /^[:：]/.test(next) &&
      !isStandaloneColon(next) &&
      isLabelCandidate(cur)
    ) {
      const value = next.replace(/^[:：]\s*/, "").trim();
      result.push(`${cur} : ${value}`);
      i += 2;
      continue;
    }

    // Case 2: "Label :" + "Value"
    if (next !== null && /[:：]\s*$/.test(cur) && !/^[:：]/.test(next)) {
      const nextIsLikelyBareLabel =
        !next.includes(":") &&
        !next.includes("：") &&
        next.split(/\s+/).length <= 3 &&
        next.length <= 30;

      if (!nextIsLikelyBareLabel) {
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

// ── L3 Pattern Detectors (FALLBACK ONLY) ─────────────────────────────────────

function detectLabelColon(paragraphTexts: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();
  const re = /^([^\n\r:：]{2,50}?)\s*[:：]\s*(.{0,80})?$/;

  for (const raw of paragraphTexts) {
    const line = raw.trim();
    if (!line || line.length > 130) continue;
    if (isHeaderFooterNoise(line)) continue;

    const match = re.exec(line);
    if (!match) continue;

    const rawLabel = match[1].trim();
    const rawValue = (match[2] ?? "").trim();

    if (rawLabel.split(/\s+/).length > 7) continue;
    if (/[.!?;،]/.test(rawLabel.slice(0, -1))) continue;
    if (rawLabel.length < 2) continue;
    if (/^\d/.test(rawLabel)) continue;
    if (/^\d+[\/\-\.]\d+/.test(rawLabel)) continue;

    const labelNorm = toName(rawLabel);
    if (INSTITUTIONAL_HEADER_LABELS.has(labelNorm)) continue;
    if (rawValue && isInstitutionalValue(rawValue)) continue;

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

function detectUnderlineBlanks(paragraphTexts: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();
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

    fields.push({
      id: makeId(),
      name,
      label: cleanLabel,
      type: inferType(rawLabel),
      required: true,
      placeholder: `{{${name}}}`,
      confidence: 0.78,
      source: "underline_blank",
      targetText: match[2]?.trim() || undefined,
      contextText: line,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields;
}

function detectFormBoxes(paragraphTexts: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const seen = new Set<string>();
  const checkboxRe = /^(?:[☐□▢\[\(]\s*[\]\)]?\s+)([^\n\r]{1,60})$/;
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

    fields.push({
      id: makeId(),
      name,
      label: cleanLabel,
      type: inferType(rawLabel),
      required: false,
      placeholder: `{{${name}}}`,
      confidence: 0.75,
      source: "form_box",
      targetText: line,
      contextText: line,
      originalPlaceholder: `{{${name}}}`,
    });
  }

  return fields;
}

function detectStandaloneDate(paragraphTexts: string[]): AutoDetectedField[] {
  for (const raw of paragraphTexts) {
    const line = raw.trim();
    if (!line || line.includes(":") || line.includes("：")) continue;
    if (line.length > 40) continue;
    if (!STANDALONE_DATE_PATTERNS.some((re) => re.test(line))) continue;

    return [
      {
        id: makeId(),
        name: "tanggal_surat",
        label: "Tanggal Surat",
        type: "date",
        required: true,
        placeholder: "{{tanggal_surat}}",
        confidence: 0.9,
        source: "standalone_date",
        targetText: line,
        contextText: line,
        originalPlaceholder: "{{tanggal_surat}}",
      },
    ];
  }
  return [];
}

function detectRecipientBlocks(paragraphTexts: string[]): AutoDetectedField[] {
  const fields: AutoDetectedField[] = [];
  const ignored =
    /^(di\s+|tempat\b|alamat\b|perihal\b|hal\b|lampiran\b|nomor\b)/i;

  for (let i = 0; i < paragraphTexts.length - 1; i++) {
    const line = paragraphTexts[i].trim();
    if (!/^(kepada|kepada\s+yth\.?|yth\.?)\b/i.test(line)) continue;

    const inlineMatch = line.match(/^(?:kepada\s+)?yth\.?\s+(.{3,80})$/i);
    if (inlineMatch) {
      const candidate = inlineMatch[1].trim();
      if (
        !ignored.test(candidate) &&
        !isHeaderFooterNoise(candidate) &&
        !/[:{}]/.test(candidate)
      ) {
        fields.push({
          id: makeId(),
          name: "nama_penerima",
          label: "Nama Penerima",
          type: "text",
          required: true,
          placeholder: "{{nama_penerima}}",
          confidence: 0.8,
          source: "recipient_block",
          targetText: candidate,
          contextText: candidate,
          originalPlaceholder: "{{nama_penerima}}",
        });
        break;
      }
    }

    const candidate = paragraphTexts
      .slice(i + 1, i + 5)
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

    fields.push({
      id: makeId(),
      name: "nama_penerima",
      label: "Nama Penerima",
      type: "text",
      required: true,
      placeholder: "{{nama_penerima}}",
      confidence: 0.74,
      source: "recipient_block",
      targetText: candidate,
      contextText: candidate,
      originalPlaceholder: "{{nama_penerima}}",
    });
    break;
  }

  return fields;
}

function extractTableLines(xml: string): string[] {
  const lines: string[] = [];
  const rowRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const rowXml = rowMatch[0];
    const cellRe = /<w:tc[ >][\s\S]*?<\/w:tc>/g;
    let cellMatch: RegExpExecArray | null;
    const cells: string[] = [];

    while ((cellMatch = cellRe.exec(rowXml)) !== null) {
      const cellText = extractText(cellMatch[0]);
      if (cellText) cells.push(cellText);
    }

    if (cells.length > 0) {
      lines.push(cells.join(" "));
      lines.push(...cells);
    }
  }

  return lines.filter((l) => l.length > 0 && l.length < 200);
}

// ── FALLBACK: L3+L5 Rule-based detection ─────────────────────────────────────
// Only runs when Gemini is unavailable (no API key, rate limit, error, timeout)

function runRuleBasedDetection(rawLines: string[]): AutoDetectedField[] {
  const paraTexts = reconstructSplitLines(rawLines);

  const candidates: AutoDetectedField[] = [
    ...detectStandaloneDate(paraTexts),
    ...detectLabelColon(paraTexts),
    ...detectRecipientBlocks(paraTexts),
    ...detectUnderlineBlanks(paraTexts),
    ...detectFormBoxes(paraTexts),
  ].sort((a, b) => b.confidence - a.confidence);

  // Deduplicate by name — higher confidence wins
  const fields: AutoDetectedField[] = [];
  const seenNames = new Map<string, number>();

  for (const f of candidates) {
    const idx = seenNames.get(f.name);
    if (idx !== undefined) {
      if (f.confidence > fields[idx].confidence) {
        fields[idx] = f;
      }
    } else {
      seenNames.set(f.name, fields.length);
      fields.push(f);
    }
  }

  return fields;
}

// ── PRIMARY: Gemini AI Detection ──────────────────────────────────────────────

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiFieldItem {
  name: string;
  label: string;
  type: string;
  targetText?: string;
  confidence?: number;
}

function buildGeminiPrompt(rawLines: string[]): string {
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
- text  → names, subjects, titles, recipient names, document numbers, attachment counts
- date  → any date (document date, event date, birth date, deadline)
- number → quantities, prices, amounts (e.g. "450", "Rp 5.000")
- email → email addresses
- phone → phone numbers, WhatsApp, fax

EXPECTED FIELDS (check ALL of these exist in the document):
- tanggal_surat    → document date (e.g. "29 Januari 2026", "12 Februari 2026")
- nomor_surat      → document reference number (e.g. "101/DST/PL3.A.9/B/PK.01/2026")
- jumlah_lampiran  → attachment count (e.g. "1 (satu) lembar", "1 lembar") — NOT the subject!
- perihal_surat    → letter subject (e.g. "Undangan Sosialisasi dari MSU") — NOT the attachment count!
- nama_penerima    → recipient name/title (e.g. "Orang tua/Wali mahasiswa MSU di Depok")
- tanggal_kegiatan → event date (e.g. "Jumat, 30 Januari 2026", "Sabtu 14 Februari 2026")
- waktu_kegiatan   → event time (e.g. "08.30 s.d. 11.00 WIB", "13.00 s.d. 14.00 WIB")
- tempat_kegiatan  → event venue (e.g. "Aula Gedung PUT sisi kanan", "Online Zoom", "Auditorium Perpustakaan PNJ")

IMPORTANT DISTINCTIONS:
- "Lampiran" value should be the COUNT (e.g. "1 lembar"), NOT the subject line.
- "Perihal" value should be the SUBJECT (e.g. "Undangan Sosialisasi"), NOT the attachment count.
- "Yth." or "Kepada" introduces the recipient name.
- Dates at the top of the letter (before "Yth.") are tanggal_surat.
- Dates in the event details section are tanggal_kegiatan.

Return ONLY a valid JSON array — no markdown, no explanation, no extra text:
[{"name":"field_name","label":"Field Label","type":"text|date|number|email|phone","targetText":"exact text from document","confidence":0.95}]`;
}

async function callGeminiDetection(
  rawLines: string[]
): Promise<AutoDetectedField[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log(
      "[auto-field-detector] No GEMINI_API_KEY — will use rule-based fallback"
    );
    return null;
  }

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildGeminiPrompt(rawLines) }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      console.warn(
        `[auto-field-detector] Gemini HTTP ${res.status} — using rule-based fallback`
      );
      return null;
    }

    const data = await res.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    // Strip accidental markdown fences
    const cleaned = rawText
      .replace(/^\x60\x60\x60(?:json)?\s*/i, "")
      .replace(/\s*\x60\x60\x60$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      console.warn(
        "[auto-field-detector] Gemini returned non-array — using rule-based fallback"
      );
      return null;
    }

    // Convert Gemini items to AutoDetectedField
    const fields: AutoDetectedField[] = [];
    const seenNames = new Set<string>();

    for (const item of parsed) {
      const name = (item.name ?? "").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
      if (!name || name.length < 2) continue;
      if (seenNames.has(name)) continue;
      seenNames.add(name);

      const targetText = (item.targetText ?? "").trim() || undefined;
      const confidence =
        typeof item.confidence === "number" && item.confidence > 0
          ? Math.min(item.confidence, 1)
          : 0.92;
      const type = (
        ["text", "date", "number", "email", "phone"].includes(item.type)
          ? item.type
          : "text"
      ) as AutoFieldType;

      fields.push({
        id: makeId(),
        name,
        label: item.label || name,
        type,
        required: true,
        placeholder: `{{${name}}}`,
        confidence,
        source: "gemini_primary",
        targetText,
        contextText: targetText,
        originalPlaceholder: `{{${name}}}`,
      });
    }

    console.log(
      `[auto-field-detector] Gemini detected ${fields.length} fields`
    );
    return fields;
  } catch (err) {
    console.warn(
      "[auto-field-detector] Gemini call failed:",
      err,
      "— using rule-based fallback"
    );
    return null;
  }
}

// ── Main detector — public API ────────────────────────────────────────────────

export async function autoDetectFields(
  buffer: ArrayBuffer
): Promise<AutoDetectedField[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  // Load document body
  const file = zip.file("word/document.xml");
  if (!file) return [];
  const xml = await file.async("string");

  // Extract table content
  const tableLines: string[] = [];
  const bodyWithoutTables = xml.replace(
    /<w:tbl[ >][\s\S]*?<\/w:tbl>/g,
    (match) => {
      tableLines.push(...extractTableLines(match));
      return "";
    }
  );

  // Collect raw visual lines from body paragraphs
  const rawLines: string[] = [];
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = paraRe.exec(bodyWithoutTables)) !== null) {
    rawLines.push(...extractParagraphLines(pm[0]));
  }
  rawLines.push(...tableLines);

  // ── PRIMARY: Try Gemini AI detection first ────────────────────────────────
  const geminiFields = await callGeminiDetection(rawLines);
  if (geminiFields && geminiFields.length > 0) {
    return geminiFields;
  }

  // ── FALLBACK: L3+L5 rule-based detection ──────────────────────────────────
  console.log("[auto-field-detector] Running rule-based fallback detection");
  return runRuleBasedDetection(rawLines);
}
