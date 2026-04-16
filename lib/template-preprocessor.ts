import JSZip from "jszip";

/**
 * Preprocess a DOCX buffer before passing to docxtemplater.
 * Main task: stitch back {{placeholders}} that Word/ONLYOFFICE
 * split across multiple XML runs.
 *
 * docxtemplater uses {{ }} delimiters natively (when configured).
 * We do NOT convert syntax — just fix split tags.
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

/**
 * Word splits {{field}} across <w:r> runs in XML.
 * This stitches them back into a single <w:t> node per paragraph.
 *
 * Uses index-based slicing (back-to-front) so that:
 *   1. Duplicate <w:t> nodes (e.g. two empty ones) are handled correctly —
 *      String.replace would only patch the FIRST occurrence.
 *   2. No $ substitution side-effects from String.replace replacement strings.
 */
function stitchSplitPlaceholders(xml: string): string {
  // Process paragraph by paragraph
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, stitchParagraph);
}

function stitchParagraph(para: string): string {
  // Collect every <w:t>…</w:t> node.
  // For each node store the byte-offset of the text content only
  // (the region between the closing > of the start tag and </w:t>).
  const nodes: { tStart: number; tEnd: number; text: string }[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(para)) !== null) {
    // m[0] = full element, e.g. `<w:t xml:space="preserve">hello</w:t>`
    // Text content ends just before </w:t> (6 chars)
    const tEnd = m.index + m[0].length - 6; // 6 = "</w:t>".length
    const tStart = tEnd - m[1].length;
    nodes.push({ tStart, tEnd, text: m[1] });
  }

  if (nodes.length <= 1) return para;

  const combined = nodes.map((n) => n.text).join("");

  // Only stitch if combining reveals a placeholder
  if (!combined.includes("{{") || !combined.includes("}}")) return para;

  // Replace text content back-to-front so earlier offsets stay valid.
  // First node gets ALL combined text; the rest become empty.
  let result = para;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const { tStart, tEnd } = nodes[i];
    const newText = i === 0 ? combined : "";
    result = result.slice(0, tStart) + newText + result.slice(tEnd);
  }
  return result;
}