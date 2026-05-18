// components/LightDocxPreview.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2Icon, MousePointerClickIcon } from "lucide-react";

export type FieldType =
  | "text"
  | "date"
  | "number"
  | "email"
  | "phone"
  | "loop"
  | "condition"
  | "condition_inverse";

export interface ReviewField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
  confidence?: number;
  source?:
    | "label_colon"
    | "table_2col"
    | "table_loop"
    | "underline_blank"
    | "form_box"
    | "recipient_block"
    | "manual";
  targetText?: string;
  contextText?: string;
  replacementText?: string;
  originalPlaceholder?: string;
  subFields?: Omit<ReviewField, "subFields">[];
  isNew?: boolean;
}

interface Props {
  docxBuffer: ArrayBuffer | null;
  fields: ReviewField[];
  onAddPlaceholder: (selectedText: string, type: FieldType) => void;
  preferPdfPreview?: boolean;
}

interface SelectionMenu {
  text: string;
  x: number;
  y: number;
  openedAt: number;
}

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfRenderTask {
  promise: Promise<void>;
}

interface PdfPage {
  getViewport(params: { scale: number }): PdfViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }): PdfRenderTask;
  getTextContent(): Promise<unknown>;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void> | void;
}

interface PdfTextLayer {
  render(): Promise<void>;
}

interface PdfTextLayerConstructor {
  new (options: {
    textContentSource: unknown;
    container: HTMLElement;
    viewport: PdfViewport;
  }): PdfTextLayer;
}

interface RelativeRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

interface TextSpanRange {
  span: HTMLElement;
  text: string;
  start: number;
  end: number;
}

const DOCX_CHIP_HOVER_KEY = "__lcpDocxChipHover";

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldMarkerLabel(field: ReviewField) {
  const label = field.label?.trim() || field.name.replace(/_/g, " ");
  return label.length > 24 ? `${label.slice(0, 23)}…` : label;
}

function getFieldTokens(field: ReviewField) {
  const tokens = new Set<string>();
  if (field.type === "loop") {
    tokens.add(`{{#${field.name}}}`);
    tokens.add(`{{/${field.name}}}`);
    field.subFields?.forEach((sf) => tokens.add(`{{${sf.name}}}`));
  } else if (field.type === "condition") {
    tokens.add(`{{#${field.name}}}`);
    tokens.add(`{{/${field.name}}}`);
  } else if (field.type === "condition_inverse") {
    tokens.add(`{{^${field.name}}}`);
    tokens.add(`{{/${field.name}}}`);
  } else {
    tokens.add(`{{${field.name}}}`);
  }
  if (field.originalPlaceholder) tokens.add(field.originalPlaceholder);
  if (field.replacementText) tokens.add(field.replacementText);
  if (field.targetText && field.targetText.trim().length > 1)
    tokens.add(field.targetText.trim());
  return [...tokens].filter((t) => t.trim().length > 1);
}

function isPdfTextLayerNode(node: Node): boolean {
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return Boolean(el?.closest(".pdf-review-text-layer"));
}

function unwrapHighlights(container: HTMLElement) {
  container.querySelectorAll(".field-highlight").forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  });
}

// ── Occurrence-aware DOM walker ────────────────────────────────────────────────

interface MatchEntry {
  index: number;
  end: number;
  token: string;
  field: ReviewField;
}

function walkAndReplaceAll(
  node: Node,
  tokenToFields: Map<string, ReviewField[]>,
  occurrenceCounters: Map<string, number>
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    if (isPdfTextLayerNode(node)) return;
    const text = node.textContent ?? "";
    if (!text) return;
    const parent = node.parentNode;
    if (!parent) return;

    const allMatches: MatchEntry[] = [];

    for (const [token, fields] of tokenToFields) {
      if (!fields.length) continue;
      const re = new RegExp(escapeRegex(token), "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const consumed = occurrenceCounters.get(token) ?? 0;
        const field = fields[Math.min(consumed, fields.length - 1)];
        allMatches.push({
          index: m.index,
          end: m.index + token.length,
          token,
          field,
        });
        occurrenceCounters.set(token, consumed + 1);
      }
    }

    if (!allMatches.length) return;

    allMatches.sort((a, b) => a.index - b.index);

    const parts: Node[] = [];
    let cursor = 0;

    for (const match of allMatches) {
      if (match.index < cursor) continue;
      if (match.index > cursor) {
        parts.push(document.createTextNode(text.slice(cursor, match.index)));
      }
      const mark = document.createElement("span");
      mark.className = "field-highlight";
      mark.dataset.fieldId = match.field.id;
      mark.dataset.fieldName = match.field.name;
      mark.dataset.fieldType = match.field.type;
      mark.dataset.fieldLabel = fieldMarkerLabel(match.field);
      mark.title = match.field.label;
      mark.textContent = text.slice(match.index, match.end);
      parts.push(mark);
      cursor = match.end;
    }

    if (cursor < text.length) {
      parts.push(document.createTextNode(text.slice(cursor)));
    }

    for (const part of parts) parent.insertBefore(part, node);
    parent.removeChild(node);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (
    ["SCRIPT", "STYLE", "TEXTAREA"].includes((el as HTMLElement).tagName) ||
    el.classList.contains("field-highlight") ||
    el.classList.contains("docx-review-field-layer") ||
    el.classList.contains("pdf-review-field-layer") ||
    el.classList.contains("pdf-review-text-layer")
  )
    return;
  for (const child of Array.from(node.childNodes))
    walkAndReplaceAll(child, tokenToFields, occurrenceCounters);
}

// ── Same-value sibling-aware token map builder ─────────────────────────────────
//
// PROBLEM: indexed fields like pangkat_golongan_1 / pangkat_golongan_2 often
// share an identical targetText (e.g. both persons have the same pangkat/jabatan).
// When the document was injected, the injector may have written {{pangkat_golongan_1}}
// for BOTH occurrences (since it can't distinguish them by value). This leaves
// {{pangkat_golongan_2}} absent from the document, so _2 never gets a chip.
//
// FIX: After building the initial token→fields map, extend any single-field token
// whose field has same-targetText siblings, so the occurrence counter can assign:
//   first  {{pangkat_golongan_1}} → pangkat_golongan_1
//   second {{pangkat_golongan_1}} → pangkat_golongan_2
//
// This works equally for both the DOCX inline-highlight path and the PDF overlay
// path, and does not affect fields with unique values (occurrence counter still
// advances field[0] → field[0] with no siblings to spill into).

function buildTokenToFieldsMap(
  fields: ReviewField[],
  tokenFilter?: (token: string) => boolean
): Map<string, ReviewField[]> {
  // Step 1a — Group fields by targetText
  const siblingsByTargetText = new Map<string, ReviewField[]>();
  // Step 1b — Group fields by base name (strips _N suffix)
  //   e.g. pangkat_golongan_1 and pangkat_golongan_2 → "pangkat_golongan"
  //   Used as fallback when _2 has no targetText so Step 1a only finds _1.
  const siblingsByBaseName = new Map<string, ReviewField[]>();

  fields.forEach((field) => {
    const key = field.targetText?.trim();
    if (key && key.length >= 2) {
      const arr = siblingsByTargetText.get(key) ?? [];
      arr.push(field);
      siblingsByTargetText.set(key, arr);
    }
    const baseName = field.name.replace(/_\d+$/, "");
    if (baseName !== field.name) {
      const arr = siblingsByBaseName.get(baseName) ?? [];
      arr.push(field);
      siblingsByBaseName.set(baseName, arr);
    }
  });

  // Step 2 — Build initial token → fields map (preserving field-array order)
  const tokenToFields = new Map<string, ReviewField[]>();
  fields.forEach((field) => {
    getFieldTokens(field).forEach((token) => {
      const trimmed = token.trim();
      if (trimmed.length < 2) return;
      if (tokenFilter && !tokenFilter(trimmed)) return;
      const existing = tokenToFields.get(trimmed) ?? [];
      existing.push(field);
      tokenToFields.set(trimmed, existing);
    });
  });

  // Step 3 — Extend single-field tokens with their same-value siblings so the
  //   occurrence counter can assign _1 → first match, _2 → second match, etc.
  //
  //   Strategy A: same targetText (existing behaviour).
  //   Strategy B: same base name — fallback for indexed fields where some siblings
  //     have no targetText (e.g. AI only returned targetText for _1, not _2).
  //     Without this, {{pangkat_golongan_1}} stays as [_1] and BOTH document
  //     occurrences end up labelled _1.
  for (const [, tokenFields] of tokenToFields) {
    if (tokenFields.length !== 1) continue;
    const field = tokenFields[0];

    const ttext = field.targetText?.trim();
    const sibsByTT =
      ttext && ttext.length >= 2 ? siblingsByTargetText.get(ttext) : undefined;

    const baseName = field.name.replace(/_\d+$/, "");
    const sibsByBN =
      baseName !== field.name ? siblingsByBaseName.get(baseName) : undefined;

    // Pick whichever group is larger (more siblings = better coverage)
    const siblings =
      (sibsByTT?.length ?? 0) >= (sibsByBN?.length ?? 0) ? sibsByTT : sibsByBN;

    if (!siblings || siblings.length <= 1) continue;

    siblings.forEach((sib) => {
      if (!tokenFields.some((f) => f.id === sib.id)) tokenFields.push(sib);
    });
  }

  return tokenToFields;
}

// ── DOCX same-value safety net ─────────────────────────────────────────────────
//
// After walkAndReplaceAll, indexed fields that share the same targetText
// (e.g. jabatan_1 / jabatan_2 both → "Dosen Jurusan Teknik Informatika dan
// Komputer") should be assigned top-to-bottom by visual position.
// walkAndReplaceAll processes nodes in DOM order which normally matches
// visual order, but this post-pass corrects any edge cases (e.g. when
// docx-preview emits table cells in non-sequential DOM order).

function reorderSameValueHighlights(
  container: HTMLElement,
  fields: ReviewField[]
): void {
  // Group 1: by targetText — catches fields with the same original document value
  const targetTextToFields = new Map<string, ReviewField[]>();
  fields.forEach((field) => {
    const key = field.targetText?.trim();
    if (!key || key.length < 2) return;
    const group = targetTextToFields.get(key) ?? [];
    group.push(field);
    targetTextToFields.set(key, group);
  });

  // Group 2: by base name — catches indexed fields even when some lack targetText
  //   e.g. pangkat_golongan_1 / pangkat_golongan_2 → base "pangkat_golongan"
  const baseNameToFields = new Map<string, ReviewField[]>();
  fields.forEach((field) => {
    const baseName = field.name.replace(/_\d+$/, "");
    if (baseName === field.name) return;
    const group = baseNameToFields.get(baseName) ?? [];
    group.push(field);
    baseNameToFields.set(baseName, group);
  });

  // Merge both strategies into one set of groups to process
  const groupsToProcess = new Map<string, ReviewField[]>();
  for (const [key, group] of targetTextToFields) {
    if (group.length > 1) groupsToProcess.set(`tt:${key}`, group);
  }
  for (const [baseName, group] of baseNameToFields) {
    if (group.length > 1) groupsToProcess.set(`bn:${baseName}`, group);
  }
  if (groupsToProcess.size === 0) return;

  const fieldOrder = new Map(fields.map((f, i) => [f.id, i]));
  const allHighlights = Array.from(
    container.querySelectorAll<HTMLElement>(".field-highlight")
  );

  for (const [, group] of groupsToProcess) {
    const groupIds = new Set(group.map((f) => f.id));
    // Also match by fieldName — critical when walkAndReplaceAll incorrectly assigned
    // every occurrence of {{pangkat_golongan_1}} to _1's id/name (because the
    // extension in buildTokenToFieldsMap had no siblings to work with).
    const groupNames = new Set(group.map((f) => f.name));

    const relevantHighlights = allHighlights.filter((el) => {
      const fid = el.dataset.fieldId ?? "";
      const fname = el.dataset.fieldName ?? "";
      return groupIds.has(fid) || groupNames.has(fname);
    });

    if (relevantHighlights.length <= 1) continue;

    // Sort top-to-bottom, left-to-right
    const sorted = [...relevantHighlights].sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const dt = ar.top - br.top;
      if (Math.abs(dt) > 2) return dt;
      return ar.left - br.left;
    });

    // Fields in panel order (_1 first, _2 second, …)
    const sortedFields = [...group].sort(
      (a, b) => (fieldOrder.get(a.id) ?? 0) - (fieldOrder.get(b.id) ?? 0)
    );

    sorted.forEach((highlight, i) => {
      const field = sortedFields[Math.min(i, sortedFields.length - 1)];
      highlight.dataset.fieldId = field.id;
      highlight.dataset.fieldName = field.name;
      highlight.dataset.fieldType = field.type;
      highlight.dataset.fieldLabel = fieldMarkerLabel(field);
      highlight.title = field.label;
    });
  }
}

function applyHighlights(container: HTMLElement, fields: ReviewField[]) {
  unwrapHighlights(container);
  if (!fields.length) return;

  const tokenToFields = buildTokenToFieldsMap(fields);

  const occurrenceCounters = new Map<string, number>();
  walkAndReplaceAll(container, tokenToFields, occurrenceCounters);

  // ── FALLBACK for docx-preview text fragmentation ──
  // docx-preview often splits text into tiny text nodes / spans (per-word
  // or per-character). walkAndReplaceAll regex on a single text node then
  // fails to match long targetText values. We do an element-level sweep
  // to catch any field whose targetText appears inside a block element
  // but was missed by the per-node walker.
  const highlightedIds = new Set(
    Array.from(container.querySelectorAll<HTMLElement>(".field-highlight")).map(
      (h) => h.dataset.fieldId
    )
  );

  for (const field of fields) {
    if (highlightedIds.has(field.id)) continue;
    const needle =
      field.targetText?.trim() || field.originalPlaceholder?.trim();
    if (!needle || needle.length < 2) continue;

    // Search all leaf elements whose textContent contains the needle
    const candidates = Array.from(container.querySelectorAll("*")).filter(
      (el) => {
        if (el.classList.contains("field-highlight")) return false;
        if (el.classList.contains("docx-review-field-layer")) return false;
        const tc = el.textContent || "";
        return tc.includes(needle);
      }
    );

    if (!candidates.length) continue;

    // Pick the deepest (smallest) element that still contains the full needle
    // Sort by textContent length ascending → most specific match first
    candidates.sort(
      (a, b) => (a.textContent?.length || 0) - (b.textContent?.length || 0)
    );
    const best = candidates[0] as HTMLElement;

    // Wrap the entire element content in a highlight mark
    // We preserve children by wrapping only text nodes, or the whole element
    // if it has no element children.
    if (best.children.length === 0) {
      // Simple case: leaf element with only text
      const mark = document.createElement("span");
      mark.className = "field-highlight";
      mark.dataset.fieldId = field.id;
      mark.dataset.fieldName = field.name;
      mark.dataset.fieldType = field.type;
      mark.dataset.fieldLabel = fieldMarkerLabel(field);
      mark.title = field.label;
      mark.textContent = best.textContent || "";
      best.textContent = "";
      best.appendChild(mark);
      highlightedIds.add(field.id);
    } else {
      // Complex case: element has mixed content.
      // We wrap each direct text node that contains part of the needle.
      const childNodes = Array.from(best.childNodes);
      let found = false;
      for (const node of childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const txt = node.textContent || "";
        if (!txt.trim()) continue;
        // Fuzzy: if this text node is part of the needle or the needle is part of it
        if (needle.includes(txt.trim()) || txt.includes(needle)) {
          const mark = document.createElement("span");
          mark.className = "field-highlight";
          mark.dataset.fieldId = field.id;
          mark.dataset.fieldName = field.name;
          mark.dataset.fieldType = field.type;
          mark.dataset.fieldLabel = fieldMarkerLabel(field);
          mark.title = field.label;
          mark.textContent = txt;
          if (node.parentNode) node.parentNode.replaceChild(mark, node);
          found = true;
        }
      }
      if (found) highlightedIds.add(field.id);
    }
  }

  // Safety net: ensure same-value indexed fields are visually top-to-bottom.
  reorderSameValueHighlights(container, fields);
}

function clearPdfFieldOverlays(container: HTMLElement) {
  container
    .querySelectorAll(".pdf-review-field-layer")
    .forEach((el) => el.remove());
}

function clearDocxFieldOverlays(container: HTMLElement) {
  const stored = (container as unknown as Record<string, unknown>)[
    DOCX_CHIP_HOVER_KEY
  ] as { over: EventListener; leave: EventListener } | undefined;
  if (stored) {
    container.removeEventListener("mouseover", stored.over);
    container.removeEventListener("mouseleave", stored.leave);
    delete (container as unknown as Record<string, unknown>)[
      DOCX_CHIP_HOVER_KEY
    ];
  }
  container
    .querySelectorAll(".docx-review-field-layer")
    .forEach((el) => el.remove());
}

function relativeRect(rect: DOMRect, parentRect: DOMRect): RelativeRect {
  return {
    left: rect.left - parentRect.left,
    top: rect.top - parentRect.top,
    width: rect.width,
    height: rect.height,
    right: rect.right - parentRect.left,
    bottom: rect.bottom - parentRect.top,
  };
}

function addPdfFieldBand(
  overlay: HTMLElement,
  field: ReviewField,
  rect: RelativeRect
) {
  const band = document.createElement("div");
  band.className = "pdf-field-band";
  band.dataset.fieldId = field.id;
  band.dataset.fieldName = field.name;
  band.dataset.fieldType = field.type;
  band.style.left = `${rect.left}px`;
  band.style.top = `${rect.top}px`;
  band.style.width = `${rect.width}px`;
  band.style.height = `${Math.max(rect.height, 6)}px`;
  overlay.appendChild(band);
}

function addFieldChip(
  overlay: HTMLElement,
  field: ReviewField,
  rect: RelativeRect,
  bounds: { width: number; height: number },
  className: string
) {
  const label = fieldMarkerLabel(field);
  const chipWidth = clamp(label.length * 5.8 + 22, 54, 140);
  const chipHeight = 18;
  const gap = 4;

  let top = rect.top - chipHeight - gap;
  if (top < 4) top = rect.bottom + gap;
  top = clamp(top, 4, bounds.height - chipHeight - 4);

  let left = rect.left + rect.width / 2 - chipWidth / 2;
  left = clamp(left, 4, bounds.width - chipWidth - 4);

  const chip = document.createElement("div");
  chip.className = className;
  chip.dataset.fieldId = field.id;
  chip.dataset.fieldName = field.name;
  chip.dataset.fieldType = field.type;
  chip.textContent = label;
  chip.title = field.label;
  chip.style.left = `${left}px`;
  chip.style.top = `${top}px`;
  chip.style.width = `${chipWidth}px`;
  overlay.appendChild(chip);
}

function updateChipStates(
  overlay: HTMLElement,
  chipSelector: string,
  activeFieldId: string | null
) {
  overlay.querySelectorAll<HTMLElement>(chipSelector).forEach((chip) => {
    if (!activeFieldId) {
      chip.classList.remove("chip-active", "chip-dimmed");
    } else if (chip.dataset.fieldId === activeFieldId) {
      chip.classList.add("chip-active");
      chip.classList.remove("chip-dimmed");
    } else {
      chip.classList.add("chip-dimmed");
      chip.classList.remove("chip-active");
    }
  });
}

function deconflictChips(overlay: HTMLElement, chipSelector: string) {
  const chips = Array.from(overlay.querySelectorAll<HTMLElement>(chipSelector));
  if (chips.length < 2) return;

  chips.sort((a, b) => {
    const dt = parseFloat(a.style.top || "0") - parseFloat(b.style.top || "0");
    if (Math.abs(dt) > 2) return dt;
    return parseFloat(a.style.left || "0") - parseFloat(b.style.left || "0");
  });

  const chipH = 18;
  const vGap = 3;
  const hGap = 4;

  for (let i = 1; i < chips.length; i++) {
    const prev = chips[i - 1];
    const curr = chips[i];
    const pt = parseFloat(prev.style.top || "0");
    const pl = parseFloat(prev.style.left || "0");
    const pw = parseFloat(prev.style.width || "60");
    const ct = parseFloat(curr.style.top || "0");
    const cl = parseFloat(curr.style.left || "0");
    const cw = parseFloat(curr.style.width || "60");

    const vertOverlap = ct < pt + chipH + vGap;
    const horizOverlap = cl < pl + pw + hGap && cl + cw > pl - hGap;

    if (vertOverlap && horizOverlap) {
      curr.style.top = prev.style.top;
      curr.style.left = `${pl + pw + hGap}px`;
    }
  }
}

// ── PDF field overlays ─────────────────────────────────────────────────────────
//
// FIX (same-value siblings): Same-value indexed fields (e.g. jabatan_1 /
// jabatan_2 both targeting "Dosen Jurusan …") are handled by two mechanisms:
//
//   1. buildTokenToFieldsMap() extends {{jabatan_1}}'s list to
//      [jabatan_1, jabatan_2] so the occurrence counter can assign them
//      correctly even when {{jabatan_2}} never appears in the document.
//
//   2. Phase 2 sorts all matches by visual rect before incrementing the
//      counter, ensuring topmost occurrence → _1, next → _2, regardless of
//      the order pdfjs returned the text spans.

interface PdfPageMatchEntry {
  token: string;
  tokenFields: ReviewField[];
  rects: RelativeRect[];
}

function renderPdfFieldOverlays(container: HTMLElement, fields: ReviewField[]) {
  clearPdfFieldOverlays(container);
  if (!fields.length) return;

  const pages = Array.from(
    container.querySelectorAll<HTMLElement>(".pdf-review-page")
  );

  // occurrenceCounters is shared across all pages so that indexed fields
  // spanning multiple pages (jabatan_1 on p1, jabatan_2 on p2) are assigned
  // correctly without resetting at each page boundary.
  const occurrenceCounters = new Map<string, number>();

  // console.log("[renderPdfFieldOverlays] pages:", pages.length);
  // Build token→fields map once for the whole document.
  // buildTokenToFieldsMap() automatically extends single-field tokens with
  // their same-targetText siblings (the key fix for identical-value fields).
  const tokenToFields = buildTokenToFieldsMap(
    fields,
    (token) => token.includes("{{") || token.length >= 3
  );
  // console.log(
  //   "[renderPdfFieldOverlays] tokenToFields:",
  //   Array.from(tokenToFields.entries()).map(([k, v]) => [
  //     k,
  //     v.map((f) => f.name),
  //   ])
  // );

  pages.forEach((pageEl, pageIndex) => {
    const textLayer = pageEl.querySelector<HTMLElement>(
      ".pdf-review-text-layer"
    );
    if (!textLayer) return;

    const pageRect = pageEl.getBoundingClientRect();
    const spans = Array.from(
      textLayer.querySelectorAll<HTMLElement>("span")
    ).filter(
      (span) =>
        (span.textContent ?? "").length > 0 && span.getClientRects().length > 0
    );
    if (!spans.length) return;

    const ranges: TextSpanRange[] = [];
    let cursor = 0;
    spans.forEach((span) => {
      const text = span.textContent ?? "";
      ranges.push({ span, text, start: cursor, end: cursor + text.length });
      cursor += text.length;
    });

    const pageText = ranges.map((r) => r.text).join("");
    // console.log(
    //   "[renderPdfFieldOverlays] page",
    //   pageIndex,
    //   "text length:",
    //   pageText.length,
    //   "sample:",
    //   pageText.slice(0, 100)
    // );
    if (!pageText.trim()) return;

    const overlay = document.createElement("div");
    overlay.className = "pdf-review-field-layer";
    pageEl.appendChild(overlay);

    // ── Phase 1: collect all matches with their visual rects ────────────────
    const pageMatchEntries: PdfPageMatchEntry[] = [];

    for (const [token, tokenFields] of tokenToFields) {
      if (!tokenFields.length) continue;
      let index = pageText.indexOf(token);
      while (index !== -1) {
        const matchEnd = index + token.length;
        const hitRanges = ranges.filter(
          (r) => r.end > index && r.start < matchEnd
        );
        const rects = hitRanges
          .flatMap((r) => Array.from(r.span.getClientRects()))
          .map((r) => relativeRect(r, pageRect))
          .filter((r) => r.width > 0 && r.height > 0);

        // Only record matches that have valid visual rects. Matches without
        // rects (invisible / off-canvas text) are intentionally skipped so
        // they do not consume an occurrence counter slot and displace the
        // assignment of the next visible occurrence.
        if (rects.length > 0) {
          pageMatchEntries.push({ token, tokenFields, rects });
        }

        index = pageText.indexOf(token, matchEnd);
      }
    }

    // console.log(
    //   "[renderPdfFieldOverlays] page",
    //   pageIndex,
    //   "match entries:",
    //   pageMatchEntries.map((m) => ({
    //     token: m.token.slice(0, 30),
    //     rects: m.rects.length,
    //   }))
    // );
    // ── Phase 2: sort by visual position, then assign fields ────────────────
    //
    // Sorting top→left guarantees that when jabatan_1 and jabatan_2 share the
    // same targetText, the one physically higher on the page always gets _1
    // regardless of how pdfjs ordered the text spans internally.
    pageMatchEntries.sort((a, b) => {
      const dt = a.rects[0].top - b.rects[0].top;
      if (Math.abs(dt) > 2) return dt;
      return a.rects[0].left - b.rects[0].left;
    });

    const renderedBands = new Set<string>();
    const renderedChips = new Set<string>();

    for (const { token, tokenFields, rects } of pageMatchEntries) {
      const consumed = occurrenceCounters.get(token) ?? 0;
      const field = tokenFields[Math.min(consumed, tokenFields.length - 1)];
      occurrenceCounters.set(token, consumed + 1);

      rects.forEach((rect) => {
        const key = [
          pageIndex,
          field.id,
          Math.round(rect.left),
          Math.round(rect.top),
          Math.round(rect.width),
          Math.round(rect.height),
        ].join(":");
        if (renderedBands.has(key)) return;
        renderedBands.add(key);
        addPdfFieldBand(overlay, field, rect);
      });

      const firstRect = rects[0];
      const chipKey = `${pageIndex}:${field.id}`;
      if (!renderedChips.has(chipKey)) {
        renderedChips.add(chipKey);
        addFieldChip(
          overlay,
          field,
          firstRect,
          { width: pageEl.clientWidth, height: pageEl.clientHeight },
          "pdf-field-chip"
        );
      }
    }

    if (!overlay.childElementCount) {
      overlay.remove();
      return;
    }

    // console.log(
    //   "[renderPdfFieldOverlays] page",
    //   pageIndex,
    //   "bands:",
    //   overlay.querySelectorAll(".pdf-field-band").length,
    //   "chips:",
    //   overlay.querySelectorAll(".pdf-field-chip").length
    // );
    deconflictChips(overlay, ".pdf-field-chip");

    overlay.addEventListener("mouseover", (e: MouseEvent) => {
      const band = (e.target as HTMLElement).closest<HTMLElement>(
        ".pdf-field-band"
      );
      updateChipStates(
        overlay,
        ".pdf-field-chip",
        band?.dataset.fieldId ?? null
      );
    });
    overlay.addEventListener("mouseleave", () => {
      updateChipStates(overlay, ".pdf-field-chip", null);
    });
  });
}

function renderDocxFieldOverlays(
  container: HTMLElement,
  fields: ReviewField[]
) {
  clearDocxFieldOverlays(container);
  if (!fields.length) return;

  const highlights = Array.from(
    container.querySelectorAll<HTMLElement>(".field-highlight")
  );
  if (!highlights.length) return;

  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const overlay = document.createElement("div");
  overlay.className = "docx-review-field-layer";
  container.appendChild(overlay);

  const containerRect = container.getBoundingClientRect();
  const renderedChips = new Set<string>();

  highlights.forEach((highlight) => {
    const fieldId = highlight.dataset.fieldId;
    if (!fieldId || renderedChips.has(fieldId)) return;
    const field = fieldById.get(fieldId);
    if (!field) return;
    const rect = highlight.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    renderedChips.add(fieldId);
    addFieldChip(
      overlay,
      field,
      relativeRect(rect, containerRect),
      {
        width: Math.max(container.scrollWidth, container.clientWidth),
        height: Math.max(container.scrollHeight, container.clientHeight),
      },
      "docx-field-chip"
    );
  });

  if (!overlay.childElementCount) {
    overlay.remove();
    return;
  }

  deconflictChips(overlay, ".docx-field-chip");

  const overHandler: EventListener = (e) => {
    const highlight = (e.target as HTMLElement).closest<HTMLElement>(
      ".field-highlight"
    );
    updateChipStates(
      overlay,
      ".docx-field-chip",
      highlight?.dataset.fieldId ?? null
    );
  };
  const leaveHandler: EventListener = () => {
    updateChipStates(overlay, ".docx-field-chip", null);
  };

  (container as unknown as Record<string, unknown>)[DOCX_CHIP_HOVER_KEY] = {
    over: overHandler,
    leave: leaveHandler,
  };
  container.addEventListener("mouseover", overHandler);
  container.addEventListener("mouseleave", leaveHandler);
}

function refreshFieldMarkers(container: HTMLElement, fields: ReviewField[]) {
  clearDocxFieldOverlays(container);
  if (container.querySelector(".pdf-review-page")) {
    renderPdfFieldOverlays(container, fields);
    return;
  }
  clearPdfFieldOverlays(container);
  applyHighlights(container, fields);
  renderDocxFieldOverlays(container, fields);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function positionForSelection(rect: DOMRect): { x: number; y: number } {
  const menuWidth = 288;
  const menuHeight = 184;
  const margin = 12;
  const rightX = rect.right + 14 + menuWidth / 2;
  const leftX = rect.left - 14 - menuWidth / 2;
  let x =
    rightX + menuWidth / 2 < window.innerWidth - margin
      ? rightX
      : leftX - menuWidth / 2 > margin
        ? leftX
        : rect.left + rect.width / 2;
  let y = rect.top;
  if (y + menuHeight > window.innerHeight - margin)
    y = window.innerHeight - margin - menuHeight;
  x = clamp(
    x,
    margin + menuWidth / 2,
    window.innerWidth - margin - menuWidth / 2
  );
  return { x: Math.max(margin, y), y: Math.max(margin, y) };
}

async function convertDocxToPdf(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "preview.docx"
  );
  const response = await fetch("/api/convert/docx-to-pdf", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    let message = "Failed to convert document preview.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text;
    }
    throw new Error(message);
  }
  return response.arrayBuffer();
}

function waitForContainerWidth(
  container: HTMLElement,
  minWidth = 160,
  timeoutMs = 3000
): Promise<void> {
  const measure = () =>
    container.clientWidth ||
    container.parentElement?.clientWidth ||
    container.closest<HTMLElement>(
      ".overflow-hidden, .overflow-auto, [class*='flex-1']"
    )?.clientWidth ||
    0;

  if (measure() >= minWidth) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      resolve();
    };
    const observer = new ResizeObserver(() => {
      if (measure() >= minWidth) done();
    });
    observer.observe(container);
    if (container.parentElement) observer.observe(container.parentElement);
    setTimeout(done, timeoutMs);
  });
}

async function renderPdfPreview(
  pdfBuffer: ArrayBuffer,
  container: HTMLElement
) {
  await waitForContainerWidth(container);

  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

  const pdf = (await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) })
    .promise) as unknown as PdfDocument;
  const TextLayer = pdfjsLib.TextLayer as unknown as PdfTextLayerConstructor;

  container.innerHTML = "";

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      let page: PdfPage | null = null;
      try {
        page = await pdf.getPage(pageNumber);
      } catch {
        const errEl = document.createElement("div");
        errEl.className = "pdf-review-page pdf-review-page--error";
        container.appendChild(errEl);
        continue;
      }

      const rawWidth =
        container.clientWidth || container.parentElement?.clientWidth || 0;
      const availableWidth = Math.max(rawWidth - 48, 320);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(
        1.6,
        Math.max(0.55, availableWidth / baseViewport.width)
      );
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      const pageEl = document.createElement("div");
      pageEl.className = "pdf-review-page";
      pageEl.style.width = `${viewport.width}px`;
      pageEl.style.height = `${viewport.height}px`;
      pageEl.style.setProperty("--total-scale-factor", String(scale));

      const canvas = document.createElement("canvas");
      canvas.className = "pdf-review-canvas";
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const textLayerEl = document.createElement("div");
      textLayerEl.className = "pdf-review-text-layer textLayer";
      textLayerEl.style.width = `${viewport.width}px`;
      textLayerEl.style.height = `${viewport.height}px`;
      textLayerEl.style.setProperty("--total-scale-factor", String(scale));

      pageEl.appendChild(canvas);
      pageEl.appendChild(textLayerEl);
      container.appendChild(pageEl);

      try {
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        continue;
      }

      try {
        const textContent = await page.getTextContent();
        await new TextLayer({
          textContentSource: textContent,
          container: textLayerEl,
          viewport,
        }).render();
      } catch {
        // Canvas is still rendered; silently skip the text layer.
      }
    }
  } finally {
    await pdf.destroy();
  }
}

async function looksLikePdfConvertedDocx(
  buffer: ArrayBuffer
): Promise<boolean> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    if (!xml) return false;
    const anchorCount = xml.match(/<wp:anchor\b/g)?.length ?? 0;
    const drawingCount = xml.match(/<w:drawing\b/g)?.length ?? 0;
    const textBoxCount =
      xml.match(/<(?:w:)?txbxContent\b|<wps:txbx\b/g)?.length ?? 0;
    return anchorCount > 8 || textBoxCount > 8 || drawingCount > 40;
  } catch {
    return false;
  }
}

export default function LightDocxPreview({
  docxBuffer,
  fields,
  onAddPlaceholder,
  preferPdfPreview = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fieldsRef = useRef(fields);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenu | null>(
    null
  );
  const [loadingLabel, setLoadingLabel] = useState("Loading preview...");

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  useEffect(() => {
    if (!docxBuffer || !bodyRef.current || !styleRef.current) return;
    let cancelled = false;
    const body = bodyRef.current;
    const styles = styleRef.current;
    setLoading(true);
    setError(null);

    const renderPdfFallback = async () => {
      setLoadingLabel("Preparing exact preview…");
      body.innerHTML = "";
      styles.innerHTML = "";
      const pdfBuffer = await convertDocxToPdf(docxBuffer);
      if (cancelled) return;
      await renderPdfPreview(pdfBuffer, body);
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (!cancelled) renderPdfFieldOverlays(body, fieldsRef.current);
      });
    };

    const renderDocx = async () => {
      setLoadingLabel("Loading preview…");
      body.innerHTML = "";
      styles.innerHTML = "";
      const { renderAsync } = await import("docx-preview");
      const blob = new Blob([docxBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      await renderAsync(blob, body, styles, {
        className: "docx-review",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        experimental: true,
        useBase64URL: true,
      });
    };

    const shouldUsePdfFallback = async () => {
      try {
        if (await looksLikePdfConvertedDocx(docxBuffer)) return true;
        const imgs = Array.from(body.querySelectorAll<HTMLImageElement>("img"));
        const brokenRatio =
          imgs.length > 0
            ? imgs.filter((img) => !img.complete || img.naturalWidth === 0)
                .length / imgs.length
            : 0;
        if (brokenRatio > 0.3) return true;
        const { extractAllText } = await import("@/lib/template-preprocessor");
        const expectedText = (await extractAllText(docxBuffer)).trim();
        const renderedText = body.innerText.trim();
        return (
          expectedText.length > 200 &&
          renderedText.length < expectedText.length * 0.55
        );
      } catch {
        return false;
      }
    };

    (async () => {
      if (preferPdfPreview) {
        await renderPdfFallback();
        return;
      }
      await renderDocx();
      if (cancelled) return;
      if (await shouldUsePdfFallback()) {
        await renderPdfFallback();
        return;
      }
      requestAnimationFrame(() => refreshFieldMarkers(body, fieldsRef.current));
    })()
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load document preview."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [docxBuffer, preferPdfPreview]);

  useEffect(() => {
    if (!bodyRef.current || loading) return;
    requestAnimationFrame(() => {
      if (bodyRef.current) refreshFieldMarkers(bodyRef.current, fields);
    });
  }, [fields, loading]);

  const openSelectionMenu = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0)
      return;
    const range = selection.getRangeAt(0);
    const root = bodyRef.current;
    if (!root || !root.contains(range.commonAncestorContainer)) return;
    const text = selection.toString().trim();
    if (!text || text.length > 120) return;
    const rects = Array.from(range.getClientRects());
    const rect = rects[0] ?? range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    const position = positionForSelection(rect);
    setSelectionMenu({
      text,
      x: position.x,
      y: position.y,
      openedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!selectionMenu) return;
      if (menuRef.current?.contains(event.target as Node)) return;
      if (Date.now() - selectionMenu.openedAt < 3000) return;
      setSelectionMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectionMenu(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectionMenu]);

  const handleAdd = useCallback(
    (type: FieldType) => {
      if (!selectionMenu) return;
      onAddPlaceholder(selectionMenu.text, type);
      setSelectionMenu(null);
      window.getSelection()?.removeAllRanges();
    },
    [onAddPlaceholder, selectionMenu]
  );

  if (!docxBuffer) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
        No document available for preview.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="relative h-full overflow-auto"
      onMouseUp={openSelectionMenu}
      onTouchEnd={() => window.setTimeout(openSelectionMenu, 0)}
    >
      <style>{`
        .docx-preview-surface {
          --field-text: #2563eb;
          --field-date: #16a34a;
          --field-loop: #4f46e5;
          --field-condition: #db2777;
          min-height: 100%;
          background: var(--bg-muted);
          color: #111827;
          padding: 24px;
          user-select: text;
        }
        .docx-preview-surface > div { position: relative; }
        .docx-preview-surface .docx-wrapper { background: transparent; padding: 0; }
        .docx-preview-surface .docx-review {
          box-shadow: 0 18px 50px rgba(15,23,42,0.16);
          margin: 0 auto 28px auto;
        }
        .pdf-review-page {
          position: relative;
          background: #fff;
          box-shadow: 0 18px 50px rgba(15,23,42,0.16);
          margin: 0 auto 28px auto;
          overflow: hidden;
          isolation: isolate;
        }
        .pdf-review-page--error {
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pdf-review-page--error::after {
          content: 'Page could not be rendered';
          font-size: 11px;
          color: #9ca3af;
        }
        .pdf-review-canvas {
          display: block;
          background: #fff;
          position: relative;
          z-index: 1;
          pointer-events: none;
          user-select: none;
        }
        .pdf-review-text-layer {
          --min-font-size: 1;
          --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
          --min-font-size-inv: calc(1 / var(--min-font-size));
          position: absolute;
          inset: 0;
          overflow: clip;
          line-height: 1;
          text-align: initial;
          transform-origin: 0 0;
          z-index: 3;
          pointer-events: auto;
          user-select: text;
          text-size-adjust: none;
          forced-color-adjust: none;
          caret-color: transparent;
        }
        .pdf-review-text-layer span,
        .pdf-review-text-layer br {
          color: transparent;
          position: absolute;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
          user-select: text;
        }
        .pdf-review-text-layer > :not(.markedContent),
        .pdf-review-text-layer .markedContent span:not(.markedContent) {
          z-index: 1;
          --font-height: 0;
          font-size: calc(var(--text-scale-factor) * var(--font-height));
          --scale-x: 1;
          --rotate: 0deg;
          transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
        }
        .pdf-review-text-layer .markedContent { display: contents; }
        .pdf-review-text-layer span[role="img"] { user-select: none; cursor: default; }
        .pdf-review-text-layer ::selection { background: rgba(37,99,235,0.28); }
        .pdf-review-field-layer {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          overflow: hidden;
        }
        .docx-review-field-layer {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          overflow: hidden;
        }
        /* ── Shared colour tokens ─────────────────────────────────────────── */
        .pdf-field-band, .pdf-field-chip, .docx-field-chip {
          --marker-color: var(--field-text);
        }
        .pdf-field-band[data-field-type="date"],
        .pdf-field-chip[data-field-type="date"],
        .docx-field-chip[data-field-type="date"]   { --marker-color: var(--field-date); }
        .pdf-field-band[data-field-type="number"],
        .pdf-field-chip[data-field-type="number"],
        .docx-field-chip[data-field-type="number"],
        .pdf-field-band[data-field-type="email"],
        .pdf-field-chip[data-field-type="email"],
        .docx-field-chip[data-field-type="email"],
        .pdf-field-band[data-field-type="phone"],
        .pdf-field-chip[data-field-type="phone"],
        .docx-field-chip[data-field-type="phone"]  { --marker-color: var(--field-text); }
        .pdf-field-band[data-field-type="loop"],
        .pdf-field-chip[data-field-type="loop"],
        .docx-field-chip[data-field-type="loop"]   { --marker-color: var(--field-loop); }
        .pdf-field-band[data-field-type="condition"],
        .pdf-field-band[data-field-type="condition_inverse"],
        .pdf-field-chip[data-field-type="condition"],
        .pdf-field-chip[data-field-type="condition_inverse"],
        .docx-field-chip[data-field-type="condition"],
        .docx-field-chip[data-field-type="condition_inverse"] { --marker-color: var(--field-condition); }
        /* ── Bands ────────────────────────────────────────────────────────── */
        .pdf-field-band {
          position: absolute;
          border-radius: 3px;
          background: color-mix(in srgb, var(--marker-color) 13%, transparent);
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--marker-color) 18%, transparent),
            inset 0 -2px 0 color-mix(in srgb, var(--marker-color) 42%, transparent);
          mix-blend-mode: multiply;
          pointer-events: auto;
          cursor: default;
        }
        /* ── Chips ────────────────────────────────────────────────────────── */
        .pdf-field-chip,
        .docx-field-chip {
          position: absolute;
          height: 18px;
          line-height: 16px;
          padding: 0 6px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--marker-color) 40%, white);
          background: color-mix(in srgb, white 86%, var(--marker-color) 14%);
          color: var(--marker-color);
          font-size: 9px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0.82;
          box-shadow: 0 2px 6px rgba(15,23,42,0.10);
          transform: none;
          transition:
            opacity 0.14s ease,
            transform 0.14s ease,
            box-shadow 0.14s ease;
        }
        .pdf-field-chip.chip-active,
        .docx-field-chip.chip-active {
          opacity: 1;
          transform: translateY(-1px) scale(1.07);
          box-shadow: 0 5px 14px rgba(15,23,42,0.18);
        }
        .pdf-field-chip.chip-dimmed,
        .docx-field-chip.chip-dimmed {
          opacity: 0.28;
          transform: scale(0.95);
        }
        /* ── DOCX inline highlight marks ──────────────────────────────────── */
        .field-highlight {
          border-radius: 2px;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          padding: 0;
          font-weight: inherit;
          box-shadow: inset 0 -2px 0 currentColor;
        }
        .field-highlight[data-field-type="text"],
        .field-highlight[data-field-type="number"],
        .field-highlight[data-field-type="email"],
        .field-highlight[data-field-type="phone"] {
          background: color-mix(in srgb, var(--field-text) 16%, transparent);
          color: var(--field-text);
        }
        .field-highlight[data-field-type="date"] {
          background: color-mix(in srgb, var(--field-date) 16%, transparent);
          color: var(--field-date);
        }
        .field-highlight[data-field-type="loop"] {
          background: color-mix(in srgb, var(--field-loop) 16%, transparent);
          color: var(--field-loop);
        }
        .field-highlight[data-field-type="condition"],
        .field-highlight[data-field-type="condition_inverse"] {
          background: color-mix(in srgb, var(--field-condition) 16%, transparent);
          color: var(--field-condition);
        }
        @media (max-width: 640px) {
          .docx-preview-surface { padding: 12px; }
          .docx-preview-surface .docx-wrapper { overflow-x: auto; }
          .pdf-review-page { margin-bottom: 18px; }
          .pdf-field-chip, .docx-field-chip {
            opacity: 0.9 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div ref={styleRef} />
      <div className="docx-preview-surface">
        <div ref={bodyRef} />
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-muted)]/80">
          <Loader2Icon className="w-6 h-6 animate-spin text-[var(--accent-light)]" />
          <span className="ml-2 text-xs text-[var(--text-muted)]">
            {loadingLabel}
          </span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--danger)] bg-[var(--bg-muted)]">
          {error}
        </div>
      )}

      {selectionMenu && (
        <div
          ref={menuRef}
          className="fixed z-[9999] w-72 rounded-xl shadow-2xl overflow-hidden"
          style={{
            left: selectionMenu.x,
            top: selectionMenu.y,
            transform: "translateX(-50%)",
            background: "var(--popover)",
            color: "var(--text)",
            border: "1px solid var(--accent-border)",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div
            className="flex items-start gap-2 px-3 py-2.5"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <MousePointerClickIcon
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: "var(--accent-light)" }}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold">Add as placeholder</p>
              <p
                className="text-[10px] truncate mt-0.5"
                style={{ color: "var(--text-dim)" }}
              >
                &ldquo;{selectionMenu.text}&rdquo;
              </p>
            </div>
          </div>
          {(
            [
              ["text", "Text", "Name, number, etc."],
              ["date", "Date", "Date or time"],
              ["loop", "Table / Loop", "Repeating rows {{#…}}"],
              ["condition", "Condition (if)", "Show if true {{#…}}"],
              ["condition_inverse", "Condition (else)", "Show if false {{^…}}"],
            ] as const
          ).map(([type, label, hint]) => (
            <button
              key={type}
              type="button"
              className="w-full text-left px-3 py-2.5 transition-colors hover:bg-[var(--accent-soft)] group"
              onClick={() => handleAdd(type)}
            >
              <p className="text-xs font-medium">{label}</p>
              <p
                className="text-[10px] mt-0.5"
                style={{ color: "var(--text-dim)" }}
              >
                {hint}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
