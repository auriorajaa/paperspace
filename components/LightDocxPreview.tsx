// components/LightDocxPreview.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2Icon,
  MousePointerClickIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RotateCcwIcon,
  ChevronUpIcon,
} from "lucide-react";

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
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;
const ZOOM_SNAP_THRESHOLD = 0.04; // snap to 1.0 when close

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

function buildTokenToFieldsMap(
  fields: ReviewField[],
  tokenFilter?: (token: string) => boolean
): Map<string, ReviewField[]> {
  const siblingsByTargetText = new Map<string, ReviewField[]>();
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

  for (const [, tokenFields] of tokenToFields) {
    if (tokenFields.length !== 1) continue;
    const field = tokenFields[0];

    const ttext = field.targetText?.trim();
    const sibsByTT =
      ttext && ttext.length >= 2 ? siblingsByTargetText.get(ttext) : undefined;

    const baseName = field.name.replace(/_\d+$/, "");
    const sibsByBN =
      baseName !== field.name ? siblingsByBaseName.get(baseName) : undefined;

    const siblings =
      (sibsByTT?.length ?? 0) >= (sibsByBN?.length ?? 0) ? sibsByTT : sibsByBN;

    if (!siblings || siblings.length <= 1) continue;

    siblings.forEach((sib) => {
      if (!tokenFields.some((f) => f.id === sib.id)) tokenFields.push(sib);
    });
  }

  return tokenToFields;
}

function reorderSameValueHighlights(
  container: HTMLElement,
  fields: ReviewField[]
): void {
  const targetTextToFields = new Map<string, ReviewField[]>();
  fields.forEach((field) => {
    const key = field.targetText?.trim();
    if (!key || key.length < 2) return;
    const group = targetTextToFields.get(key) ?? [];
    group.push(field);
    targetTextToFields.set(key, group);
  });

  const baseNameToFields = new Map<string, ReviewField[]>();
  fields.forEach((field) => {
    const baseName = field.name.replace(/_\d+$/, "");
    if (baseName === field.name) return;
    const group = baseNameToFields.get(baseName) ?? [];
    group.push(field);
    baseNameToFields.set(baseName, group);
  });

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
    const groupNames = new Set(group.map((f) => f.name));

    const relevantHighlights = allHighlights.filter((el) => {
      const fid = el.dataset.fieldId ?? "";
      const fname = el.dataset.fieldName ?? "";
      return groupIds.has(fid) || groupNames.has(fname);
    });

    if (relevantHighlights.length <= 1) continue;

    const sorted = [...relevantHighlights].sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const dt = ar.top - br.top;
      if (Math.abs(dt) > 2) return dt;
      return ar.left - br.left;
    });

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

    const candidates = Array.from(container.querySelectorAll("*")).filter(
      (el) => {
        if (el.classList.contains("field-highlight")) return false;
        if (el.classList.contains("docx-review-field-layer")) return false;
        const tc = el.textContent || "";
        return tc.includes(needle);
      }
    );

    if (!candidates.length) continue;

    candidates.sort(
      (a, b) => (a.textContent?.length || 0) - (b.textContent?.length || 0)
    );
    const best = candidates[0] as HTMLElement;

    if (best.children.length === 0) {
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
      const childNodes = Array.from(best.childNodes);
      let found = false;
      for (const node of childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const txt = node.textContent || "";
        if (!txt.trim()) continue;
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

// ── Zoom-aware overlay helpers ─────────────────────────────────────────────────
// rect values come from getBoundingClientRect() which returns post-zoom viewport
// coordinates. The overlay elements are positioned inside zoomed containers, so
// CSS position values must be divided by the zoom factor.
// Chip dimensions (font-size, height, width) are also scaled so chips maintain
// a consistent visual appearance regardless of zoom level.

function addPdfFieldBand(
  overlay: HTMLElement,
  field: ReviewField,
  rect: RelativeRect,
  zoom = 1
) {
  const band = document.createElement("div");
  band.className = "pdf-field-band";
  band.dataset.fieldId = field.id;
  band.dataset.fieldName = field.name;
  band.dataset.fieldType = field.type;
  band.style.left = `${rect.left / zoom}px`;
  band.style.top = `${rect.top / zoom}px`;
  band.style.width = `${rect.width / zoom}px`;
  band.style.height = `${Math.max(rect.height, 6) / zoom}px`;
  overlay.appendChild(band);
}

function addFieldChip(
  overlay: HTMLElement,
  field: ReviewField,
  rect: RelativeRect,
  bounds: { width: number; height: number },
  className: string,
  zoom = 1
) {
  const label = fieldMarkerLabel(field);

  // All sizes and positions in CSS units (divide viewport px by zoom)
  const chipWidth = clamp(label.length * 5.8 + 22, 54, 140) / zoom;
  const chipHeight = 18 / zoom;
  const fontSize = 9 / zoom;
  const gap = 4 / zoom;
  const padH = 6 / zoom;
  const borderRadius = 999;

  // rect is in viewport-relative coords; convert to CSS coords
  const rTop = rect.top / zoom;
  const rBottom = rect.bottom / zoom;
  const rLeft = rect.left / zoom;
  const rWidth = rect.width / zoom;

  let top = rTop - chipHeight - gap;
  if (top < gap) top = rBottom + gap;
  top = clamp(top, gap, bounds.height - chipHeight - gap);

  let left = rLeft + rWidth / 2 - chipWidth / 2;
  left = clamp(left, gap, bounds.width - chipWidth - gap);

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
  chip.style.height = `${chipHeight}px`;
  chip.style.lineHeight = `${chipHeight - 2 / zoom}px`;
  chip.style.fontSize = `${fontSize}px`;
  chip.style.padding = `0 ${padH}px`;
  chip.style.borderRadius = `${borderRadius}px`;
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

function deconflictChips(overlay: HTMLElement, chipSelector: string, zoom = 1) {
  const chips = Array.from(overlay.querySelectorAll<HTMLElement>(chipSelector));
  if (chips.length < 2) return;

  chips.sort((a, b) => {
    const dt = parseFloat(a.style.top || "0") - parseFloat(b.style.top || "0");
    if (Math.abs(dt) > 2) return dt;
    return parseFloat(a.style.left || "0") - parseFloat(b.style.left || "0");
  });

  // All positions/sizes in CSS units (already divided by zoom in addFieldChip)
  const chipH = 18 / zoom;
  const vGap = 3 / zoom;
  const hGap = 4 / zoom;

  for (let i = 1; i < chips.length; i++) {
    const prev = chips[i - 1];
    const curr = chips[i];
    const pt = parseFloat(prev.style.top || "0");
    const pl = parseFloat(prev.style.left || "0");
    const pw = parseFloat(prev.style.width || `${60 / zoom}`);
    const ct = parseFloat(curr.style.top || "0");
    const cl = parseFloat(curr.style.left || "0");
    const cw = parseFloat(curr.style.width || `${60 / zoom}`);

    const vertOverlap = ct < pt + chipH + vGap;
    const horizOverlap = cl < pl + pw + hGap && cl + cw > pl - hGap;

    if (vertOverlap && horizOverlap) {
      curr.style.top = prev.style.top;
      curr.style.left = `${pl + pw + hGap}px`;
    }
  }
}

interface PdfPageMatchEntry {
  token: string;
  tokenFields: ReviewField[];
  rects: RelativeRect[];
}

function renderPdfFieldOverlays(
  container: HTMLElement,
  fields: ReviewField[],
  zoom = 1
) {
  clearPdfFieldOverlays(container);
  if (!fields.length) return;

  const pages = Array.from(
    container.querySelectorAll<HTMLElement>(".pdf-review-page")
  );

  const occurrenceCounters = new Map<string, number>();

  const tokenToFields = buildTokenToFieldsMap(
    fields,
    (token) => token.includes("{{") || token.length >= 3
  );

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
    if (!pageText.trim()) return;

    const overlay = document.createElement("div");
    overlay.className = "pdf-review-field-layer";
    pageEl.appendChild(overlay);

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

        if (rects.length > 0) {
          pageMatchEntries.push({ token, tokenFields, rects });
        }

        index = pageText.indexOf(token, matchEnd);
      }
    }

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
        addPdfFieldBand(overlay, field, rect, zoom);
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
          "pdf-field-chip",
          zoom
        );
      }
    }

    if (!overlay.childElementCount) {
      overlay.remove();
      return;
    }

    deconflictChips(overlay, ".pdf-field-chip", zoom);

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
  fields: ReviewField[],
  zoom = 1
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
      "docx-field-chip",
      zoom
    );
  });

  if (!overlay.childElementCount) {
    overlay.remove();
    return;
  }

  deconflictChips(overlay, ".docx-field-chip", zoom);

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

function refreshFieldMarkers(
  container: HTMLElement,
  fields: ReviewField[],
  zoom = 1
) {
  clearDocxFieldOverlays(container);
  if (container.querySelector(".pdf-review-page")) {
    renderPdfFieldOverlays(container, fields, zoom);
    return;
  }
  clearPdfFieldOverlays(container);
  applyHighlights(container, fields);
  renderDocxFieldOverlays(container, fields, zoom);
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

// ── Field type label helpers for bottom sheet ──────────────────────────────────
const FIELD_TYPE_METADATA = [
  ["text", "Text", "Name, number, etc.", "bg-blue-50 text-blue-700"],
  ["date", "Date", "Date or time", "bg-green-50 text-green-700"],
  [
    "loop",
    "Table / Loop",
    "Repeating rows {{#…}}",
    "bg-indigo-50 text-indigo-700",
  ],
  [
    "condition",
    "Condition (if)",
    "Show if true {{#…}}",
    "bg-pink-50 text-pink-700",
  ],
  [
    "condition_inverse",
    "Condition (else)",
    "Show if false {{^…}}",
    "bg-pink-50 text-pink-700",
  ],
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [zoom, setZoom] = useState(1.0);
  const [isMobile, setIsMobile] = useState(false);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);

  const zoomRef = useRef(1.0);

  // Pinch-to-zoom refs (used in non-passive event listeners)
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1.0);
  const isPinchingRef = useRef(false);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Animate bottom sheet when selection menu opens on mobile
  useEffect(() => {
    if (selectionMenu && isMobile) {
      requestAnimationFrame(() => setBottomSheetVisible(true));
    } else {
      setBottomSheetVisible(false);
    }
  }, [selectionMenu, isMobile]);

  // Pinch-to-zoom via non-passive touch listeners (must use addEventListener)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDistRef.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartZoomRef.current = zoomRef.current;
        isPinchingRef.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinchStartDistRef.current === null) return;
      e.preventDefault(); // Prevent viewport zoom during pinch
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      let newZoom = pinchStartZoomRef.current * ratio;
      // Snap to 1.0 when very close
      if (Math.abs(newZoom - 1.0) < ZOOM_SNAP_THRESHOLD) newZoom = 1.0;
      newZoom = parseFloat(clamp(newZoom, MIN_ZOOM, MAX_ZOOM).toFixed(2));
      zoomRef.current = newZoom;
      setZoom(newZoom);
    };

    const onTouchEnd = () => {
      // Small delay so we can check isPinchingRef in the touch selection handler
      setTimeout(() => {
        isPinchingRef.current = false;
      }, 80);
      pinchStartDistRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []); // run once; refs keep values current

  // Re-render field markers when zoom changes
  useEffect(() => {
    zoomRef.current = zoom;
    if (!bodyRef.current || loading) return;
    requestAnimationFrame(() => {
      if (bodyRef.current)
        refreshFieldMarkers(bodyRef.current, fieldsRef.current, zoom);
    });
  }, [zoom, loading]);

  // Render document when buffer changes
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
        if (!cancelled)
          renderPdfFieldOverlays(body, fieldsRef.current, zoomRef.current);
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
      requestAnimationFrame(() =>
        refreshFieldMarkers(body, fieldsRef.current, zoomRef.current)
      );
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

  // Re-render markers when fields change
  useEffect(() => {
    if (!bodyRef.current || loading) return;
    requestAnimationFrame(() => {
      if (bodyRef.current)
        refreshFieldMarkers(bodyRef.current, fields, zoomRef.current);
    });
  }, [fields, loading]);

  // Open selection menu after text selection
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

  // Handle touch end for text selection (only if not pinching)
  const handleTouchEndSelection = useCallback(() => {
    window.setTimeout(() => {
      if (!isPinchingRef.current) openSelectionMenu();
    }, 180);
  }, [openSelectionMenu]);

  // Dismiss selection menu on outside interaction
  useEffect(() => {
    if (!selectionMenu) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (Date.now() - selectionMenu.openedAt < 200) return;
      setSelectionMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectionMenu(null);
    };
    document.addEventListener("mousedown", onDown as EventListener);
    document.addEventListener("touchstart", onDown as EventListener);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown as EventListener);
      document.removeEventListener("touchstart", onDown as EventListener);
      document.removeEventListener("keydown", onKey);
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

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((z) => {
      let nz = parseFloat((z + ZOOM_STEP).toFixed(2));
      if (Math.abs(nz - 1.0) < ZOOM_SNAP_THRESHOLD) nz = 1.0;
      nz = clamp(nz, MIN_ZOOM, MAX_ZOOM);
      zoomRef.current = nz;
      return nz;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => {
      let nz = parseFloat((z - ZOOM_STEP).toFixed(2));
      if (Math.abs(nz - 1.0) < ZOOM_SNAP_THRESHOLD) nz = 1.0;
      nz = clamp(nz, MIN_ZOOM, MAX_ZOOM);
      zoomRef.current = nz;
      return nz;
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    zoomRef.current = 1.0;
    setZoom(1.0);
  }, []);

  if (!docxBuffer) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
        No document available for preview.
      </div>
    );
  }

  const zoomPercent = Math.round(zoom * 100);
  const canZoomIn = zoom < MAX_ZOOM - 0.01;
  const canZoomOut = zoom > MIN_ZOOM + 0.01;

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* ── Scrollable document area ── */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto"
        onMouseUp={openSelectionMenu}
        onTouchEnd={handleTouchEndSelection}
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
            transform-origin: top left;
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
          .pdf-field-chip,
          .docx-field-chip {
            position: absolute;
            font-weight: 700;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0.82;
            border: 1px solid color-mix(in srgb, var(--marker-color) 40%, white);
            background: color-mix(in srgb, white 86%, var(--marker-color) 14%);
            color: var(--marker-color);
            box-shadow: 0 2px 6px rgba(15,23,42,0.10);
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
        `}</style>

        <div ref={styleRef} />

        <div
          className="docx-preview-surface"
          style={zoom !== 1 ? { zoom } : undefined}
        >
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
      </div>

      {/* ── Zoom toolbar — always visible at bottom ── */}
      <div
        className="shrink-0 flex items-center justify-between px-3 py-2 gap-2"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-sidebar)",
        }}
      >
        {/* Left: hint text */}
        <p
          className="text-[10px] truncate flex-1 min-w-0"
          style={{ color: "var(--text-dim)" }}
        >
          {isMobile
            ? "Long-press to select text · Pinch to zoom"
            : "Select text in the document to add a field"}
        </p>

        {/* Right: zoom controls */}
        <div
          className="flex items-center gap-0.5 rounded-lg overflow-hidden shrink-0"
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-input)",
          }}
        >
          <button
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            aria-label="Zoom out"
            className="flex items-center justify-center transition-colors"
            style={{
              width: isMobile ? 36 : 28,
              height: isMobile ? 36 : 28,
              color: canZoomOut ? "var(--text-muted)" : "var(--text-dim)",
              opacity: canZoomOut ? 1 : 0.4,
              cursor: canZoomOut ? "pointer" : "default",
            }}
            onMouseEnter={(e) => {
              if (canZoomOut)
                (e.currentTarget as HTMLElement).style.background =
                  "var(--accent-soft)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <ZoomOutIcon className={isMobile ? "w-4 h-4" : "w-3.5 h-3.5"} />
          </button>

          <button
            onClick={handleZoomReset}
            aria-label="Reset zoom"
            title="Reset to 100%"
            className="flex items-center justify-center transition-colors tabular-nums"
            style={{
              minWidth: isMobile ? 52 : 42,
              height: isMobile ? 36 : 28,
              fontSize: isMobile ? 12 : 10,
              fontWeight: 600,
              color: zoom !== 1 ? "var(--accent-light)" : "var(--text-muted)",
              borderLeft: "1px solid var(--border-subtle)",
              borderRight: "1px solid var(--border-subtle)",
              background: zoom !== 1 ? "var(--accent-soft)" : "transparent",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => {
              if (zoom !== 1)
                (e.currentTarget as HTMLElement).style.background =
                  "color-mix(in srgb, var(--accent-light) 18%, transparent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                zoom !== 1 ? "var(--accent-soft)" : "transparent";
            }}
          >
            {zoomPercent}%
          </button>

          <button
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            aria-label="Zoom in"
            className="flex items-center justify-center transition-colors"
            style={{
              width: isMobile ? 36 : 28,
              height: isMobile ? 36 : 28,
              color: canZoomIn ? "var(--text-muted)" : "var(--text-dim)",
              opacity: canZoomIn ? 1 : 0.4,
              cursor: canZoomIn ? "pointer" : "default",
            }}
            onMouseEnter={(e) => {
              if (canZoomIn)
                (e.currentTarget as HTMLElement).style.background =
                  "var(--accent-soft)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <ZoomInIcon className={isMobile ? "w-4 h-4" : "w-3.5 h-3.5"} />
          </button>
        </div>
      </div>

      {/* ── Desktop floating selection menu ── */}
      {selectionMenu && !isMobile && (
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

      {/* ── Mobile bottom sheet selection menu ── */}
      {selectionMenu && isMobile && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            style={{
              background: "rgba(0,0,0,0.4)",
              opacity: bottomSheetVisible ? 1 : 0,
              transition: "opacity 0.22s ease",
            }}
            onPointerDown={() => setSelectionMenu(null)}
          />

          {/* Sheet */}
          <div
            ref={menuRef}
            className="fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl overflow-hidden"
            style={{
              background: "var(--popover)",
              border: "1px solid var(--accent-border)",
              borderBottom: "none",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
              transform: bottomSheetVisible
                ? "translateY(0)"
                : "translateY(100%)",
              transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
              paddingBottom: "env(safe-area-inset-bottom, 8px)",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "var(--border-hover)" }}
              />
            </div>

            {/* Selected text */}
            <div
              className="flex items-center gap-2.5 px-4 py-3"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--accent-soft)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <MousePointerClickIcon
                  className="w-4 h-4"
                  style={{ color: "var(--accent-light)" }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Add as placeholder
                </p>
                <p
                  className="text-[11px] truncate mt-0.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  &ldquo;{selectionMenu.text}&rdquo;
                </p>
              </div>
            </div>

            {/* Type options — two columns on mobile for easier thumb reach */}
            <div className="grid grid-cols-2 gap-2 p-3">
              {(
                [
                  ["text", "Text", "Name, address, etc.", "#2563eb", "#eff6ff"],
                  ["date", "Date", "Date or time value", "#16a34a", "#f0fdf4"],
                  [
                    "loop",
                    "Table / Loop",
                    "Repeating rows",
                    "#4f46e5",
                    "#eef2ff",
                  ],
                  [
                    "condition",
                    "Condition (if)",
                    "Show when truthy",
                    "#db2777",
                    "#fdf2f8",
                  ],
                  [
                    "condition_inverse",
                    "Condition (else)",
                    "Show when empty",
                    "#db2777",
                    "#fdf2f8",
                  ],
                ] as const
              ).map(([type, label, hint, color, bg]) => (
                <button
                  key={type}
                  type="button"
                  className="flex flex-col items-start gap-1 rounded-xl px-3 py-3 text-left transition-all active:scale-95"
                  style={{
                    background: bg,
                    border: `1.5px solid color-mix(in srgb, ${color} 25%, transparent)`,
                    minHeight: 72,
                  }}
                  onClick={() => handleAdd(type)}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <p
                    className="text-[13px] font-semibold leading-tight"
                    style={{ color }}
                  >
                    {label}
                  </p>
                  <p
                    className="text-[10px] leading-relaxed"
                    style={{
                      color: `color-mix(in srgb, ${color} 70%, #374151)`,
                    }}
                  >
                    {hint}
                  </p>
                </button>
              ))}

              {/* Cancel button in the last cell */}
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-3 transition-all active:scale-95"
                style={{
                  background: "var(--bg-muted)",
                  border: "1.5px solid var(--border-subtle)",
                  minHeight: 72,
                }}
                onClick={() => setSelectionMenu(null)}
              >
                <ChevronUpIcon
                  className="w-4 h-4"
                  style={{ color: "var(--text-dim)" }}
                />
                <p
                  className="text-[12px] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Cancel
                </p>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
