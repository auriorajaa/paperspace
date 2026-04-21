// lib/placeholder-detector.ts
export type FieldType =
  | "text"
  | "date"
  | "number"
  | "email"
  | "loop"
  | "condition"
  | "condition_inverse";

export type PlaceholderFormat = "double_curly";

export interface DetectedField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
  format: PlaceholderFormat;
  subFields?: DetectedField[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function inferType(_name: string): FieldType {
  return "text"; // User determines format manually on the fill page
}

// FIX: use crypto.randomUUID() instead of a module-level counter.
// A shared mutable counter across requests is not safe under concurrent
// serverless invocations — two requests landing in the same warm instance
// at the same millisecond could produce identical IDs.
function makeId(): string {
  return `field_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

// ── Main detector — docxtemplater {{ }} format ────────────────────────────────

/**
 * Detects docxtemplater placeholders in plain text.
 * Delimiter config: { start: "{{", end: "}}" }
 *
 * Supported patterns:
 *   {{field}}           → simple value (text/number/date/email)
 *   {{#section}}        → loop open  OR condition open (truthy)
 *   {{/section}}        → loop/condition close
 *   {{^section}}        → inverse condition (falsy — show when false/empty)
 *
 * Docxtemplater determines at render time whether a section is a loop
 * (array) or condition (boolean). We infer from name heuristics.
 */
export function detectPlaceholders(text: string): DetectedField[] {
  const seen = new Set<string>();
  const fields: DetectedField[] = [];

  // ── 1. Section opens: {{#name}} and {{^name}} ──────────────────────────────
  const sectionOpenRe = /\{\{([#^])([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;
  let m: RegExpExecArray | null;

  while ((m = sectionOpenRe.exec(text)) !== null) {
    const operator = m[1]; // '#' or '^'
    const rawName = m[2].trim();
    const name = normalizeName(rawName);
    if (!name || seen.has(name)) continue;
    seen.add(name);

    // Find close tag
    const closeRe = new RegExp(
      `\\{\\{/\\s*${rawName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`,
      "g"
    );
    const openIdx = m.index + m[0].length;
    closeRe.lastIndex = openIdx;
    const closeMatch = closeRe.exec(text);
    const blockContent = closeMatch
      ? text.slice(openIdx, closeMatch.index)
      : "";

    if (operator === "^") {
      // Inverse condition: show when value is false/empty
      fields.push({
        id: makeId(),
        name,
        label: toLabel(name),
        type: "condition_inverse",
        required: false,
        placeholder: `{{^${name}}}…{{/${name}}}`,
        format: "double_curly",
      });
    } else {
      // '#' — could be loop (array) or condition (boolean)
      // Heuristic: if block contains sub-placeholders, treat as loop
      const subPlaceholders = [
        ...blockContent.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g),
      ];
      const isLoop =
        subPlaceholders.length > 0 ||
        /(items|rows|list|data|records|entries|table|tabel|baris|daftar)/.test(
          name
        );

      const subFields: DetectedField[] = [];
      if (isLoop && subPlaceholders.length > 0) {
        for (const sub of subPlaceholders) {
          const subName = normalizeName(sub[1]);
          if (!subName || seen.has(`sub:${name}:${subName}`)) continue;
          seen.add(`sub:${name}:${subName}`);
          subFields.push({
            id: makeId(),
            name: subName,
            label: toLabel(subName),
            type: inferType(subName),
            required: false,
            placeholder: `{{${subName}}}`,
            format: "double_curly",
          });
        }
      }

      fields.push({
        id: makeId(),
        name,
        label: toLabel(name),
        type: isLoop ? "loop" : "condition",
        required: isLoop,
        placeholder: isLoop
          ? `{{#${name}}}…{{/${name}}}`
          : `{{#${name}}}…{{/${name}}}`,
        format: "double_curly",
        subFields: subFields.length > 0 ? subFields : undefined,
      });
    }
  }

  // ── 2. Simple fields: {{field_name}} ──────────────────────────────────────
  // Must NOT start with # / ^
  const simpleRe = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;
  while ((m = simpleRe.exec(text)) !== null) {
    const name = normalizeName(m[1]);
    if (!name || seen.has(name)) continue;
    seen.add(name);

    fields.push({
      id: makeId(),
      name,
      label: toLabel(name),
      type: inferType(name),
      required: true,
      placeholder: `{{${name}}}`,
      format: "double_curly",
    });
  }

  return fields;
}
