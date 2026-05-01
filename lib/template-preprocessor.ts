import JSZip from "jszip";

/**
 * Preprocess a DOCX buffer before passing to docxtemplater.
 * Main task: stitch back {{placeholders}} that Word/ONLYOFFICE
 * split across multiple XML runs.
 *
 * Handles PDF-converted DOCX files where:
 * - Each character may be its own <w:r> run
 * - Curly braces may be XML-entity encoded (&#x7B; / &#x7D; / &amp;)
 * - Runs may contain proofErr, bookmarkStart, and other interleaved elements
 */
export async function preprocessTemplate(
  buffer: ArrayBuffer
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);

  const xmlFiles = [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/header3.xml",
    "word/footer1.xml",
    "word/footer2.xml",
    "word/footer3.xml",
  ];

  for (const path of xmlFiles) {
    const file = zip.file(path);
    if (!file) continue;
    let content = await file.async("string");
    content = stitchSplitPlaceholders(content);
    zip.file(path, content);
  }

  return (await zip.generateAsync({ type: "arraybuffer" })) as ArrayBuffer;
}

// ── XML entity helpers ────────────────────────────────────────────────────────

/**
 * Decode XML entities in a text node to their literal characters.
 * PDF converters sometimes encode { as &#x7B; or } as &#x7D;.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Encode text back to safe XML text content.
 * Only encodes characters that are illegal in XML text nodes.
 */
function encodeXmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Stitching ─────────────────────────────────────────────────────────────────

/**
 * Word/ONLYOFFICE splits {{field}} across <w:r> runs in XML.
 * PDF-to-DOCX converters make this much worse — every character
 * can be its own run with its own formatting properties.
 *
 * Strategy:
 *   1. Process paragraph by paragraph.
 *   2. Within each paragraph, collect all <w:t> text nodes (decoded).
 *   3. If the combined decoded text contains {{ and }}, stitch all
 *      text into the FIRST <w:t> node and empty the rest.
 *
 * Uses back-to-front index splicing so earlier offsets stay valid.
 */
function stitchSplitPlaceholders(xml: string): string {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, stitchParagraph);
}

function stitchParagraph(para: string): string {
  // Collect every <w:t>…</w:t> node with its positions in the para string.
  const nodes: {
    tStart: number;
    tEnd: number;
    raw: string;
    decoded: string;
  }[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(para)) !== null) {
    // Text content sits between end of opening tag and start of </w:t>
    const tEnd = m.index + m[0].length - 6; // "</w:t>".length === 6
    const tStart = tEnd - m[1].length;
    nodes.push({
      tStart,
      tEnd,
      raw: m[1],
      decoded: decodeXmlEntities(m[1]),
    });
  }

  if (nodes.length <= 1) return para;

  // Combine decoded text — this surfaces placeholders hidden by entity encoding
  const combinedDecoded = nodes.map((n) => n.decoded).join("");

  // Only stitch if the combined text actually contains a placeholder pattern
  if (!combinedDecoded.includes("{{") || !combinedDecoded.includes("}}")) {
    return para;
  }

  // Replace back-to-front to keep earlier indices valid.
  // Node 0 gets ALL combined text (re-encoded); the rest become empty strings.
  let result = para;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const { tStart, tEnd } = nodes[i];
    const newText = i === 0 ? encodeXmlText(combinedDecoded) : "";
    result = result.slice(0, tStart) + newText + result.slice(tEnd);
  }
  return result;
}

// ── Text extraction (used by scanner) ────────────────────────────────────────

/**
 * Extract plain text from DOCX XML in a way that preserves {{placeholders}}.
 *
 * The naive approach (replace all tags with spaces) breaks placeholders that
 * were split across runs — even after stitching — because the XML still has
 * element boundaries between the tag characters.
 *
 * Instead we:
 *   1. Process paragraph by paragraph (so we still get word boundaries).
 *   2. Within each paragraph, join <w:t> contents WITHOUT inserting spaces.
 *   3. Decode XML entities so &#x7B;&#x7B;name&#x7D;&#x7D; → {{name}}.
 */
export function extractTextFromXml(xml: string): string {
  const paraTexts: string[] = [];
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;

  while ((m = paraRe.exec(xml)) !== null) {
    const textRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    const chunks: string[] = [];
    let tm: RegExpExecArray | null;

    while ((tm = textRe.exec(m[0])) !== null) {
      const decoded = decodeXmlEntities(tm[1]);
      if (decoded) chunks.push(decoded);
    }

    const paraText = chunks.join("").trim();
    if (paraText) paraTexts.push(paraText);
  }

  // Join paragraphs with a space so adjacent words from different paragraphs
  // don't accidentally merge (e.g. "Hello" + "World" → "Hello World").
  return paraTexts.join(" ");
}
