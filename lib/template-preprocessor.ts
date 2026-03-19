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
 */
function stitchSplitPlaceholders(xml: string): string {
  // Process paragraph by paragraph
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
    // Collect all text nodes in order
    const textNodes: Array<{ full: string; text: string }> = [];
    const wtRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let m: RegExpExecArray | null;

    while ((m = wtRegex.exec(paragraph)) !== null) {
      textNodes.push({ full: m[0], text: m[1] });
    }

    if (textNodes.length <= 1) return paragraph;

    const combined = textNodes.map((n) => n.text).join("");

    // Only stitch if combining reveals a placeholder
    const hasPlaceholder = /\{\{/.test(combined) && /\}\}/.test(combined);

    if (!hasPlaceholder) return paragraph;

    // Put the combined text in the first <w:t>, clear the rest
    let result = paragraph;
    let first = true;
    for (const node of textNodes) {
      if (first) {
        result = result.replace(
          node.full,
          node.full.replace(/>([^<]*)<\/w:t>/, `>${combined}</w:t>`)
        );
        first = false;
      } else {
        result = result.replace(
          node.full,
          node.full.replace(/>([^<]*)<\/w:t>/, `></w:t>`)
        );
      }
    }

    return result;
  });
}
