"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  UploadCloudIcon,
  FileTextIcon,
  ChevronLeftIcon,
  XIcon,
  TagIcon,
  CheckIcon,
  ChevronRightIcon,
  LayoutGridIcon,
  FileIcon,
  AlertCircleIcon,
  Loader2Icon,
} from "lucide-react";
import Link from "next/link";
import { colors } from "@/lib/design-tokens";

// ─── Types ────────────────────────────────────────────────────────────────────
type FileKind = "docx" | "pdf";
type Stage =
  | ""
  | "previewing"
  | "splitting"
  | "converting"
  | "uploading"
  | "scanning";

const STAGE_LABEL: Record<Stage, string> = {
  "": "",
  previewing: "Preparing preview…",
  splitting: "Processing selected pages…",
  converting: "Converting to editable format…",
  uploading: "Uploading & scanning for placeholders…",
  scanning: "Detecting placeholders…",
};

const MAX_PDF_PAGES = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fileSizeMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

// ─── Thumbnail Card ──────────────────────────────────────────────────────────
function ThumbnailCard({
  index,
  dataUrl,
  selected,
  onToggle,
}: {
  index: number;
  dataUrl: string | null;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative rounded-xl overflow-hidden transition-all duration-150 text-left w-full focus:outline-none active:scale-[0.98]"
      style={{
        border: `2px solid ${selected ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.08)"}`,
        background: selected
          ? "rgba(99,102,241,0.07)"
          : "rgba(255,255,255,0.02)",
        boxShadow: selected
          ? "0 0 0 2px rgba(99,102,241,0.2), 0 4px 16px rgba(99,102,241,0.12)"
          : "none",
        transform: selected ? "scale(1.02)" : "scale(1)",
      }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`Page ${index + 1}`}
          className="w-full h-auto block"
          draggable={false}
        />
      ) : (
        <div
          className="w-full aspect-[3/4] animate-pulse"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <Loader2Icon
              className="w-4 h-4 animate-spin"
              style={{ color: "rgba(255,255,255,0.15)" }}
            />
          </div>
        </div>
      )}
      <div
        className="absolute bottom-0 inset-x-0 px-2 py-1 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      >
        <span
          className="text-[10px] font-semibold tabular-nums"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          {index + 1}
        </span>
      </div>
      <div
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150"
        style={{
          background: selected ? "#6366f1" : "rgba(0,0,0,0.45)",
          border: `1.5px solid ${selected ? "#818cf8" : "rgba(255,255,255,0.2)"}`,
          opacity: selected ? 1 : 0.6,
        }}
      >
        {selected && <CheckIcon className="w-3 h-3 text-white" />}
      </div>
    </button>
  );
}

// ─── Page Selector ───────────────────────────────────────────────────────────
function PageSelector({
  totalPages,
  thumbnails,
  selectedPages,
  loading,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  totalPages: number;
  thumbnails: (string | null)[];
  selectedPages: Set<number>;
  loading: boolean;
  onToggle: (page: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const loadedCount = thumbnails.filter(Boolean).length;
  const displayLimit = Math.min(totalPages, MAX_PDF_PAGES);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid rgba(99,102,241,0.18)`,
        background: "rgba(99,102,241,0.03)",
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(99,102,241,0.12)" }}
      >
        <div className="flex items-center gap-2">
          <LayoutGridIcon
            className="w-3.5 h-3.5"
            style={{ color: "#818cf8" }}
          />
          <span
            className="text-[12px] font-semibold"
            style={{ color: colors.textSecondary }}
          >
            Select pages to include
          </span>
          {loading && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}
            >
              {loadedCount}/{displayLimit} loaded
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: colors.textMuted }}>
            {selectedPages.size} of {displayLimit} selected
          </span>
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors active:scale-95"
            style={{
              background: "rgba(99,102,241,0.12)",
              color: "#818cf8",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
          >
            All
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors active:scale-95"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
            }}
          >
            None
          </button>
        </div>
      </div>

      {totalPages > MAX_PDF_PAGES && (
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{
            background: "rgba(251,191,36,0.06)",
            borderBottom: "1px solid rgba(251,191,36,0.12)",
          }}
        >
          <AlertCircleIcon
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: "#fbbf24" }}
          />
          <p className="text-[11px]" style={{ color: "#fbbf24" }}>
            This PDF has {totalPages} pages. Only the first {MAX_PDF_PAGES} are
            shown for preview. Splitting still applies to the full selection.
          </p>
        </div>
      )}

      <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[480px] overflow-y-auto">
        {thumbnails.map((dataUrl, i) => (
          <ThumbnailCard
            key={i}
            index={i}
            dataUrl={dataUrl}
            selected={selectedPages.has(i + 1)}
            onToggle={() => onToggle(i + 1)}
          />
        ))}
      </div>

      <div
        className="px-4 py-2.5"
        style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}
      >
        <p className="text-[10px]" style={{ color: colors.textDim }}>
          Tap/click pages to toggle · Selected pages will be merged into one
          document and converted to an editable format.
        </p>
      </div>
    </div>
  );
}

// ─── TagsInput (Labels only, with suggestions from existing labels) ──────────
function TagsInput({
  value,
  onChange,
  suggestions,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (!trimmed) return;
      if (!value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
    },
    [value, onChange]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag));
    },
    [value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) {
        addTag(input);
        setInput("");
      }
    }
    if (e.key === "Backspace" && !input && value.length) {
      removeTag(value[value.length - 1]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
    setInput("");
    setShowSuggestions(false);
  };

  const filteredSuggestions = useMemo(() => {
    if (!input.trim()) return [];
    return suggestions.filter(
      (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
    );
  }, [input, suggestions, value]);

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap gap-1.5 p-2 rounded-xl min-h-[42px] cursor-text transition-colors ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${colors.border}`,
        }}
        onClick={() => document.getElementById("tags-input")?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34d399",
              border: "1px solid rgba(52,211,153,0.2)",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="hover:opacity-60 transition-opacity active:scale-90"
            >
              <XIcon className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          id="tags-input"
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          disabled={disabled}
          placeholder={
            value.length === 0 ? "Add tags like: invoice, hr, contract" : ""
          }
          className="flex-1 min-w-[80px] text-xs bg-transparent outline-none disabled:opacity-50"
          style={{ color: colors.text }}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && !disabled && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-lg"
          style={{
            background: "#18182a",
            border: `1px solid ${colors.border}`,
          }}
        >
          {filteredSuggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                handleSuggestionClick(sug);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-white/5 active:bg-white/10"
              style={{ color: colors.textSecondary }}
            >
              <TagIcon className="w-3 h-3" style={{ color: "#34d399" }} />
              {sug}
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] mt-1" style={{ color: colors.textDim }}>
        Press Enter or comma to add · Backspace to remove last
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TemplateNewPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const generateUploadUrl = useMutation(api.templates.generateUploadUrl);
  const createTemplate = useMutation(api.templates.create);
  const allTemplates = useQuery(api.templates.getAll); // untuk saran labels

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<FileKind | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]); // hanya labels, tanpa folder

  // PDF state
  const [pdfThumbnails, setPdfThumbnails] = useState<(string | null)[]>([]);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);

  // Processing state
  const [stage, setStage] = useState<Stage>("");
  const [saving, setSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Existing labels untuk suggestions (dari semua template)
  const existingLabels = useMemo(() => {
    if (!allTemplates) return [];
    const lbls = new Set<string>();
    allTemplates.forEach((t) => {
      (t.tags || []).forEach((l) => lbls.add(l));
    });
    return Array.from(lbls).sort();
  }, [allTemplates]);

  // ── File handling ───────────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (f: File) => {
      if (isProcessing) return;
      const isPdf = f.name.toLowerCase().endsWith(".pdf");
      const isDocx = f.name.toLowerCase().endsWith(".docx");

      if (!isPdf && !isDocx) {
        toast.error("Please upload a PDF or DOCX file.");
        return;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error("File is too large. Maximum size is 20 MB.");
        return;
      }

      setFile(f);
      setFileKind(isPdf ? "pdf" : "docx");
      if (!name) setName(f.name.replace(/\.(pdf|docx)$/i, ""));

      if (isPdf) {
        await loadPdfThumbnails(f);
      }
    },
    [name, isProcessing]
  );

  const loadPdfThumbnails = async (f: File) => {
    setLoadingThumbnails(true);
    setPdfThumbnails([]);
    setPdfTotalPages(0);
    setSelectedPages(new Set());
    setStage("previewing");

    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      }).promise;
      const pageCount = pdf.numPages;

      if (pageCount === 0) {
        toast.error("This PDF appears to be empty. Please try another file.");
        resetFile();
        return;
      }

      const displayCount = Math.min(pageCount, MAX_PDF_PAGES);
      setPdfTotalPages(pageCount);
      setPdfThumbnails(new Array(displayCount).fill(null));
      setSelectedPages(
        new Set(Array.from({ length: displayCount }, (_, i) => i + 1))
      );

      for (let i = 1; i <= displayCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.38 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvas, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        setPdfThumbnails((prev) => {
          const next = [...prev];
          next[i - 1] = dataUrl;
          return next;
        });
      }
    } catch (err) {
      console.error("[PDF Preview]", err);
      toast.error(
        "We couldn't preview your PDF. The file may be corrupted or password-protected."
      );
      resetFile();
    } finally {
      setLoadingThumbnails(false);
      setStage("");
    }
  };

  const resetFile = () => {
    if (isProcessing) return;
    setFile(null);
    setFileKind(null);
    setPdfThumbnails([]);
    setPdfTotalPages(0);
    setSelectedPages(new Set());
    setLoadingThumbnails(false);
    setStage("");
  };

  // ── Page selection ──────────────────────────────────────────────────────────
  const togglePage = useCallback(
    (page: number) => {
      if (isProcessing) return;
      setSelectedPages((prev) => {
        const next = new Set(prev);
        if (next.has(page)) next.delete(page);
        else next.add(page);
        return next;
      });
    },
    [isProcessing]
  );

  const selectAllPages = useCallback(() => {
    if (isProcessing) return;
    setSelectedPages(
      new Set(
        Array.from(
          { length: Math.min(pdfTotalPages, MAX_PDF_PAGES) },
          (_, i) => i + 1
        )
      )
    );
  }, [pdfTotalPages, isProcessing]);

  const clearAllPages = useCallback(() => {
    if (isProcessing) return;
    setSelectedPages(new Set());
  }, [isProcessing]);

  // ── Build tags array (only labels) ──────────────────────────────────────────
  function buildTags(): string[] {
    return tags;
  }

  // ── Core DOCX upload + template creation ────────────────────────────────────
  const processDocx = async (docxFile: File): Promise<void> => {
    setStage("uploading");
    const uploadUrl = await generateUploadUrl();
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      body: docxFile,
    });
    if (!uploadRes.ok) throw new Error("Upload failed");
    const { storageId } = await uploadRes.json();

    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const fileUrl = `${convexSiteUrl}/getFile?storageId=${storageId}`;

    setStage("scanning");
    const mammoth = await import("mammoth");
    const buffer = await docxFile.arrayBuffer();
    const textResult = await mammoth.extractRawText({ arrayBuffer: buffer });
    const { detectPlaceholders } = await import("@/lib/placeholder-detector");
    const fields = detectPlaceholders(textResult.value);
    const templateTags = buildTags();

    const templateId = await createTemplate({
      name: name.trim(),
      description: description.trim() || undefined,
      storageId,
      fileUrl,
      previewText: textResult.value,
      tags: templateTags.length > 0 ? templateTags : undefined,
      organizationId: organization?.id,
      fields: fields.map((f) => ({
        id: f.id,
        name: f.name,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder,
        subFields: f.subFields?.map((sf) => ({
          id: sf.id,
          name: sf.name,
          label: sf.label,
          type: sf.type,
          required: sf.required,
          placeholder: sf.placeholder,
        })),
      })),
    });

    toast.success(
      fields.length > 0
        ? `Template created — ${fields.length} placeholder${fields.length !== 1 ? "s" : ""} detected`
        : "Template created — add placeholders in the editor"
    );
    router.push(`/templates/${templateId}/edit`);
  };

  // ── Save handlers with error handling ───────────────────────────────────────
  const handleSave = async () => {
    if (isProcessing) return;
    if (!file) {
      toast.error("Please upload a PDF or DOCX file first.");
      return;
    }
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    if (fileKind === "pdf" && selectedPages.size === 0) {
      toast.error("Please select at least one page.");
      return;
    }

    setIsProcessing(true);
    setSaving(true);
    try {
      if (fileKind === "pdf") {
        await handleSavePdf();
      } else {
        await handleSaveDocx();
      }
    } catch (err) {
      // Error already toast inside steps
    } finally {
      setSaving(false);
      setIsProcessing(false);
      setStage("");
    }
  };

  const handleSaveDocx = async () => {
    try {
      await processDocx(file!);
    } catch (err) {
      toast.error(
        "Couldn't create template. Please check your connection and try again."
      );
      throw err;
    }
  };

  const handleSavePdf = async () => {
    setStage("splitting");
    const splitForm = new FormData();
    splitForm.append("file", file!);
    splitForm.append(
      "pages",
      JSON.stringify(Array.from(selectedPages).sort((a, b) => a - b))
    );
    const splitRes = await fetch("/api/pdf/split", {
      method: "POST",
      body: splitForm,
    });
    if (!splitRes.ok) {
      const msg = await splitRes.text();
      throw new Error(
        msg || "We couldn't process your PDF. Please try another file."
      );
    }
    const splitBlob = await splitRes.blob();
    const splitFile = new File([splitBlob], "pages.pdf", {
      type: "application/pdf",
    });

    setStage("converting");
    const convertForm = new FormData();
    convertForm.append("file", splitFile);
    const convertRes = await fetch("/api/convert/pdf-to-docx", {
      method: "POST",
      body: convertForm,
    });
    if (!convertRes.ok) {
      const msg = await convertRes.text();
      throw new Error(
        msg ||
          "Something went wrong while converting your PDF. Please try again."
      );
    }
    const docxBlob = await convertRes.blob();
    const first4Bytes = await docxBlob.slice(0, 4).arrayBuffer();
    const header = new Uint8Array(first4Bytes);
    const isValidDocx =
      header[0] === 0x50 &&
      header[1] === 0x4b &&
      header[2] === 0x03 &&
      header[3] === 0x04;

    if (!isValidDocx) {
      // Coba baca sebagai text untuk melihat error
      const textSample = await docxBlob.slice(0, 500).text();
      console.error("[PDF conversion] Invalid DOCX, sample:", textSample);
      throw new Error(
        "The converted document is invalid. The PDF might be corrupted or the conversion service failed."
      );
    }
    const docxFile = new File([docxBlob], `${name.trim()}.docx`, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await processDocx(docxFile);
  };

  const canSave =
    !!file &&
    !!name.trim() &&
    !saving &&
    !loadingThumbnails &&
    (fileKind !== "pdf" || selectedPages.size > 0) &&
    !isProcessing;

  const currentStageLabel = stage
    ? STAGE_LABEL[stage]
    : saving
      ? "Saving…"
      : "";

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0 px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/templates"
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: colors.textMuted }}
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
            Templates
          </Link>
          <span style={{ color: colors.textDim, fontSize: 11 }}>/</span>
          <span
            className="text-sm font-semibold"
            style={{ color: colors.text }}
          >
            New template
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl pl-4 pr-4 sm:pl-6 sm:pr-6 py-3 lg:pl-8">
          <div className="mb-6">
            <h2
              className="text-base font-semibold"
              style={{ color: colors.text }}
            >
              Upload template file
            </h2>
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{ color: colors.textMuted }}
            >
              Upload a{" "}
              <code
                className="font-mono px-1 rounded text-[11px]"
                style={{
                  background: "rgba(99,102,241,0.12)",
                  color: "#818cf8",
                }}
              >
                .docx
              </code>{" "}
              or{" "}
              <code
                className="font-mono px-1 rounded text-[11px]"
                style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}
              >
                .pdf
              </code>{" "}
              file. PDFs support page selection before conversion.
            </p>
          </div>

          <div
            className={`space-y-8 transition-opacity duration-200 ${
              isProcessing ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {/* Upload zone */}
            {!file ? (
              <div
                className={`flex flex-col items-center justify-center p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                  isProcessing ? "cursor-not-allowed" : ""
                }`}
                style={{
                  borderColor: dragOver
                    ? colors.accent
                    : "rgba(255,255,255,0.1)",
                  background: dragOver
                    ? "rgba(99,102,241,0.06)"
                    : "rgba(255,255,255,0.02)",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isProcessing) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (!isProcessing) {
                    const f = e.dataTransfer.files[0];
                    if (f) handleFile(f);
                  }
                }}
                onClick={() => !isProcessing && inputRef.current?.click()}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.2)",
                  }}
                >
                  <UploadCloudIcon
                    className="w-6 h-6"
                    style={{ color: "#818cf8" }}
                  />
                </div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: colors.textSecondary }}
                >
                  Drop a file here, or click to browse
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      color: "#818cf8",
                      border: "1px solid rgba(99,102,241,0.18)",
                    }}
                  >
                    .docx
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: colors.textDim }}
                  >
                    or
                  </span>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                    style={{
                      background: "rgba(52,211,153,0.08)",
                      color: "#34d399",
                      border: "1px solid rgba(52,211,153,0.18)",
                    }}
                  >
                    .pdf
                  </span>
                </div>
                <p className="text-xs mt-2" style={{ color: colors.textDim }}>
                  Max 20 MB
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".docx,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                  disabled={isProcessing}
                />
              </div>
            ) : (
              <div
                className="flex items-center gap-3 p-4 rounded-2xl"
                style={{
                  background:
                    fileKind === "pdf"
                      ? "rgba(52,211,153,0.05)"
                      : "rgba(99,102,241,0.06)",
                  border: `1px solid ${
                    fileKind === "pdf"
                      ? "rgba(52,211,153,0.18)"
                      : "rgba(99,102,241,0.18)"
                  }`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background:
                      fileKind === "pdf"
                        ? "rgba(52,211,153,0.12)"
                        : "rgba(99,102,241,0.15)",
                  }}
                >
                  {fileKind === "pdf" ? (
                    <FileIcon
                      className="w-4 h-4"
                      style={{ color: "#34d399" }}
                    />
                  ) : (
                    <FileTextIcon
                      className="w-4 h-4"
                      style={{ color: "#818cf8" }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: colors.text }}
                  >
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-px rounded uppercase"
                      style={{
                        background:
                          fileKind === "pdf"
                            ? "rgba(52,211,153,0.12)"
                            : "rgba(99,102,241,0.12)",
                        color: fileKind === "pdf" ? "#34d399" : "#818cf8",
                      }}
                    >
                      {fileKind}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: colors.textMuted }}
                    >
                      {fileSizeMB(file.size)} MB
                    </span>
                    {fileKind === "pdf" && pdfTotalPages > 0 && (
                      <>
                        <span style={{ color: colors.textDim }}>·</span>
                        <span
                          className="text-[11px]"
                          style={{ color: colors.textMuted }}
                        >
                          {pdfTotalPages} page{pdfTotalPages !== 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={resetFile}
                  disabled={isProcessing}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:bg-white/10"
                  style={{ color: colors.textMuted }}
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* PDF page selection */}
            {fileKind === "pdf" &&
              (pdfThumbnails.length > 0 || loadingThumbnails) && (
                <div className="space-y-2">
                  {loadingThumbnails && pdfThumbnails.length === 0 ? (
                    <div
                      className="flex items-center justify-center gap-3 p-8 rounded-2xl"
                      style={{
                        border: "1px dashed rgba(99,102,241,0.2)",
                        background: "rgba(99,102,241,0.02)",
                      }}
                    >
                      <Loader2Icon
                        className="w-4 h-4 animate-spin"
                        style={{ color: "#818cf8" }}
                      />
                      <span
                        className="text-[13px]"
                        style={{ color: colors.textMuted }}
                      >
                        Preparing preview…
                      </span>
                    </div>
                  ) : (
                    <PageSelector
                      totalPages={pdfTotalPages}
                      thumbnails={pdfThumbnails}
                      selectedPages={selectedPages}
                      loading={loadingThumbnails}
                      onToggle={togglePage}
                      onSelectAll={selectAllPages}
                      onClearAll={clearAllPages}
                    />
                  )}
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                    style={{
                      background: "rgba(251,191,36,0.05)",
                      border: "1px solid rgba(251,191,36,0.1)",
                    }}
                  >
                    <AlertCircleIcon
                      className="w-3.5 h-3.5 shrink-0 mt-0.5"
                      style={{ color: "#fbbf24" }}
                    />
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: "#fbbf24" }}
                    >
                      <span className="font-semibold">
                        PDF conversion note:
                      </span>{" "}
                      Complex layouts, tables, or scanned pages may need manual
                      adjustment after conversion. Plain text PDFs convert best.
                    </p>
                  </div>
                </div>
              )}

            {/* DOCX hint */}
            {fileKind === "docx" && (
              <div
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                style={{
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.14)",
                }}
              >
                <ChevronRightIcon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "#818cf8" }}
                />
                <p className="text-[11px]" style={{ color: colors.textMuted }}>
                  Page selection is only available for PDF files. Your DOCX will
                  be used as-is.
                </p>
              </div>
            )}

            {/* Template metadata */}
            {file && (
              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold"
                    style={{ color: colors.textMuted }}
                  >
                    Template name <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input
                    placeholder="e.g. Employee Contract"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && canSave && handleSave()
                    }
                    disabled={isProcessing}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-50"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.border = `1px solid ${colors.accentBorder}`)
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.border = `1px solid ${colors.border}`)
                    }
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold"
                    style={{ color: colors.textMuted }}
                  >
                    Description{" "}
                    <span style={{ color: colors.textDim, fontWeight: 400 }}>
                      (optional)
                    </span>
                  </label>
                  <textarea
                    placeholder="What is this template used for?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    disabled={isProcessing}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none disabled:opacity-50"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.border = `1px solid ${colors.accentBorder}`)
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.border = `1px solid ${colors.border}`)
                    }
                  />
                </div>

                {/* Tags (labels) */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold flex items-center gap-1.5"
                    style={{ color: colors.textMuted }}
                  >
                    <TagIcon className="w-3 h-3" />
                    Labels{" "}
                    <span style={{ color: colors.textDim, fontWeight: 400 }}>
                      (optional)
                    </span>
                  </label>
                  <TagsInput
                    value={tags}
                    onChange={setTags}
                    suggestions={existingLabels}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {/* Save button */}
            {file && (
              <div className="space-y-3 pb-8">
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed"
                  style={{
                    background: canSave
                      ? "rgba(99,102,241,0.2)"
                      : "rgba(99,102,241,0.07)",
                    color: canSave ? colors.accentPale : colors.textDim,
                    border: `1px solid ${canSave ? colors.accentBorder : "rgba(99,102,241,0.1)"}`,
                  }}
                >
                  {saving || loadingThumbnails ? (
                    <>
                      <Loader2Icon
                        className="w-4 h-4 animate-spin"
                        style={{ color: colors.accentLight }}
                      />
                      {currentStageLabel ||
                        (loadingThumbnails ? "Preparing preview…" : "Saving…")}
                    </>
                  ) : fileKind === "pdf" && selectedPages.size === 0 ? (
                    "Select at least one page to continue"
                  ) : (
                    "Save & open editor →"
                  )}
                </button>

                {saving && (
                  <div className="flex items-center justify-center gap-2">
                    {(
                      [
                        "splitting",
                        "converting",
                        "uploading",
                        "scanning",
                      ] as Stage[]
                    ).map((s, i) => {
                      const stages: Stage[] =
                        fileKind === "pdf"
                          ? ["splitting", "converting", "uploading", "scanning"]
                          : ["uploading", "scanning"];
                      const stageIdx = stages.indexOf(s);
                      if (stageIdx === -1) return null;
                      const currentIdx = stages.indexOf(stage as Stage);
                      const isDone = currentIdx > stageIdx;
                      const isActive = stage === s;
                      return (
                        <div key={s} className="flex items-center gap-1">
                          <div
                            className="flex items-center gap-1"
                            style={{
                              opacity: isDone ? 0.4 : isActive ? 1 : 0.25,
                            }}
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                background: isDone
                                  ? "#34d399"
                                  : isActive
                                    ? "#818cf8"
                                    : "rgba(255,255,255,0.2)",
                              }}
                            />
                            <span
                              className="text-[10px] hidden sm:inline"
                              style={{
                                color: isDone
                                  ? "#34d399"
                                  : isActive
                                    ? "#818cf8"
                                    : colors.textDim,
                              }}
                            >
                              {STAGE_LABEL[s].replace("…", "")}
                            </span>
                          </div>
                          {stageIdx < stages.length - 1 && (
                            <ChevronRightIcon
                              className="w-2.5 h-2.5"
                              style={{ color: "rgba(255,255,255,0.1)" }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global processing message */}
      {isProcessing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/80 backdrop-blur-sm text-white text-xs font-medium shadow-lg">
          Please wait, your document is being processed…
        </div>
      )}
    </div>
  );
}
