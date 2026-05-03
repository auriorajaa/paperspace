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

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldMarkerLabel(field: ReviewField) {
  const label = field.label?.trim() || field.name.replace(/_/g, " ");
  return label.length > 24 ? `${label.slice(0, 23)}...` : label;
}

function getFieldTokens(field: ReviewField) {
  const tokens = new Set<string>();

  if (field.type === "loop") {
    tokens.add(`{{#${field.name}}}`);
    tokens.add(`{{/${field.name}}}`);
    field.subFields?.forEach((subField) => tokens.add(`{{${subField.name}}}`));
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
  if (field.targetText && field.targetText.trim().length > 1) {
    tokens.add(field.targetText.trim());
  }

  return [...tokens].filter((token) => token.trim().length > 1);
}

function isPdfTextLayerNode(node: Node): boolean {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return Boolean(element?.closest(".pdf-review-text-layer"));
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

function applyHighlights(container: HTMLElement, fields: ReviewField[]) {
  unwrapHighlights(container);
  if (!fields.length) return;

  fields.forEach((field) => {
    getFieldTokens(field).forEach((token) => {
      const pattern = new RegExp(escapeRegex(token), "g");
      walkAndReplace(container, pattern, field);
    });
  });
}

function walkAndReplace(node: Node, pattern: RegExp, field: ReviewField) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (isPdfTextLayerNode(node)) return;

    const text = node.textContent ?? "";
    if (!pattern.test(text)) return;
    pattern.lastIndex = 0;

    const parent = node.parentNode;
    if (!parent) return;

    const parts: Node[] = [];
    let idx = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > idx) {
        parts.push(document.createTextNode(text.slice(idx, match.index)));
      }

      const mark = document.createElement("span");
      mark.className = "field-highlight";
      mark.dataset.fieldId = field.id;
      mark.dataset.fieldName = field.name;
      mark.dataset.fieldType = field.type;
      mark.dataset.fieldLabel = fieldMarkerLabel(field);
      mark.title = field.label;
      mark.textContent = match[0];
      parts.push(mark);
      idx = pattern.lastIndex;
    }

    if (idx < text.length) {
      parts.push(document.createTextNode(text.slice(idx)));
    }

    for (const part of parts) parent.insertBefore(part, node);
    parent.removeChild(node);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;
  if (
    ["SCRIPT", "STYLE", "TEXTAREA"].includes(element.tagName) ||
    element.classList.contains("field-highlight") ||
    element.classList.contains("docx-review-field-layer") ||
    element.classList.contains("pdf-review-field-layer") ||
    element.classList.contains("pdf-review-text-layer")
  ) {
    return;
  }

  for (const child of Array.from(node.childNodes)) {
    walkAndReplace(child, pattern, field);
  }
}

function clearPdfFieldOverlays(container: HTMLElement) {
  container
    .querySelectorAll(".pdf-review-field-layer")
    .forEach((overlay) => overlay.remove());
}

function clearDocxFieldOverlays(container: HTMLElement) {
  container
    .querySelectorAll(".docx-review-field-layer")
    .forEach((overlay) => overlay.remove());
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
  const chipWidth = clamp(label.length * 5.8 + 22, 54, 132);
  const chipHeight = 18;
  const gutter = 7;

  let left = rect.left - chipWidth - gutter;
  let top = rect.top + rect.height / 2 - chipHeight / 2;

  if (left < 4) {
    const rightSide = rect.right + gutter;
    if (rightSide + chipWidth <= bounds.width - 4) {
      left = rightSide;
    } else {
      left = clamp(rect.left, 4, bounds.width - chipWidth - 4);
      top = rect.top - chipHeight - 4;
      if (top < 4) top = rect.bottom + 4;
    }
  }

  top = clamp(top, 4, bounds.height - chipHeight - 4);

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

function renderPdfFieldOverlays(container: HTMLElement, fields: ReviewField[]) {
  clearPdfFieldOverlays(container);
  if (!fields.length) return;

  const pages = Array.from(
    container.querySelectorAll<HTMLElement>(".pdf-review-page")
  );

  pages.forEach((pageEl, pageIndex) => {
    const textLayer = pageEl.querySelector<HTMLElement>(
      ".pdf-review-text-layer"
    );
    if (!textLayer) return;

    const pageRect = pageEl.getBoundingClientRect();
    const spans = Array.from(
      textLayer.querySelectorAll<HTMLElement>("span")
    ).filter((span) => {
      const text = span.textContent ?? "";
      return text.length > 0 && span.getClientRects().length > 0;
    });
    if (!spans.length) return;

    const ranges: TextSpanRange[] = [];
    let cursor = 0;
    spans.forEach((span) => {
      const text = span.textContent ?? "";
      ranges.push({
        span,
        text,
        start: cursor,
        end: cursor + text.length,
      });
      cursor += text.length;
    });

    const pageText = ranges.map((range) => range.text).join("");
    if (!pageText.trim()) return;

    const overlay = document.createElement("div");
    overlay.className = "pdf-review-field-layer";
    pageEl.appendChild(overlay);

    const renderedBands = new Set<string>();
    const renderedChips = new Set<string>();

    fields.forEach((field) => {
      getFieldTokens(field).forEach((token) => {
        const trimmedToken = token.trim();
        if (!trimmedToken.includes("{{") && trimmedToken.length < 3) return;

        let index = pageText.indexOf(token);
        while (index !== -1) {
          const matchEnd = index + token.length;
          const hitRanges = ranges.filter(
            (range) => range.end > index && range.start < matchEnd
          );

          const rects = hitRanges
            .flatMap((range) => Array.from(range.span.getClientRects()))
            .map((rect) => relativeRect(rect, pageRect))
            .filter((rect) => rect.width > 0 && rect.height > 0);

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
          if (firstRect && !renderedChips.has(chipKey)) {
            renderedChips.add(chipKey);
            addFieldChip(
              overlay,
              field,
              firstRect,
              {
                width: pageEl.clientWidth,
                height: pageEl.clientHeight,
              },
              "pdf-field-chip"
            );
          }

          index = pageText.indexOf(token, index + token.length);
        }
      });
    });

    if (!overlay.childElementCount) overlay.remove();
  });
}

function renderDocxFieldOverlays(container: HTMLElement, fields: ReviewField[]) {
  clearDocxFieldOverlays(container);
  if (!fields.length) return;

  const highlights = Array.from(
    container.querySelectorAll<HTMLElement>(".field-highlight")
  );
  if (!highlights.length) return;

  const fieldById = new Map(fields.map((field) => [field.id, field]));
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

  if (!overlay.childElementCount) overlay.remove();
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
  if (y + menuHeight > window.innerHeight - margin) {
    y = window.innerHeight - margin - menuHeight;
  }
  x = clamp(x, margin + menuWidth / 2, window.innerWidth - margin - menuWidth / 2);

  return { x, y: Math.max(margin, y) };
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

async function renderPdfPreview(
  pdfBuffer: ArrayBuffer,
  container: HTMLElement
) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
  });
  const pdf = (await loadingTask.promise) as unknown as PdfDocument;
  const TextLayer =
    pdfjsLib.TextLayer as unknown as PdfTextLayerConstructor;

  container.innerHTML = "";

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(container.clientWidth - 48, 320);
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

      const textLayer = document.createElement("div");
      textLayer.className = "pdf-review-text-layer textLayer";
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      textLayer.style.setProperty("--total-scale-factor", String(scale));

      pageEl.appendChild(canvas);
      pageEl.appendChild(textLayer);
      container.appendChild(pageEl);

      await page.render({ canvasContext: ctx, viewport }).promise;
      const textContent = await page.getTextContent();
      await new TextLayer({
        textContentSource: textContent,
        container: textLayer,
        viewport,
      }).render();
    }
  } finally {
    await pdf.destroy();
  }
}

async function looksLikePdfConvertedDocx(buffer: ArrayBuffer): Promise<boolean> {
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
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenu | null>(null);
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
      setLoadingLabel("Preparing exact preview...");
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
      setLoadingLabel("Loading preview...");
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

        const { extractAllText } = await import("@/lib/template-preprocessor");
        const expectedText = (await extractAllText(docxBuffer)).trim();
        const renderedText = body.innerText.trim();
        return (
          expectedText.length > 200 &&
          renderedText.length < expectedText.length * 0.45
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
      .then(() => {
        if (cancelled) return;
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("DOCX preview failed", err);
        setError(
          err instanceof Error ? err.message : "Failed to load document preview."
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
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

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
          --field-number: #ea580c;
          --field-email: #9333ea;
          --field-phone: #0891b2;
          --field-loop: #4f46e5;
          --field-condition: #db2777;
          min-height: 100%;
          background: var(--bg-muted);
          color: #111827;
          padding: 24px;
          user-select: text;
        }
        .docx-preview-surface > div {
          position: relative;
        }
        .docx-preview-surface .docx-wrapper {
          background: transparent;
          padding: 0;
        }
        .docx-preview-surface .docx-review {
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16);
          margin: 0 auto 28px auto;
        }
        .pdf-review-page {
          position: relative;
          background: #fff;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16);
          margin: 0 auto 28px auto;
          overflow: hidden;
          isolation: isolate;
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
          opacity: 1;
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
        .pdf-review-text-layer .markedContent {
          display: contents;
        }
        .pdf-review-text-layer span[role="img"] {
          user-select: none;
          cursor: default;
        }
        .pdf-review-text-layer ::selection {
          background: rgba(37, 99, 235, 0.28);
        }
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
        .pdf-field-band,
        .pdf-field-chip,
        .docx-field-chip {
          --marker-color: var(--field-text);
        }
        .pdf-field-band[data-field-type="date"],
        .pdf-field-chip[data-field-type="date"],
        .docx-field-chip[data-field-type="date"] {
          --marker-color: var(--field-date);
        }
        .pdf-field-band[data-field-type="number"],
        .pdf-field-chip[data-field-type="number"],
        .docx-field-chip[data-field-type="number"] {
          --marker-color: var(--field-number);
        }
        .pdf-field-band[data-field-type="email"],
        .pdf-field-chip[data-field-type="email"],
        .docx-field-chip[data-field-type="email"] {
          --marker-color: var(--field-email);
        }
        .pdf-field-band[data-field-type="phone"],
        .pdf-field-chip[data-field-type="phone"],
        .docx-field-chip[data-field-type="phone"] {
          --marker-color: var(--field-phone);
        }
        .pdf-field-band[data-field-type="loop"],
        .pdf-field-chip[data-field-type="loop"],
        .docx-field-chip[data-field-type="loop"] {
          --marker-color: var(--field-loop);
        }
        .pdf-field-band[data-field-type="condition"],
        .pdf-field-band[data-field-type="condition_inverse"],
        .pdf-field-chip[data-field-type="condition"],
        .pdf-field-chip[data-field-type="condition_inverse"],
        .docx-field-chip[data-field-type="condition"],
        .docx-field-chip[data-field-type="condition_inverse"] {
          --marker-color: var(--field-condition);
        }
        .pdf-field-band {
          position: absolute;
          border-radius: 3px;
          background: color-mix(in srgb, var(--marker-color) 13%, transparent);
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--marker-color) 18%, transparent),
            inset 0 -2px 0 color-mix(in srgb, var(--marker-color) 42%, transparent);
          mix-blend-mode: multiply;
        }
        .pdf-field-chip,
        .docx-field-chip {
          position: absolute;
          height: 18px;
          line-height: 16px;
          padding: 0 6px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--marker-color) 42%, white);
          background: color-mix(in srgb, white 88%, var(--marker-color) 12%);
          color: var(--marker-color);
          box-shadow: 0 5px 12px rgba(15, 23, 42, 0.12);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .field-highlight {
          border-radius: 2px;
          border: 0;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          padding: 0;
          font-weight: inherit;
          box-shadow: inset 0 -2px 0 currentColor;
        }
        .field-highlight[data-field-type="text"] {
          background: color-mix(in srgb, var(--field-text) 16%, transparent);
          color: var(--field-text);
        }
        .field-highlight[data-field-type="date"] {
          background: color-mix(in srgb, var(--field-date) 16%, transparent);
          color: var(--field-date);
        }
        .field-highlight[data-field-type="number"] {
          background: color-mix(in srgb, var(--field-number) 16%, transparent);
          color: var(--field-number);
        }
        .field-highlight[data-field-type="email"] {
          background: color-mix(in srgb, var(--field-email) 16%, transparent);
          color: var(--field-email);
        }
        .field-highlight[data-field-type="phone"] {
          background: color-mix(in srgb, var(--field-phone) 16%, transparent);
          color: var(--field-phone);
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
          .docx-preview-surface {
            padding: 12px;
          }
          .docx-preview-surface .docx-wrapper {
            overflow-x: auto;
          }
          .pdf-review-page {
            margin-bottom: 18px;
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
          onMouseDown={(event) => event.preventDefault()}
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
                {selectionMenu.text}
              </p>
            </div>
          </div>
          {[
            ["text", "Add as Text Placeholder"],
            ["loop", "Add as Loop Start"],
            ["condition", "Add as Condition (Truthy)"],
            ["condition_inverse", "Add as Condition (Falsy)"],
          ].map(([type, label]) => (
            <button
              key={type}
              type="button"
              className="w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--accent-soft)]"
              onClick={() => handleAdd(type as FieldType)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
