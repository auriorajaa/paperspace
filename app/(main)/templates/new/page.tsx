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
  AlertTriangleIcon,
  RefreshCwIcon,
  InfoIcon,
} from "lucide-react";
import Link from "next/link";
import { colors } from "@/lib/design-tokens";

// ─── Constants ────────────────────────────────────────────────────────────────
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
  uploading: "Uploading document…",
  scanning: "Detecting placeholders…",
};

const STAGE_ORDER_PDF: Stage[] = [
  "splitting",
  "converting",
  "uploading",
  "scanning",
];
const STAGE_ORDER_DOCX: Stage[] = ["uploading", "scanning"];

const MAX_PDF_PAGES = 50;
const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fileSizeMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
function ErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-2xl"
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
      }}
    >
      <AlertTriangleIcon
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: "#f87171" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: "#fca5a5" }}>
          {message}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors active:scale-95"
            style={{
              background: "rgba(239,68,68,0.15)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <RefreshCwIcon className="w-3 h-3" />
            Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5 active:scale-90"
          style={{ color: "rgba(248,113,113,0.6)" }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({
  steps,
  current,
}: {
  steps: { label: string }[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 shrink-0"
                style={{
                  background: done
                    ? "rgba(52,211,153,0.15)"
                    : active
                      ? "rgba(99,102,241,0.25)"
                      : "rgba(255,255,255,0.05)",
                  border: done
                    ? "1.5px solid rgba(52,211,153,0.4)"
                    : active
                      ? "1.5px solid rgba(99,102,241,0.5)"
                      : "1.5px solid rgba(255,255,255,0.1)",
                  color: done ? "#34d399" : active ? "#818cf8" : colors.textDim,
                }}
              >
                {done ? <CheckIcon className="w-3 h-3" /> : i + 1}
              </div>
              <span
                className="text-[11px] font-medium hidden sm:block"
                style={{
                  color: done
                    ? "#34d399"
                    : active
                      ? colors.textSecondary
                      : colors.textDim,
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-6 sm:w-10 h-px mx-2 transition-all duration-300"
                style={{
                  background: done
                    ? "rgba(52,211,153,0.3)"
                    : "rgba(255,255,255,0.08)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Thumbnail Card ───────────────────────────────────────────────────────────
function ThumbnailCard({
  index,
  dataUrl,
  selected,
  onToggle,
  disabled,
}: {
  index: number;
  dataUrl: string | null;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="relative rounded-xl overflow-hidden transition-all duration-150 text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.97] disabled:pointer-events-none"
      style={{
        border: `2px solid ${selected ? "rgba(99,102,241,0.65)" : "rgba(255,255,255,0.07)"}`,
        background: selected
          ? "rgba(99,102,241,0.07)"
          : "rgba(255,255,255,0.02)",
        boxShadow: selected
          ? "0 0 0 2px rgba(99,102,241,0.15), 0 4px 12px rgba(99,102,241,0.1)"
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
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <Loader2Icon
              className="w-4 h-4 animate-spin"
              style={{ color: "rgba(255,255,255,0.12)" }}
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
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {index + 1}
        </span>
      </div>
      <div
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150"
        style={{
          background: selected ? "#6366f1" : "rgba(0,0,0,0.4)",
          border: `1.5px solid ${selected ? "#818cf8" : "rgba(255,255,255,0.15)"}`,
        }}
      >
        {selected && <CheckIcon className="w-3 h-3 text-white" />}
      </div>
    </button>
  );
}

// ─── Page Selector ────────────────────────────────────────────────────────────
function PageSelector({
  totalPages,
  thumbnails,
  selectedPages,
  loading,
  onToggle,
  onSelectAll,
  onClearAll,
  disabled,
}: {
  totalPages: number;
  thumbnails: (string | null)[];
  selectedPages: Set<number>;
  loading: boolean;
  onToggle: (page: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  disabled?: boolean;
}) {
  const loadedCount = thumbnails.filter(Boolean).length;
  const displayLimit = Math.min(totalPages, MAX_PDF_PAGES);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid rgba(99,102,241,0.15)`,
        background: "rgba(99,102,241,0.025)",
      }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(99,102,241,0.1)" }}
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
            Select pages
          </span>
          {loading && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(99,102,241,0.12)",
                color: "#818cf8",
              }}
            >
              {loadedCount}/{displayLimit} loaded
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]" style={{ color: colors.textMuted }}>
            {selectedPages.size}/{displayLimit}
          </span>
          <button
            type="button"
            onClick={onSelectAll}
            disabled={disabled}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors active:scale-95 disabled:opacity-40 min-h-[30px]"
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
            disabled={disabled}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors active:scale-95 disabled:opacity-40 min-h-[30px]"
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
          className="flex items-start gap-2.5 px-4 py-2.5"
          style={{
            background: "rgba(251,191,36,0.05)",
            borderBottom: "1px solid rgba(251,191,36,0.1)",
          }}
        >
          <InfoIcon
            className="w-3.5 h-3.5 shrink-0 mt-0.5"
            style={{ color: "#fbbf24" }}
          />
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: "#fbbf24" }}
          >
            This PDF has {totalPages} pages. Preview shows first {MAX_PDF_PAGES}{" "}
            pages only.
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[420px] overflow-y-auto">
        {thumbnails.map((dataUrl, i) => (
          <ThumbnailCard
            key={i}
            index={i}
            dataUrl={dataUrl}
            selected={selectedPages.has(i + 1)}
            onToggle={() => onToggle(i + 1)}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ borderTop: "1px solid rgba(99,102,241,0.08)" }}
      >
        <InfoIcon
          className="w-3 h-3 shrink-0"
          style={{ color: colors.textDim }}
        />
        <p className="text-[10px]" style={{ color: colors.textDim }}>
          Tap pages to select · Selected pages will be merged and converted to
          editable format
        </p>
      </div>
    </div>
  );
}

// ─── Tags Input ───────────────────────────────────────────────────────────────
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
      if (!value.includes(trimmed)) onChange([...value, trimmed]);
    },
    [value, onChange]
  );

  const removeTag = useCallback(
    (tag: string) => onChange(value.filter((t) => t !== tag)),
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

  const filteredSuggestions = useMemo(() => {
    if (!input.trim()) return [];
    return suggestions.filter(
      (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
    );
  }, [input, suggestions, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap gap-1.5 p-2.5 rounded-xl min-h-[44px] cursor-text transition-colors ${
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
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34d399",
              border: "1px solid rgba(52,211,153,0.18)",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="hover:opacity-60 transition-opacity active:scale-90 -mr-0.5"
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
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          disabled={disabled}
          placeholder={value.length === 0 ? "invoice, hr, contract…" : ""}
          className="flex-1 min-w-[80px] text-xs bg-transparent outline-none disabled:opacity-50"
          style={{ color: colors.text }}
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && !disabled && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-xl"
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
                e.preventDefault();
                addTag(sug);
                setInput("");
                setShowSuggestions(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[12px] transition-colors hover:bg-white/5 active:bg-white/10 min-h-[40px]"
              style={{ color: colors.textSecondary }}
            >
              <TagIcon className="w-3 h-3" style={{ color: "#34d399" }} />
              {sug}
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] mt-1.5" style={{ color: colors.textDim }}>
        Press Enter or comma to add · Backspace removes last
      </p>
    </div>
  );
}

// ─── Field Error ──────────────────────────────────────────────────────────────
function FieldError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <AlertCircleIcon
        className="w-3 h-3 shrink-0"
        style={{ color: "#f87171" }}
      />
      <p className="text-[11px]" style={{ color: "#f87171" }}>
        {message}
      </p>
    </div>
  );
}

// ─── Progress Steps (inline during save) ──────────────────────────────────────
function ProgressSteps({
  stages,
  current,
}: {
  stages: Stage[];
  current: Stage;
}) {
  const currentIdx = stages.indexOf(current);

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {stages.map((s, i) => {
        const isDone = currentIdx > i;
        const isActive = current === s;
        return (
          <div key={s} className="flex items-center gap-1">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full transition-all duration-300"
              style={{
                background: isDone
                  ? "rgba(52,211,153,0.08)"
                  : isActive
                    ? "rgba(99,102,241,0.12)"
                    : "transparent",
                opacity: isDone ? 0.5 : isActive ? 1 : 0.25,
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
                className="text-[10px] font-medium"
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
            {i < stages.length - 1 && (
              <ChevronRightIcon
                className="w-2.5 h-2.5"
                style={{ color: "rgba(255,255,255,0.08)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TemplateNewPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const generateUploadUrl = useMutation(api.templates.generateUploadUrl);
  const createTemplate = useMutation(api.templates.create);
  const allTemplates = useQuery(api.templates.getAll);
  const deleteTempStorage = useMutation(api.templates.deleteTempStorage);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<FileKind | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Field-level errors
  const [nameError, setNameError] = useState("");

  // Critical error banner (for upload/convert failures)
  const [criticalError, setCriticalError] = useState("");

  // PDF state
  const [pdfThumbnails, setPdfThumbnails] = useState<(string | null)[]>([]);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [pdfError, setPdfError] = useState("");

  // Processing state
  const [stage, setStage] = useState<Stage>("");
  const [saving, setSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Existing labels for suggestions
  const existingLabels = useMemo(() => {
    if (!allTemplates) return [];
    const lbls = new Set<string>();
    allTemplates.forEach((t) => (t.tags || []).forEach((l) => lbls.add(l)));
    return Array.from(lbls).sort();
  }, [allTemplates]);

  // Derive current "step" for indicator
  const currentStep = !file
    ? 0
    : fileKind === "pdf" &&
        !pdfError &&
        (pdfThumbnails.length > 0 || loadingThumbnails)
      ? 1
      : 1;
  const wizardSteps = [
    { label: "Upload file" },
    { label: "Details" },
    { label: "Save" },
  ];

  // ── File handling ────────────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (f: File) => {
      if (isProcessing) return;
      setCriticalError("");
      setPdfError("");

      const isPdf = f.name.toLowerCase().endsWith(".pdf");
      const isDocx = f.name.toLowerCase().endsWith(".docx");

      if (!isPdf && !isDocx) {
        toast.error("Unsupported file type.", {
          description: "Please upload a .pdf or .docx file.",
        });
        return;
      }

      if (f.size > MAX_FILE_BYTES) {
        toast.error(`File too large — max ${MAX_FILE_MB} MB`, {
          description: `Your file is ${fileSizeMB(f.size)} MB. Please compress or trim it before uploading.`,
        });
        return;
      }

      if (f.size === 0) {
        toast.error("This file appears to be empty.", {
          description: "Please try a different file.",
        });
        return;
      }

      setFile(f);
      setFileKind(isPdf ? "pdf" : "docx");
      if (!name) setName(f.name.replace(/\.(pdf|docx)$/i, ""));

      if (isPdf) await loadPdfThumbnails(f);
    },
    [name, isProcessing]
  );

  const loadPdfThumbnails = async (f: File) => {
    setLoadingThumbnails(true);
    setPdfThumbnails([]);
    setPdfTotalPages(0);
    setSelectedPages(new Set());
    setPdfError("");
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
        setPdfError("This PDF appears to be empty. Please try another file.");
        setFile(null);
        setFileKind(null);
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
    } catch (err: unknown) {
      console.error("[PDF Preview]", err);
      const isPasswordError =
        err instanceof Error &&
        (err.message.includes("password") || err.message.includes("encrypted"));
      setPdfError(
        isPasswordError
          ? "This PDF is password-protected and cannot be previewed. Please remove the password and try again."
          : "Couldn't load PDF preview. The file may be corrupted. Please try another file."
      );
      setFile(null);
      setFileKind(null);
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
    setCriticalError("");
    setPdfError("");
    setNameError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  // ── Page selection ───────────────────────────────────────────────────────────
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

  // ── Core DOCX upload ─────────────────────────────────────────────────────────
  const processDocx = async (docxFile: File): Promise<void> => {
    setStage("uploading");
    let uploadUrl: string;
    try {
      uploadUrl = await generateUploadUrl();
    } catch {
      throw new Error(
        "Couldn't connect to storage. Please check your connection and try again."
      );
    }

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      body: docxFile,
    });
    if (!uploadRes.ok) {
      throw new Error(`Upload failed (${uploadRes.status}). Please try again.`);
    }
    const { storageId } = await uploadRes.json();

    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const fileUrl = `${convexSiteUrl}/getFile?storageId=${storageId}`;

    setStage("scanning");
    const mammoth = await import("mammoth");
    const buffer = await docxFile.arrayBuffer();
    const textResult = await mammoth.extractRawText({ arrayBuffer: buffer });
    const { detectPlaceholders } = await import("@/lib/placeholder-detector");
    const fields = detectPlaceholders(textResult.value);
    const templateTags = tags;

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

  // ── Save handler ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isProcessing) return;
    setCriticalError("");

    // Validate
    if (!file) {
      toast.error("Please upload a file first.");
      return;
    }
    if (!name.trim()) {
      setNameError("Template name is required.");
      document.getElementById("template-name")?.focus();
      return;
    }
    if (fileKind === "pdf" && selectedPages.size === 0) {
      toast.error("Please select at least one page to continue.");
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
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setCriticalError(message);
    } finally {
      setSaving(false);
      setIsProcessing(false);
      setStage("");
    }
  };

  const handleSaveDocx = async () => {
    await processDocx(file!);
  };

  const handleSavePdf = async () => {
    // Step 1: Split selected pages
    setStage("splitting");
    const splitForm = new FormData();
    splitForm.append("file", file!);
    splitForm.append(
      "pages",
      JSON.stringify(Array.from(selectedPages).sort((a, b) => a - b))
    );

    let splitRes: Response;
    try {
      splitRes = await fetch("/api/pdf/split", {
        method: "POST",
        body: splitForm,
      });
    } catch {
      throw new Error(
        "Network error while processing your PDF. Please check your connection."
      );
    }

    if (!splitRes.ok) {
      const msg = await splitRes.text().catch(() => "");
      throw new Error(
        msg || "We couldn't process your PDF. Please try another file."
      );
    }

    const splitBlob = await splitRes.blob();
    const splitFile = new File([splitBlob], "pages.pdf", {
      type: "application/pdf",
    });

    // Step 2: Convert to DOCX
    setStage("converting");
    const convertForm = new FormData();
    convertForm.append("file", splitFile);

    let convertRes: Response;
    try {
      convertRes = await fetch("/api/convert/pdf-to-docx", {
        method: "POST",
        body: convertForm,
      });
    } catch {
      throw new Error(
        "Network error during PDF conversion. Please check your connection."
      );
    }

    if (!convertRes.ok) {
      const msg = await convertRes.text().catch(() => "");
      if (convertRes.status === 504) {
        throw new Error(
          "PDF conversion timed out. Try selecting fewer pages or using a simpler PDF."
        );
      }
      throw new Error(
        msg ||
          "PDF conversion failed. Plain text PDFs work best — try another file."
      );
    }

    const docxBlob = await convertRes.blob();

    // Validate magic bytes
    const first4Bytes = await docxBlob.slice(0, 4).arrayBuffer();
    const header = new Uint8Array(first4Bytes);
    const isValidDocx =
      header[0] === 0x50 &&
      header[1] === 0x4b &&
      header[2] === 0x03 &&
      header[3] === 0x04;

    if (!isValidDocx) {
      throw new Error(
        "The converted document is invalid. The PDF might use an unsupported format — try a different file or fewer pages."
      );
    }

    const docxFile = new File([docxBlob], `${name.trim()}.docx`, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // Step 3: Upload
    await processDocx(docxFile);
  };

  const canSave =
    !!file &&
    !!name.trim() &&
    !saving &&
    !loadingThumbnails &&
    (fileKind !== "pdf" || selectedPages.size > 0) &&
    !isProcessing;

  const activeStages = fileKind === "pdf" ? STAGE_ORDER_PDF : STAGE_ORDER_DOCX;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/templates"
              className="flex items-center gap-1 text-xs transition-colors hover:opacity-80 min-h-[32px]"
              style={{ color: colors.textMuted }}
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Templates</span>
            </Link>
            <span style={{ color: colors.textDim, fontSize: 11 }}>/</span>
            <span
              className="text-sm font-semibold"
              style={{ color: colors.text }}
            >
              New template
            </span>
          </div>

          {/* Step indicator */}
          <StepIndicator
            steps={wizardSteps}
            current={!file ? 0 : saving ? 2 : 1}
          />
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-4 mx-auto lg:mx-0">
          {/* Critical error banner */}
          {criticalError && (
            <div className="mb-5">
              <ErrorBanner
                message={criticalError}
                onRetry={() => {
                  setCriticalError("");
                  handleSave();
                }}
                onDismiss={() => setCriticalError("")}
              />
            </div>
          )}

          {/* PDF load error */}
          {pdfError && (
            <div className="mb-5">
              <ErrorBanner
                message={pdfError}
                onDismiss={() => setPdfError("")}
              />
            </div>
          )}

          <div
            className={`space-y-6 transition-opacity duration-200 ${
              isProcessing ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {/* ── SECTION 1: Upload ─────────────────────────────────────── */}
            <section>
              <div className="mb-3">
                <h2
                  className="text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  1. Upload file
                </h2>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: colors.textMuted }}
                >
                  Supports{" "}
                  <code
                    className="font-mono text-[11px] px-1 rounded"
                    style={{
                      background: "rgba(99,102,241,0.12)",
                      color: "#818cf8",
                    }}
                  >
                    .docx
                  </code>{" "}
                  and{" "}
                  <code
                    className="font-mono text-[11px] px-1 rounded"
                    style={{
                      background: "rgba(52,211,153,0.1)",
                      color: "#34d399",
                    }}
                  >
                    .pdf
                  </code>{" "}
                  · Max {MAX_FILE_MB} MB
                </p>
              </div>

              {!file ? (
                /* Drop zone */
                <div
                  className={`flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none ${
                    isProcessing
                      ? "cursor-not-allowed"
                      : "hover:border-indigo-500/40"
                  }`}
                  style={{
                    borderColor: dragOver
                      ? colors.accent
                      : "rgba(255,255,255,0.09)",
                    background: dragOver
                      ? "rgba(99,102,241,0.06)"
                      : "rgba(255,255,255,0.018)",
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
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200"
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      transform: dragOver ? "scale(1.08)" : "scale(1)",
                    }}
                  >
                    <UploadCloudIcon
                      className="w-7 h-7"
                      style={{ color: "#818cf8" }}
                    />
                  </div>

                  <p
                    className="text-sm font-semibold mb-1 text-center"
                    style={{ color: colors.textSecondary }}
                  >
                    {dragOver ? "Release to upload" : "Drop a file here"}
                  </p>
                  <p
                    className="text-xs mb-4 text-center"
                    style={{ color: colors.textMuted }}
                  >
                    or tap to browse your device
                  </p>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
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
                      className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                      style={{
                        background: "rgba(52,211,153,0.08)",
                        color: "#34d399",
                        border: "1px solid rgba(52,211,153,0.18)",
                      }}
                    >
                      .pdf
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: colors.textDim }}
                    >
                      · max {MAX_FILE_MB} MB
                    </span>
                  </div>

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
                /* File card */
                <div
                  className="flex items-center gap-3 p-4 rounded-2xl"
                  style={{
                    background:
                      fileKind === "pdf"
                        ? "rgba(52,211,153,0.04)"
                        : "rgba(99,102,241,0.05)",
                    border: `1px solid ${
                      fileKind === "pdf"
                        ? "rgba(52,211,153,0.16)"
                        : "rgba(99,102,241,0.16)"
                    }`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background:
                        fileKind === "pdf"
                          ? "rgba(52,211,153,0.1)"
                          : "rgba(99,102,241,0.14)",
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
                        className="text-[10px] font-bold px-1.5 py-px rounded uppercase tracking-wide"
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
                            {pdfTotalPages} page
                            {pdfTotalPages !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={resetFile}
                    disabled={isProcessing}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5 active:bg-white/10 active:scale-90 disabled:opacity-40"
                    style={{ color: colors.textMuted }}
                    title="Remove file"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </section>

            {/* ── PDF loading state ──────────────────────────────────────── */}
            {fileKind === "pdf" &&
              loadingThumbnails &&
              pdfThumbnails.length === 0 && (
                <div
                  className="flex items-center justify-center gap-3 p-8 rounded-2xl"
                  style={{
                    border: "1px dashed rgba(99,102,241,0.18)",
                    background: "rgba(99,102,241,0.02)",
                  }}
                >
                  <Loader2Icon
                    className="w-4 h-4 animate-spin"
                    style={{ color: "#818cf8" }}
                  />
                  <span className="text-sm" style={{ color: colors.textMuted }}>
                    Loading page previews…
                  </span>
                </div>
              )}

            {/* ── SECTION 2: Page selection (PDF only) ──────────────────── */}
            {fileKind === "pdf" && pdfThumbnails.length > 0 && (
              <section>
                <div className="mb-3">
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: colors.text }}
                  >
                    2. Choose pages
                  </h2>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: colors.textMuted }}
                  >
                    Select which pages to include in the template
                  </p>
                </div>

                <PageSelector
                  totalPages={pdfTotalPages}
                  thumbnails={pdfThumbnails}
                  selectedPages={selectedPages}
                  loading={loadingThumbnails}
                  onToggle={togglePage}
                  onSelectAll={selectAllPages}
                  onClearAll={clearAllPages}
                  disabled={isProcessing}
                />

                {selectedPages.size === 0 && !isProcessing && (
                  <FieldError message="Select at least one page to continue." />
                )}

                {/* PDF conversion note */}
                <div
                  className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mt-3"
                  style={{
                    background: "rgba(251,191,36,0.04)",
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
                    <span className="font-semibold">Conversion note:</span>{" "}
                    Complex layouts, tables, or scanned/image-based pages may
                    need manual adjustments. Plain text PDFs convert best.
                  </p>
                </div>
              </section>
            )}

            {/* ── SECTION 3: Template details (shown after file is loaded) ── */}
            {file && (
              <section>
                <div className="mb-3">
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: colors.text }}
                  >
                    {fileKind === "pdf" ? "3." : "2."} Template details
                  </h2>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: colors.textMuted }}
                  >
                    Name and categorize your template
                  </p>
                </div>

                <div
                  className="rounded-2xl p-4 space-y-4"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="template-name"
                      className="text-xs font-semibold flex items-center gap-1"
                      style={{ color: colors.textMuted }}
                    >
                      Template name
                      <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input
                      id="template-name"
                      placeholder="e.g. Employee Contract"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (e.target.value.trim()) setNameError("");
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" && canSave && handleSave()
                      }
                      disabled={isProcessing}
                      className="w-full rounded-xl px-3.5 py-3 text-sm outline-none disabled:opacity-50 transition-colors min-h-[44px]"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${nameError ? "rgba(239,68,68,0.5)" : colors.border}`,
                        color: colors.text,
                      }}
                      onFocus={(e) =>
                        !nameError &&
                        (e.currentTarget.style.border = `1px solid ${colors.accentBorder}`)
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.border = `1px solid ${nameError ? "rgba(239,68,68,0.5)" : colors.border}`)
                      }
                    />
                    {nameError && <FieldError message={nameError} />}
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
                      className="w-full rounded-xl px-3.5 py-3 text-sm outline-none resize-none disabled:opacity-50 transition-colors"
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

                  {/* Tags */}
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
              </section>
            )}

            {/* ── Save button ──────────────────────────────────────────── */}
            {file && (
              <section className="pb-10">
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed min-h-[52px]"
                  style={{
                    background: canSave
                      ? "rgba(99,102,241,0.22)"
                      : "rgba(99,102,241,0.06)",
                    color: canSave ? colors.accentPale : colors.textDim,
                    border: `1.5px solid ${canSave ? colors.accentBorder : "rgba(99,102,241,0.09)"}`,
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2Icon
                        className="w-4 h-4 animate-spin"
                        style={{ color: colors.accentLight }}
                      />
                      <span>{STAGE_LABEL[stage] || "Saving…"}</span>
                    </>
                  ) : fileKind === "pdf" && selectedPages.size === 0 ? (
                    "Select at least one page to continue"
                  ) : !name.trim() ? (
                    "Enter a template name to continue"
                  ) : (
                    <>
                      Save & open editor
                      <ChevronRightIcon className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Progress steps during save */}
                {saving && stage && (
                  <div className="mt-3">
                    <ProgressSteps stages={activeStages} current={stage} />
                  </div>
                )}

                {/* DOCX hint */}
                {fileKind === "docx" && !saving && (
                  <p
                    className="text-[11px] text-center mt-2"
                    style={{ color: colors.textDim }}
                  >
                    Your DOCX will be used as-is · placeholders detected
                    automatically
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      {/* ── Global processing overlay toast ─────────────────────────────── */}
      {isProcessing && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-xl text-xs font-medium"
          style={{
            background: "rgba(15,15,25,0.92)",
            border: "1px solid rgba(99,102,241,0.25)",
            backdropFilter: "blur(12px)",
            color: colors.textSecondary,
          }}
        >
          <Loader2Icon
            className="w-3.5 h-3.5 animate-spin"
            style={{ color: "#818cf8" }}
          />
          {STAGE_LABEL[stage] || "Processing…"}
        </div>
      )}
    </div>
  );
}
