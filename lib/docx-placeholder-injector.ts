import JSZip from "jszip";

export type InjectableFieldType =
  | "text"
  | "date"
  | "number"
  | "email"
  | "phone"
  | "loop"
  | "condition"
  | "condition_inverse";

export interface InjectableField {
  name: string;
  label: string;
  type: InjectableFieldType | string;
  placeholder: string;
  source?: string;
  targetText?: string;
  contextText?: string;
  replacementText?: string;
  originalPlaceholder?: string;
  subFields?: InjectableField[];
}

interface XmlTextNode {
  textStart: number;
  textEnd: number;
  raw: string;
  decoded: string;
  decodedStart: number;
  decodedEnd: number;
}

interface XmlRange {
  start: number;
  end: number;
  xml: string;
}

const DOCX_XML_FILES = [
  "word/document.xml",
  "word/header1.xml",
  "word/header2.xml",
  "word/header3.xml",
  "word/footer1.xml",
  "word/footer2.xml",
  "word/footer3.xml",
];

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

function encodeXmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function collectTextNodes(xml: string): XmlTextNode[] {
  const nodes: XmlTextNode[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  let decodedCursor = 0;

  while ((match = re.exec(xml)) !== null) {
    const textEnd = match.index + match[0].length - "</w:t>".length;
    const textStart = textEnd - match[1].length;
    const decoded = decodeXmlEntities(match[1]);
    nodes.push({
      textStart,
      textEnd,
      raw: match[1],
      decoded,
      decodedStart: decodedCursor,
      decodedEnd: decodedCursor + decoded.length,
    });
    decodedCursor += decoded.length;
  }

  return nodes;
}

function getText(xml: string): string {
  return collectTextNodes(xml)
    .map((node) => node.decoded)
    .join("")
    .trim();
}

function isBlank(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || /^[_\-.]{2,}$/.test(trimmed);
}

function normalizeLabel(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getReplacement(field: InjectableField): string {
  if (field.replacementText) return field.replacementText;

  const targetText = field.targetText ?? "";
  if (field.type === "loop") {
    return targetText
      ? `{{#${field.name}}}${targetText}{{/${field.name}}}`
      : `{{#${field.name}}}{{/${field.name}}}`;
  }
  if (field.type === "condition") {
    return targetText
      ? `{{#${field.name}}}${targetText}{{/${field.name}}}`
      : `{{#${field.name}}}{{/${field.name}}}`;
  }
  if (field.type === "condition_inverse") {
    return targetText
      ? `{{^${field.name}}}${targetText}{{/${field.name}}}`
      : `{{^${field.name}}}{{/${field.name}}}`;
  }

  return `{{${field.name}}}`;
}

function uniqueTokens(tokens: (string | undefined)[]): string[] {
  return [...new Set(tokens.filter(Boolean) as string[])].filter(
    (token) => token.trim().length > 0
  );
}

function getRestoreOperations(
  field: InjectableField
): { token: string; replacement: string }[] {
  const operations: { token: string; replacement: string }[] = [];
  const originalText = field.targetText ?? "";

  if (field.replacementText && field.targetText) {
    operations.push({
      token: field.replacementText,
      replacement: field.targetText,
    });
  }

  if (field.type === "loop") {
    const tokens = uniqueTokens([
      field.originalPlaceholder,
      field.placeholder,
      `{{#${field.name}}}`,
      `{{/${field.name}}}`,
      ...(field.subFields ?? []).map((subField) => `{{${subField.name}}}`),
    ]);
    tokens.forEach((token) => operations.push({ token, replacement: "" }));
    return operations;
  }

  if (field.type === "condition") {
    const tokens = uniqueTokens([
      field.originalPlaceholder,
      field.placeholder,
      `{{#${field.name}}}`,
      `{{/${field.name}}}`,
    ]);
    tokens.forEach((token) => operations.push({ token, replacement: "" }));
    return operations;
  }

  if (field.type === "condition_inverse") {
    const tokens = uniqueTokens([
      field.originalPlaceholder,
      field.placeholder,
      `{{^${field.name}}}`,
      `{{/${field.name}}}`,
    ]);
    tokens.forEach((token) => operations.push({ token, replacement: "" }));
    return operations;
  }

  const tokens = uniqueTokens([
    field.originalPlaceholder,
    field.placeholder,
    `{{${field.name}}}`,
  ]);
  tokens.forEach((token) => {
    operations.push({ token, replacement: originalText });
  });

  return operations;
}

function replaceTextInFragment(
  fragment: string,
  target: string,
  replacement: string
): { xml: string; changed: boolean } {
  if (!target || target === replacement) {
    return { xml: fragment, changed: false };
  }

  const nodes = collectTextNodes(fragment);
  if (nodes.length === 0) return { xml: fragment, changed: false };

  for (const node of nodes) {
    if (!node.decoded.includes(target)) continue;
    const nextText = node.decoded.replace(target, replacement);
    return {
      xml:
        fragment.slice(0, node.textStart) +
        encodeXmlText(nextText) +
        fragment.slice(node.textEnd),
      changed: true,
    };
  }

  const combined = nodes.map((node) => node.decoded).join("");
  const matchStart = combined.indexOf(target);
  if (matchStart === -1) return { xml: fragment, changed: false };

  const matchEnd = matchStart + target.length;
  let result = fragment;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.decodedEnd <= matchStart || node.decodedStart >= matchEnd) {
      continue;
    }

    const localStart = Math.max(matchStart - node.decodedStart, 0);
    const localEnd = Math.min(
      matchEnd - node.decodedStart,
      node.decoded.length
    );

    let nextText = "";
    if (node.decodedStart <= matchStart && matchStart < node.decodedEnd) {
      nextText = node.decoded.slice(0, localStart) + replacement;
      if (matchEnd <= node.decodedEnd) {
        nextText += node.decoded.slice(localEnd);
      }
    } else if (node.decodedStart < matchEnd && matchEnd <= node.decodedEnd) {
      nextText = node.decoded.slice(localEnd);
    }

    result =
      result.slice(0, node.textStart) +
      encodeXmlText(nextText) +
      result.slice(node.textEnd);
  }

  return { xml: result, changed: true };
}

function setFirstTextNode(fragment: string, text: string): string {
  const nodes = collectTextNodes(fragment);
  if (nodes.length > 0) {
    let result = fragment;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const nextText = i === 0 ? encodeXmlText(text) : "";
      result =
        result.slice(0, node.textStart) + nextText + result.slice(node.textEnd);
    }
    return result;
  }

  const runXml = `<w:r><w:t>${encodeXmlText(text)}</w:t></w:r>`;
  if (fragment.includes("</w:p>")) {
    return fragment.replace("</w:p>", `${runXml}</w:p>`);
  }
  if (fragment.includes("</w:tc>")) {
    return fragment.replace("</w:tc>", `<w:p>${runXml}</w:p></w:tc>`);
  }

  return fragment;
}

function collectRanges(xml: string, pattern: RegExp): XmlRange[] {
  const ranges: XmlRange[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
      xml: match[0],
    });
  }

  return ranges;
}

function collectRows(tableXml: string): XmlRange[] {
  return collectRanges(tableXml, /<w:tr[ >][\s\S]*?<\/w:tr>/g);
}

function collectCells(rowXml: string): XmlRange[] {
  return collectRanges(rowXml, /<w:tc[ >][\s\S]*?<\/w:tc>/g);
}

function replaceRange(
  xml: string,
  range: XmlRange,
  replacement: string
): string {
  return xml.slice(0, range.start) + replacement + xml.slice(range.end);
}

function replaceFieldsInTextFragments(
  xml: string,
  fields: InjectableField[]
): string {
  const textFields = fields.filter((field) => field.type !== "loop");

  // 1. Group fields by targetText
  const byTarget = new Map<string, InjectableField[]>();
  for (const field of textFields) {
    const target = field.targetText?.trim();
    if (!target || target.length < 2) continue;
    const arr = byTarget.get(target) ?? [];
    arr.push(field);
    byTarget.set(target, arr);
  }

  // 2. Sort each group by _N suffix (_1 first, _2 second, …)
  for (const [, arr] of byTarget) {
    arr.sort((a, b) => {
      const ai = parseInt(a.name.match(/_(\d+)$/)?.[1] ?? "0", 10);
      const bi = parseInt(b.name.match(/_(\d+)$/)?.[1] ?? "0", 10);
      return ai - bi;
    });
  }

  // 3. Global occurrence counter — persists ACROSS paragraphs.
  //
  //    THE BUG THIS FIXES:
  //    In a Surat Tugas, pangkat_golongan for person 1 and person 2 live in
  //    separate table-cell paragraphs, each with exactly one occurrence of the
  //    same target text. The old code used a per-paragraph occurrence index (i)
  //    that always started at 0, so fieldIndex = Math.min(0, …) = 0 for every
  //    paragraph — both rows always got group[0] = _1.
  //
  //    With a global counter:
  //      Person 1's paragraph → baseConsumed=0 → group[0] = _1  ✓
  //      Person 2's paragraph → baseConsumed=1 → group[1] = _2  ✓
  const globalOccurrence = new Map<string, number>();

  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
    let result = paragraph;
    const paragraphText = getText(result);

    // ── Occurrence-aware replacement ──────────────────────────────────────────
    for (const [target, group] of byTarget) {
      if (!paragraphText.includes(target)) continue;

      const baseConsumed = globalOccurrence.get(target) ?? 0;

      if (group.length === 1) {
        // Single field — simple replacement (unchanged behaviour)
        const field = group[0];
        const replacement = getReplacement(field);
        if (
          field.originalPlaceholder &&
          field.originalPlaceholder !== replacement
        ) {
          result = replaceTextInFragment(
            result,
            field.originalPlaceholder,
            replacement
          ).xml;
        }
        if (!result.includes(replacement)) {
          result = replaceTextInFragment(result, target, replacement).xml;
        }
        continue;
      }

      // Multiple fields share the same targetText.
      //
      // We replace occurrences one at a time, first→last, using the global
      // counter to pick the right indexed field. Because replaceTextInFragment
      // always replaces the FIRST remaining occurrence of `target`, calling it
      // iteratively naturally walks through occurrence 1, 2, 3 … in order.
      //
      //   Pass 1: replaces occurrence #1 with group[baseConsumed+0]
      //   Pass 2: replaces occurrence #2 (now #1) with group[baseConsumed+1]
      //   …
      //
      // This handles both the common cross-paragraph case (1 occurrence per
      // paragraph, global counter advances between paragraphs) and the rarer
      // within-paragraph case (multiple occurrences in one paragraph).
      let localCount = 0;
      let currentText = getText(result);

      while (currentText.includes(target)) {
        const globalIdx = baseConsumed + localCount;
        const field = group[Math.min(globalIdx, group.length - 1)];
        const fieldReplacement = getReplacement(field);

        const replaced = replaceTextInFragment(
          result,
          target,
          fieldReplacement
        );
        if (!replaced.changed) break;

        result = replaced.xml;
        currentText = getText(result);
        localCount++;
      }

      globalOccurrence.set(target, baseConsumed + localCount);
    }

    // ── Fields without targetText (fallback) ─────────────────────────────────
    for (const field of textFields) {
      if (field.targetText?.trim()) continue;

      const replacement = getReplacement(field);

      if (
        field.originalPlaceholder &&
        field.originalPlaceholder !== replacement
      ) {
        result = replaceTextInFragment(
          result,
          field.originalPlaceholder,
          replacement
        ).xml;
      }

      if (result.includes(replacement)) continue;

      const context = field.contextText?.trim();
      if (
        context &&
        paragraphText === context &&
        /[:\uFF1A]\s*$/.test(paragraphText)
      ) {
        result = setFirstTextNode(result, `${paragraphText} ${replacement}`);
      }
    }

    return result;
  });
}

function restoreFieldsInTextFragments(
  xml: string,
  fields: InjectableField[]
): string {
  if (fields.length === 0) return xml;

  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
    let result = paragraph;

    for (const field of fields) {
      for (const operation of getRestoreOperations(field)) {
        result = replaceTextInFragment(
          result,
          operation.token,
          operation.replacement
        ).xml;
      }
    }

    return result;
  });
}

function injectTwoColumnBlankCells(
  xml: string,
  fields: InjectableField[]
): string {
  const tableFields = fields.filter(
    (field) => field.source === "table_2col" && !field.targetText
  );
  if (tableFields.length === 0) return xml;

  return xml.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g, (rowXml) => {
    const cells = collectCells(rowXml);
    if (cells.length !== 2) return rowXml;

    const leftText = getText(cells[0].xml);
    const rightText = getText(cells[1].xml);
    if (!isBlank(rightText)) return rowXml;

    const field = tableFields.find(
      (candidate) =>
        normalizeLabel(candidate.label) === normalizeLabel(leftText)
    );
    if (!field) return rowXml;

    const nextCell = setFirstTextNode(cells[1].xml, getReplacement(field));
    return replaceRange(rowXml, cells[1], nextCell);
  });
}

function injectLoopTables(xml: string, fields: InjectableField[]): string {
  const loopFields = fields.filter(
    (field) => field.type === "loop" && field.subFields?.length
  );
  if (loopFields.length === 0) return xml;

  return xml.replace(/<w:tbl[ >][\s\S]*?<\/w:tbl>/g, (tableXml) => {
    if (loopFields.some((field) => tableXml.includes(`{{#${field.name}}}`))) {
      return tableXml;
    }

    const rows = collectRows(tableXml);
    if (rows.length < 2) return tableXml;

    const headerCells = collectCells(rows[0].xml);
    const headerLabels = headerCells.map((cell) =>
      normalizeLabel(getText(cell.xml))
    );
    const loopField = loopFields.find((field) => {
      const subFields = field.subFields ?? [];
      if (subFields.length < 2 || subFields.length > headerLabels.length) {
        return false;
      }
      return subFields.every((subField, index) => {
        return normalizeLabel(subField.label) === headerLabels[index];
      });
    });

    if (!loopField?.subFields?.length) return tableXml;

    const dataRow = rows.slice(1).find((row) => {
      const cells = collectCells(row.xml);
      if (cells.length < loopField.subFields!.length) return false;
      const blankCount = cells.filter((cell) =>
        isBlank(getText(cell.xml))
      ).length;
      return blankCount / cells.length >= 0.4;
    });

    if (!dataRow) return tableXml;

    const dataCells = collectCells(dataRow.xml);
    let nextRow = dataRow.xml;
    const subFields = loopField.subFields;

    for (
      let i = Math.min(subFields.length, dataCells.length) - 1;
      i >= 0;
      i--
    ) {
      const subField = subFields[i];
      let token = `{{${subField.name}}}`;
      if (i === 0) token = `{{#${loopField.name}}}${token}`;
      if (i === subFields.length - 1) token = `${token}{{/${loopField.name}}}`;
      const nextCell = setFirstTextNode(dataCells[i].xml, token);
      nextRow = replaceRange(nextRow, dataCells[i], nextCell);
    }

    return replaceRange(tableXml, dataRow, nextRow);
  });
}

export async function injectPlaceholders(
  buffer: ArrayBuffer,
  fields: InjectableField[]
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);

  for (const path of DOCX_XML_FILES) {
    const file = zip.file(path);
    if (!file) continue;

    let xml = await file.async("string");
    xml = injectLoopTables(xml, fields);
    xml = injectTwoColumnBlankCells(xml, fields);
    xml = replaceFieldsInTextFragments(xml, fields);
    zip.file(path, xml);
  }

  return (await zip.generateAsync({ type: "arraybuffer" })) as ArrayBuffer;
}

export async function restoreRemovedPlaceholders(
  buffer: ArrayBuffer,
  removedFields: InjectableField[]
): Promise<ArrayBuffer> {
  if (removedFields.length === 0) return buffer;

  const zip = await JSZip.loadAsync(buffer);

  for (const path of DOCX_XML_FILES) {
    const file = zip.file(path);
    if (!file) continue;

    let xml = await file.async("string");
    xml = restoreFieldsInTextFragments(xml, removedFields);
    zip.file(path, xml);
  }

  return (await zip.generateAsync({ type: "arraybuffer" })) as ArrayBuffer;
}
