// app\(main)\documents\documents-client.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useOrganization, useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  PlusIcon,
  FileTextIcon,
  SparklesIcon,
  MoreHorizontalIcon,
  CopyIcon,
  ArchiveIcon,
  Trash2Icon,
  SearchIcon,
  LayoutGridIcon,
  ListIcon,
  ChevronDownIcon,
  ArchiveRestoreIcon,
  FolderPlusIcon,
  CheckIcon,
  XIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
  UsersIcon,
  FileIcon,
  MinusIcon,
  CheckSquareIcon,
  ExternalLinkIcon,
  DownloadIcon,
  PackageIcon,
  UploadCloudIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  Loader2Icon,
} from "lucide-react";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebounce } from "@/lib/useDebounce";
import { shadows } from "@/lib/design-tokens";
import { COLLECTION_ICONS, getIconComponent } from "@/lib/collection-icons";
import { useTheme } from "@/contexts/ThemeContext";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function smartDate(ts: number): string {
  if (differenceInHours(Date.now(), ts) < 24) {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  }
  return format(new Date(ts), "MMM d, h:mm a");
}

const PAGE_SIZE = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Export helper
// ─────────────────────────────────────────────────────────────────────────────

async function handleExportDoc(doc: Doc<"documents">, fmt: "docx" | "pdf") {
  if (!doc.fileUrl) {
    toast.error("No file available for this document.");
    return;
  }
  if (fmt === "docx") {
    const toastId = toast.loading("Preparing download…");
    try {
      const res = await fetch(doc.fileUrl);
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = globalThis.document.createElement("a");
      a.href = url;
      a.download = `${doc.title}.docx`;
      globalThis.document.body.appendChild(a);
      a.click();
      globalThis.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.dismiss(toastId);
      toast.success("Downloading .docx file");
    } catch {
      toast.dismiss(toastId);
      toast.error("Failed to download file.");
    }
  } else {
    const toastId = toast.loading("Converting to PDF…");
    try {
      const res = await fetch("/api/onlyoffice-convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: doc.fileUrl, fileName: doc.title }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = globalThis.document.createElement("a");
      a.href = url;
      a.download = `${doc.title}.pdf`;
      globalThis.document.body.appendChild(a);
      a.click();
      globalThis.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.dismiss(toastId);
      toast.success("PDF downloaded");
    } catch {
      toast.dismiss(toastId);
      toast.error("PDF export failed. Check OnlyOffice setup.");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Document Dialog
// ─────────────────────────────────────────────────────────────────────────────

type UploadStage = "" | "converting" | "uploading" | "saving";

const UPLOAD_STAGE_LABELS: Record<UploadStage, string> = {
  "": "",
  converting: "Converting to editable format…",
  uploading: "Uploading document…",
  saving: "Saving paper…",
};

const UPLOAD_STAGES_PDF: UploadStage[] = ["converting", "uploading", "saving"];
const UPLOAD_STAGES_DOCX: UploadStage[] = ["uploading", "saving"];

const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const PDF_CONVERT_TIMEOUT_MS = 65_000; // slightly above the API's 60 s

function UploadDocumentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { organization } = useOrganization();
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const updateDocument = useMutation(api.documents.update);

  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<"docx" | "pdf" | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [stage, setStage] = useState<UploadStage>("");
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // ── Reset on open / close ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setFile(null);
      setFileKind(null);
      setDragOver(false);
      setName("");
      setNameError("");
      setStage("");
      setProcessing(false);
      setErrorMsg("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [open]);

  // ── File validation & acceptance ───────────────────────────────────────────
  const acceptFile = useCallback(
    (f: File) => {
      if (processing) return;
      setErrorMsg("");

      const lower = f.name.toLowerCase();
      if (lower.endsWith(".doc")) {
        toast.error(".doc files are not supported.", {
          description: "Please save as .docx and try again.",
        });
        return;
      }
      const isPdf = lower.endsWith(".pdf");
      const isDocx = lower.endsWith(".docx");
      if (!isPdf && !isDocx) {
        toast.error("Unsupported file type.", {
          description: "Please upload a .pdf or .docx file.",
        });
        return;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        toast.error(`File too large — max ${MAX_UPLOAD_MB} MB`, {
          description: `Your file is ${(f.size / 1024 / 1024).toFixed(1)} MB.`,
        });
        return;
      }
      if (f.size === 0) {
        toast.error("This file appears to be empty.");
        return;
      }

      setFile(f);
      setFileKind(isPdf ? "pdf" : "docx");
      // Only pre-fill name if the user hasn't typed one yet
      if (!nameRef.current) {
        setName(f.name.replace(/\.(pdf|docx)$/i, ""));
      }
    },
    [processing]
  );

  const resetFile = () => {
    if (processing) return;
    setFile(null);
    setFileKind(null);
    setErrorMsg("");
    setNameError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  // ── Core upload handler ────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (processing || !file) return;
    setErrorMsg("");

    if (!name.trim()) {
      setNameError("Paper name is required.");
      return;
    }

    setProcessing(true);

    try {
      let docxFile: File = file;

      // ── Step 1 (PDF only): convert to DOCX via OnlyOffice ─────────────────
      if (fileKind === "pdf") {
        setStage("converting");

        const form = new FormData();
        form.append("file", file);

        const controller = new AbortController();
        const tid = setTimeout(
          () => controller.abort(),
          PDF_CONVERT_TIMEOUT_MS
        );

        let convertRes: Response;
        try {
          convertRes = await fetch("/api/convert/pdf-to-docx", {
            method: "POST",
            body: form,
            signal: controller.signal,
          });
        } catch (err: any) {
          if (err?.name === "AbortError") {
            throw new Error(
              "PDF conversion timed out. Try a smaller or simpler PDF."
            );
          }
          throw new Error(
            "Network error during conversion. Please check your connection."
          );
        } finally {
          clearTimeout(tid);
        }

        if (!convertRes.ok) {
          const msg = await convertRes.text().catch(() => "");
          if (convertRes.status === 504) {
            throw new Error(
              "PDF conversion timed out. Try a smaller or simpler PDF."
            );
          }
          if (convertRes.status === 413) {
            throw new Error(
              `File too large — maximum size is ${MAX_UPLOAD_MB} MB.`
            );
          }
          if (convertRes.status === 415) {
            throw new Error("Only PDF files can be converted.");
          }
          throw new Error(
            msg ||
              "PDF conversion failed. Plain-text PDFs convert best — try a different file."
          );
        }

        const docxBlob = await convertRes.blob();

        // Validate DOCX magic bytes (PK zip header)
        const header = new Uint8Array(await docxBlob.slice(0, 4).arrayBuffer());
        if (
          header[0] !== 0x50 ||
          header[1] !== 0x4b ||
          header[2] !== 0x03 ||
          header[3] !== 0x04
        ) {
          throw new Error(
            "Converted document is invalid. The PDF may use an unsupported format — try another file."
          );
        }

        docxFile = new File([docxBlob], `${name.trim()}.docx`, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      }

      // ── Step 2: upload DOCX to Convex storage ─────────────────────────────
      setStage("uploading");

      let uploadUrl: string;
      try {
        uploadUrl = await generateUploadUrl();
      } catch {
        throw new Error("Could not reach storage. Please try again.");
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
        throw new Error(
          `Upload failed (${uploadRes.status}). Please try again.`
        );
      }
      const { storageId } = await uploadRes.json();
      if (!storageId) {
        throw new Error("Upload succeeded but no storage ID was returned.");
      }

      // ── Step 3: create document record ────────────────────────────────────
      setStage("saving");
      const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
      const docId = await createDocument({
        title: name.trim(),
        organizationId: organization?.id,
        storageId,
      });
      await updateDocument({
        id: docId,
        fileUrl: `${convexSiteUrl}/getFile?storageId=${storageId}`,
      });

      toast.success(
        fileKind === "pdf"
          ? "PDF converted & uploaded — ready to edit"
          : "Paper uploaded successfully"
      );
      onOpenChange(false);
      router.push(`/documents/${docId}`);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
      setStage("");
    }
  }, [
    processing,
    file,
    fileKind,
    name,
    generateUploadUrl,
    createDocument,
    updateDocument,
    organization,
    router,
    onOpenChange,
  ]);

  const canUpload = !!file && !!name.trim() && !processing;
  const activeStages =
    fileKind === "pdf" ? UPLOAD_STAGES_PDF : UPLOAD_STAGES_DOCX;

  return (
    <Dialog open={open} onOpenChange={(v) => !processing && onOpenChange(v)}>
      <DialogContent
        className="w-[calc(100vw-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-hover)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <UploadCloudIcon
                className="w-4 h-4"
                style={{ color: "var(--accent-light)" }}
              />
            </div>
            <DialogTitle
              className="text-[14px] font-semibold"
              style={{ color: "var(--text)" }}
            >
              Upload paper
            </DialogTitle>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            .docx · .pdf · max {MAX_UPLOAD_MB} MB
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Error banner */}
          {errorMsg && (
            <div
              className="flex items-start gap-3 p-3.5 rounded-xl"
              style={{
                background: "var(--danger-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
              }}
            >
              <AlertTriangleIcon
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: "var(--danger)" }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: "var(--danger)" }}
                >
                  {errorMsg}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg("");
                    handleUpload();
                  }}
                  className="mt-2 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors active:scale-95"
                  style={{
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                    border:
                      "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                  }}
                >
                  <RefreshCwIcon className="w-3 h-3" />
                  Try again
                </button>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg("")}
                className="w-6 h-6 flex items-center justify-center rounded-lg"
                style={{ color: "var(--danger)", opacity: 0.7 }}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Drop zone / file row */}
          <div
            className={`transition-opacity duration-200 ${
              processing ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {!file ? (
              /* ── Drop zone ───────────────────────────────────────────────── */
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload file"
                className="flex flex-col items-center justify-center p-7 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none outline-none focus-visible:ring-2"
                style={{
                  borderColor: dragOver ? "var(--primary)" : "var(--bg-input)",
                  background: dragOver
                    ? "var(--accent-soft)"
                    : "var(--bg-muted)",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) acceptFile(f);
                }}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200"
                  style={{
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent-border)",
                    transform: dragOver ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  <UploadCloudIcon
                    className="w-5 h-5"
                    style={{ color: "var(--accent-light)" }}
                  />
                </div>
                <p
                  className="text-[13px] font-semibold mb-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {dragOver ? "Release to upload" : "Drop a file here"}
                </p>
                <p
                  className="text-[11px] mb-3.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  or tap to browse your device
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent-light)",
                      border: "1px solid var(--accent-border)",
                    }}
                  >
                    .docx
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--text-dim)" }}
                  >
                    or
                  </span>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                    style={{
                      background: "var(--success-bg)",
                      color: "var(--success)",
                      border:
                        "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
                    }}
                  >
                    .pdf
                  </span>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".docx,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) acceptFile(f);
                    // allow re-selecting the same file
                    e.target.value = "";
                  }}
                />
              </div>
            ) : (
              /* ── File chip ─────────────────────────────────────────────── */
              <div
                className="flex items-center gap-3 p-3.5 rounded-xl"
                style={{
                  background:
                    fileKind === "pdf"
                      ? "var(--success-bg)"
                      : "var(--accent-soft)",
                  border: `1px solid ${
                    fileKind === "pdf"
                      ? "color-mix(in srgb, var(--success) 22%, transparent)"
                      : "var(--accent-border)"
                  }`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background:
                      fileKind === "pdf"
                        ? "color-mix(in srgb, var(--success) 12%, transparent)"
                        : "color-mix(in srgb, var(--accent-light) 10%, transparent)",
                  }}
                >
                  {fileKind === "pdf" ? (
                    <FileIcon
                      className="w-4 h-4"
                      style={{ color: "var(--success)" }}
                    />
                  ) : (
                    <FileTextIcon
                      className="w-4 h-4"
                      style={{ color: "var(--accent-light)" }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12px] font-medium truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[10px] font-bold px-1.5 py-px rounded uppercase tracking-wide"
                      style={{
                        background:
                          fileKind === "pdf"
                            ? "var(--success-bg)"
                            : "var(--accent-soft)",
                        color:
                          fileKind === "pdf"
                            ? "var(--success)"
                            : "var(--accent-light)",
                      }}
                    >
                      {fileKind}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {fileKind === "pdf" && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-px rounded"
                        style={{
                          background:
                            "color-mix(in srgb, var(--warning) 10%, transparent)",
                          color: "var(--warning)",
                          border:
                            "1px solid color-mix(in srgb, var(--warning) 15%, transparent)",
                        }}
                      >
                        will be converted
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetFile}
                  disabled={processing}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-70 active:scale-90 disabled:opacity-30"
                  style={{ color: "var(--text-muted)" }}
                  title="Remove file"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* PDF conversion notice */}
          {fileKind === "pdf" && file && !processing && (
            <div
              className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl"
              style={{
                background: "var(--warning-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--warning) 15%, transparent)",
              }}
            >
              <AlertCircleIcon
                className="w-3.5 h-3.5 shrink-0 mt-0.5"
                style={{ color: "var(--warning)" }}
              />
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--warning)" }}
              >
                <span className="font-semibold">Conversion note:</span> Complex
                layouts, tables, or image-heavy PDFs may need manual adjustments
                after conversion. Plain-text PDFs convert best.
              </p>
            </div>
          )}

          {/* Name input */}
          {file && (
            <div
              className={`space-y-1.5 transition-opacity duration-200 ${
                processing ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <label
                className="text-[11px] font-semibold flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                Paper name <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value.trim()) setNameError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canUpload) handleUpload();
                }}
                disabled={processing}
                placeholder="Enter paper name"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none disabled:opacity-50 transition-colors min-h-[44px]"
                style={{
                  background: "var(--bg-muted)",
                  border: `1px solid ${
                    nameError
                      ? "color-mix(in srgb, var(--danger) 60%, transparent)"
                      : "var(--border-subtle)"
                  }`,
                  color: "var(--text)",
                }}
                onFocus={(e) => {
                  if (!nameError)
                    e.currentTarget.style.border =
                      "1px solid var(--accent-border)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = `1px solid ${
                    nameError
                      ? "color-mix(in srgb, var(--danger) 60%, transparent)"
                      : "var(--border-subtle)"
                  }`;
                }}
              />
              {nameError && (
                <div className="flex items-center gap-1.5">
                  <AlertCircleIcon
                    className="w-3 h-3 shrink-0"
                    style={{ color: "var(--danger)" }}
                  />
                  <p className="text-[11px]" style={{ color: "var(--danger)" }}>
                    {nameError}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Upload button */}
          {file && (
            <div className="space-y-3 pb-1">
              <button
                type="button"
                onClick={handleUpload}
                disabled={!canUpload}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed min-h-[48px]"
                style={{
                  background: canUpload
                    ? "var(--accent-strong-bg)"
                    : "var(--accent-soft)",
                  color: canUpload ? "var(--accent-pale)" : "var(--text-dim)",
                  border: `1.5px solid ${
                    canUpload
                      ? "var(--accent-border)"
                      : "color-mix(in srgb, var(--accent-light) 10%, transparent)"
                  }`,
                }}
              >
                {processing ? (
                  <>
                    <Loader2Icon
                      className="w-4 h-4 animate-spin shrink-0"
                      style={{ color: "var(--accent-light)" }}
                    />
                    <span className="truncate">
                      {UPLOAD_STAGE_LABELS[stage] || "Processing…"}
                    </span>
                  </>
                ) : !name.trim() ? (
                  "Enter a paper name to continue"
                ) : (
                  <>
                    <UploadCloudIcon className="w-4 h-4 shrink-0" />
                    Upload &amp; open
                  </>
                )}
              </button>

              {/* Progress stage pills */}
              {processing && stage && (
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  {activeStages.map((s, i) => {
                    const currentIdx = activeStages.indexOf(stage);
                    const isDone = currentIdx > i;
                    const isActive = stage === s;
                    return (
                      <div key={s} className="flex items-center gap-1">
                        <div
                          className="flex items-center gap-1.5 px-2 py-1 rounded-full transition-all duration-300"
                          style={{
                            background: isDone
                              ? "var(--success-bg)"
                              : isActive
                                ? "var(--accent-soft)"
                                : "transparent",
                            opacity: isDone ? 0.5 : isActive ? 1 : 0.25,
                          }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                              background: isDone
                                ? "var(--success)"
                                : isActive
                                  ? "var(--accent-light)"
                                  : "var(--border-hover)",
                            }}
                          />
                          <span
                            className="text-[10px] font-medium whitespace-nowrap"
                            style={{
                              color: isDone
                                ? "var(--success)"
                                : isActive
                                  ? "var(--accent-light)"
                                  : "var(--text-dim)",
                            }}
                          >
                            {UPLOAD_STAGE_LABELS[s].replace("…", "")}
                          </span>
                        </div>
                        {i < activeStages.length - 1 && (
                          <ChevronRightIcon
                            className="w-2.5 h-2.5 shrink-0"
                            style={{ color: "var(--bg-input)" }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Hint text */}
              {!processing && fileKind === "docx" && (
                <p
                  className="text-[10px] text-center"
                  style={{ color: "var(--text-dim)" }}
                >
                  Your .docx will be stored as-is and opened in the editor
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk add-to-collection dialog — adds ALL selected docs at once
// ─────────────────────────────────────────────────────────────────────────────

function BulkAddToCollectionDialog({
  open,
  onOpenChange,
  documentIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentIds: Id<"documents">[];
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const collections = useQuery(
    api.collections.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const addDocument = useMutation(api.collections.addDocument);
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  // Reset when dialog re-opens
  useEffect(() => {
    if (open) setDone(new Set());
  }, [open]);

  const handleAdd = async (collectionId: Id<"collections">) => {
    setLoading(collectionId);
    try {
      const results = await Promise.allSettled(
        documentIds.map((docId) =>
          addDocument({ collectionId, documentId: docId })
        )
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      // "already in collection" errors are not real failures
      const realFailed = results.filter(
        (r) =>
          r.status === "rejected" &&
          !String((r as PromiseRejectedResult).reason?.message).includes(
            "already in"
          )
      ).length;
      setDone((prev) => new Set([...prev, collectionId]));
      if (realFailed > 0) {
        toast.warning(`Added ${succeeded} — ${realFailed} failed.`);
      } else {
        toast.success(
          `Added ${succeeded} paper${succeeded !== 1 ? "s" : ""} to collection`
        );
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't add.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to collection</DialogTitle>
        </DialogHeader>
        <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>
          {documentIds.length} paper{documentIds.length !== 1 ? "s" : ""}{" "}
          selected
        </p>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {collections === undefined ? (
            <div className="flex justify-center py-8">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--accent-light)" }}
              />
            </div>
          ) : collections.length === 0 ? (
            <p
              className="text-[12px] text-center py-8"
              style={{ color: "var(--text-dim)" }}
            >
              No collections yet.
            </p>
          ) : (
            (
              collections as (Doc<"collections"> & { documentCount?: number })[]
            ).map((col) => {
              const isDone = done.has(col._id);
              const isLoading = loading === col._id;
              return (
                <button
                  key={col._id}
                  onClick={() => !isDone && handleAdd(col._id)}
                  disabled={isDone || !!loading}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{
                    background: isDone
                      ? `${col.color ?? "var(--primary)"}12`
                      : "var(--bg-muted)",
                    border: `1px solid ${isDone ? `${col.color ?? "var(--primary)"}30` : "var(--border-subtle)"}`,
                    minHeight: 48,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: `${col.color ?? "var(--primary)"}18` }}
                  >
                    {(() => {
                      const Icon = getIconComponent(col.icon ?? "folder");
                      return (
                        <Icon
                          className="w-3 h-3"
                          style={{ color: col.color ?? "#6366f1" }}
                        />
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-medium truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {col.name}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {col.documentCount ?? 0} papers
                    </p>
                  </div>
                  {isLoading ? (
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                      style={{ borderColor: "var(--accent-light)" }}
                    />
                  ) : isDone ? (
                    <CheckIcon
                      className="w-4 h-4 shrink-0"
                      style={{ color: col.color ?? "var(--accent-light)" }}
                    />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single add-to-collection dialog
// ─────────────────────────────────────────────────────────────────────────────

function AddToCollectionDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: Id<"documents">;
  documentTitle: string;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const collections = useQuery(
    api.collections.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const addDocument = useMutation(api.collections.addDocument);
  const docCollections = useQuery(api.documents.getCollectionsForDocument, {
    documentId,
  });
  const [loading, setLoading] = useState<string | null>(null);
  const existingIds = new Set(
    (docCollections ?? []).map((c) => (c as Doc<"collections">)._id)
  );

  const handleAdd = async (collectionId: Id<"collections">) => {
    setLoading(collectionId);
    try {
      await addDocument({ collectionId, documentId });
      toast.success("Added to collection");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't add.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to collection</DialogTitle>
        </DialogHeader>
        <p
          className="text-[12px] mb-3 truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {documentTitle}
        </p>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {collections === undefined ? (
            <div className="flex justify-center py-8">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--accent-light)" }}
              />
            </div>
          ) : collections.length === 0 ? (
            <p
              className="text-[12px] text-center py-8"
              style={{ color: "var(--text-dim)" }}
            >
              No collections yet.
            </p>
          ) : (
            (
              collections as (Doc<"collections"> & { documentCount?: number })[]
            ).map((col) => {
              const isIn = existingIds.has(col._id);
              const isLoading = loading === col._id;
              return (
                <button
                  key={col._id}
                  onClick={() => !isIn && handleAdd(col._id)}
                  disabled={isIn || !!loading}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{
                    background: isIn
                      ? `${col.color ?? "var(--primary)"}12`
                      : "var(--bg-muted)",
                    border: `1px solid ${isIn ? `${col.color ?? "var(--primary)"}30` : "var(--border-subtle)"}`,
                    minHeight: 48,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: `${col.color ?? "var(--primary)"}18` }}
                  >
                    {(() => {
                      const Icon = getIconComponent(col.icon ?? "folder");
                      return (
                        <Icon
                          className="w-3 h-3"
                          style={{ color: col.color ?? "#6366f1" }}
                        />
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-medium truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {col.name}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {col.documentCount ?? 0} papers
                    </p>
                  </div>
                  {isLoading ? (
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                      style={{ borderColor: "var(--accent-light)" }}
                    />
                  ) : isIn ? (
                    <CheckIcon
                      className="w-4 h-4 shrink-0"
                      style={{ color: col.color ?? "var(--accent-light)" }}
                    />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rename dialog
// ─────────────────────────────────────────────────────────────────────────────

function RenameDialog({
  open,
  onOpenChange,
  documentId,
  currentTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: Id<"documents">;
  currentTitle: string;
}) {
  const updateDocument = useMutation(api.documents.update);
  const [value, setValue] = useState(currentTitle);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(currentTitle);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, currentTitle]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === currentTitle) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await updateDocument({ id: documentId, title: trimmed });
      toast.success("Renamed");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't rename.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename paper</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") onOpenChange(false);
            }}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--accent-border)`,
              color: "var(--text)",
            }}
            placeholder="Paper name"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{
                color: "var(--text-muted)",
                background: "var(--bg-muted)",
                border: `1px solid var(--border-subtle)`,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-light)",
                border: `1px solid var(--accent-border)`,
                opacity: !value.trim() ? 0.5 : 1,
              }}
            >
              {saving ? "Saving…" : "Rename"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk delete confirm
// ─────────────────────────────────────────────────────────────────────────────

function BulkDeleteDialog({
  open,
  count,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} paper{count !== 1 ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes {count} paper{count !== 1 ? "s" : ""}. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete {count} paper{count !== 1 ? "s" : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collections panel
// ─────────────────────────────────────────────────────────────────────────────

function CollectionsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const collections = useQuery(
    api.collections.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const inner = (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid var(--border-subtle)` }}
      >
        <div className="flex items-center gap-2">
          <FolderIcon
            className="w-3.5 h-3.5"
            style={{ color: "var(--accent-light)" }}
          />
          <span
            className="text-[13px] font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Collections
          </span>
          {collections && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-md"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-dim)",
              }}
            >
              {collections.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ color: "var(--text-dim)", background: "var(--bg-muted)" }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {collections === undefined ? (
          <div className="space-y-1.5 px-3 py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-11 rounded-xl animate-pulse"
                style={{ background: "var(--bg-muted)" }}
              />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <FolderIcon
              className="w-7 h-7 mb-2"
              style={{ color: "var(--text-dim)" }}
            />
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              No collections yet
            </p>
            <button
              onClick={() => router.push("/collections")}
              className="mt-2 text-[11px] font-medium"
              style={{ color: "var(--accent-light)" }}
            >
              Create one →
            </button>
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {(
              collections as (Doc<"collections"> & { documentCount?: number })[]
            ).map((col) => {
              const accentColor = col.color ?? "var(--primary)";
              return (
                <div key={col._id}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => router.push(`/collections/${col._id}`)}
                      className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
                      style={{ minHeight: 44 }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg-muted)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: accentColor }}
                      />
                      <span className="text-sm shrink-0">
                        {(() => {
                          const Icon = getIconComponent(col.icon ?? "folder");
                          return (
                            <Icon
                              className="w-3 h-3"
                              style={{ color: col.color ?? "#6366f1" }}
                            />
                          );
                        })()}
                      </span>
                      <span
                        className="flex-1 text-[12px] font-medium truncate"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {col.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0"
                        style={{
                          background: "var(--bg-input)",
                          color: "var(--text-dim)",
                        }}
                      >
                        {col.documentCount ?? 0}
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        setExpandedId(expandedId === col._id ? null : col._id)
                      }
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ color: "var(--text-dim)" }}
                    >
                      <ChevronRightIcon
                        className="w-3 h-3 transition-transform duration-150"
                        style={{
                          transform:
                            expandedId === col._id ? "rotate(90deg)" : "none",
                        }}
                      />
                    </button>
                  </div>
                  {expandedId === col._id && (
                    <CollectionExpandedDocs
                      collectionId={col._id}
                      accentColor={accentColor}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderTop: `1px solid var(--border-subtle)` }}
      >
        <button
          onClick={() => router.push("/collections")}
          className="w-full text-[12px] font-medium py-2.5 rounded-xl text-center transition-colors"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          Manage collections →
        </button>
      </div>
    </>
  );

  return (
    <>
      <div
        className="hidden md:flex shrink-0 flex-col transition-all duration-200 overflow-hidden"
        style={{
          width: open ? 268 : 0,
          borderLeft: open ? `1px solid var(--border-subtle)` : "none",
          background: "var(--bg-sidebar)",
        }}
      >
        {open && inner}
      </div>
      <div
        className="md:hidden fixed inset-0 z-[60] transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl flex flex-col"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-hover)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
          maxHeight: "80vh",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            className="w-9 h-1 rounded-full"
            style={{ background: "var(--bg-input)" }}
          />
        </div>
        {inner}
      </div>
    </>
  );
}

function CollectionExpandedDocs({
  collectionId,
  accentColor,
}: {
  collectionId: Id<"collections">;
  accentColor: string;
}) {
  const router = useRouter();
  const docs = useQuery(api.collections.getDocuments, { collectionId });
  if (docs === undefined)
    return (
      <div className="ml-6 px-3 py-2">
        <div
          className="h-7 rounded-lg animate-pulse"
          style={{ background: "var(--bg-muted)" }}
        />
      </div>
    );
  if (docs.length === 0)
    return (
      <p
        className="ml-6 text-[11px] px-3 py-1.5"
        style={{ color: "var(--text-dim)" }}
      >
        Empty collection
      </p>
    );
  return (
    <div className="ml-6 space-y-0.5 mb-1">
      {docs.slice(0, 5).map((doc) => (
        <button
          key={doc._id}
          onClick={() => router.push(`/documents/${doc._id}`)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left"
          style={{ minHeight: 36 }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg-muted)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <span className="text-sm shrink-0">
            {" "}
            <FileTextIcon
              className="w-4 h-4"
              style={{ color: "var(--text-muted)" }}
            />
          </span>
          <span
            className="flex-1 text-[11px] font-medium truncate"
            style={{ color: "var(--text-muted)" }}
          >
            {doc.title}
          </span>
        </button>
      ))}
      {docs.length > 5 && (
        <p
          className="px-3 py-1 text-[10px]"
          style={{ color: "var(--text-dim)" }}
        >
          +{docs.length - 5} more
        </p>
      )}
      <button
        onClick={() => router.push(`/collections/${collectionId}`)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium"
        style={{ color: "var(--text-dim)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
      >
        <FolderOpenIcon className="w-3 h-3" /> Open collection →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function SelectCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="rounded-md flex items-center justify-center shrink-0 transition-all"
      style={{
        width: 16,
        height: 16,
        background:
          checked || indeterminate ? "var(--primary)" : "var(--bg-input)",
        border: `1.5px solid ${checked || indeterminate ? "var(--primary)" : "var(--border-hover)"}`,
      }}
    >
      {indeterminate ? (
        <MinusIcon style={{ width: 9, height: 9, color: "var(--text)" }} />
      ) : checked ? (
        <CheckIcon style={{ width: 9, height: 9, color: "var(--text)" }} />
      ) : null}
    </button>
  );
}

function AIDot({ status }: { status?: string }) {
  if (status === "done")
    return (
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: "var(--accent-light)" }}
        title="AI summary ready"
      />
    );
  if (status === "pending")
    return (
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
        style={{ background: "var(--warning)" }}
        title="Generating…"
      />
    );
  return null;
}

function CollectionBadges({
  collections,
  maxVisible = 2,
}: {
  collections: Doc<"collections">[];
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? collections : collections.slice(0, maxVisible);
  const overflow = collections.length - maxVisible;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((col) => (
        <span
          key={col._id}
          className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-md text-[10px] font-medium whitespace-nowrap"
          style={{
            background: col.color ? `${col.color}18` : "var(--bg-input)",
            color: col.color ?? "var(--text-muted)",
            border: `1px solid ${col.color ? `${col.color}28` : "var(--border-subtle)"}`,
          }}
        >
          {(() => {
            const Icon = getIconComponent(col.icon ?? "folder");
            return (
              <Icon
                className="w-3 h-3"
                style={{ color: col.color ?? "#6366f1" }}
              />
            );
          })()}{" "}
          {col.name}
        </span>
      ))}
      {!expanded && overflow > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="text-[10px] px-1.5 py-px rounded-md font-medium transition-colors"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-dim)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          +{overflow}
        </button>
      )}
    </div>
  );
}

function PaperMenu({
  document,
  onAddToCollection,
  onRename,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
  onExport,
}: {
  document: Doc<"documents">;
  onAddToCollection: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onExport: (fmt: "docx" | "pdf") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
          style={{
            background: "var(--bg-input)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          <MoreHorizontalIcon
            className="w-3.5 h-3.5"
            style={{ color: "var(--text-muted)" }}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            window.open(`/documents/${document._id}`, "_blank");
          }}
        >
          <ExternalLinkIcon className="w-3.5 h-3.5 mr-2" />
          Open in new tab
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <CopyIcon className="w-3.5 h-3.5 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
        >
          <PencilIcon className="w-3.5 h-3.5 mr-2" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onAddToCollection();
          }}
        >
          <FolderPlusIcon className="w-3.5 h-3.5 mr-2" />
          Add to collection
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onExport("docx");
          }}
        >
          <DownloadIcon className="w-3.5 h-3.5 mr-2" />
          Export as .docx
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onExport("pdf");
          }}
        >
          <FileTextIcon className="w-3.5 h-3.5 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {document.isArchived ? (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
          >
            <ArchiveRestoreIcon className="w-3.5 h-3.5 mr-2" />
            Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
          >
            <ArchiveIcon className="w-3.5 h-3.5 mr-2" />
            Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2Icon className="w-3.5 h-3.5 mr-2 text-destructive" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid card — callbacks from parent (no internal mutations)
// ─────────────────────────────────────────────────────────────────────────────

function GridCard({
  document,
  selected,
  selectMode,
  onSelect,
  onAddToCollection,
  onRename,
  onArchive,
  onRestore,
  onDelete,
  onDuplicate,
}: {
  document: Doc<"documents">;
  selected: boolean;
  selectMode: boolean;
  onSelect: (id: string, shift: boolean) => void;
  onAddToCollection: (id: Id<"documents">, title: string) => void;
  onRename: (id: Id<"documents">, title: string) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const router = useRouter();
  const { organization } = useOrganization();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);
  const collections = useQuery(api.documents.getCollectionsForDocument, {
    documentId: document._id,
  });
  const orgLabel = document.organizationId
    ? organization?.id === document.organizationId
      ? organization.name
      : "Shared"
    : null;
  const cols = (collections ?? []) as Doc<"collections">[];

  const handleClick = (e: React.MouseEvent) => {
    if (selectMode) {
      onSelect(document._id, e.shiftKey);
      return;
    }
    router.push(`/documents/${document._id}`);
  };

  return (
    <>
      <div
        className="rounded-2xl flex flex-col cursor-pointer transition-all duration-200 h-full overflow-hidden"
        style={{
          background: selected
            ? "rgba(99,102,241,0.09)"
            : hovered
              ? "var(--bg-card-hover)"
              : "var(--bg-card)",
          border: `1px solid ${selected ? "var(--accent-border)" : hovered ? "var(--border-hover)" : "var(--border-subtle)"}`,
          boxShadow: selected
            ? `0 0 0 2px var(--primary)28`
            : hovered
              ? shadows.cardHover
              : "none",
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="p-3.5 flex flex-col gap-2.5 flex-1">
          <div className="flex items-start gap-2.5">
            {selectMode && (
              <div
                className="mt-0.5 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(document._id, e.shiftKey);
                }}
              >
                <SelectCheckbox
                  checked={selected}
                  onChange={() => onSelect(document._id, false)}
                />
              </div>
            )}
            <div
              className="text-base shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ background: "var(--bg-input)" }}
            >
              <FileTextIcon
                className="w-4 h-4"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-semibold leading-snug line-clamp-2"
                style={{ color: "var(--text)" }}
              >
                {document.title}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {smartDate(document._creationTime)}
                </span>
                <AIDot status={document.aiSummaryStatus} />
                {document.isArchived && (
                  <span
                    className="text-[9px] font-semibold px-1.5 py-px rounded"
                    style={{
                      background: "var(--warning-bg)",
                      color: "var(--warning)",
                    }}
                  >
                    ARCHIVED
                  </span>
                )}
                {orgLabel && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-px rounded"
                    style={{
                      background: "var(--accent-bg)",
                      color: "var(--accent-light)",
                    }}
                  >
                    <UsersIcon style={{ width: 9, height: 9 }} />
                    {orgLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <PaperMenu
                document={document}
                onAddToCollection={() =>
                  onAddToCollection(document._id, document.title)
                }
                onRename={() => onRename(document._id, document.title)}
                onDuplicate={onDuplicate}
                onArchive={onArchive}
                onRestore={onRestore}
                onDelete={() => setConfirmDelete(true)}
                onExport={(fmt) => handleExportDoc(document, fmt)}
              />
            </div>
          </div>

          <div className="flex items-start gap-1.5 flex-1 min-h-[36px]">
            <SparklesIcon
              className="w-2.5 h-2.5 shrink-0 mt-0.5"
              style={{
                color:
                  document.aiSummaryStatus === "done"
                    ? "var(--accent-light)"
                    : "var(--border-hover)",
              }}
            />
            {document.aiSummaryStatus === "done" && document.aiSummary ? (
              <p
                className="text-[11px] leading-relaxed line-clamp-3"
                style={{ color: "var(--text-muted)" }}
              >
                {document.aiSummary}
              </p>
            ) : document.aiSummaryStatus === "pending" ? (
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin shrink-0"
                  style={{ color: "var(--accent-light)" }}
                />
                <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                  Generating summary…
                </p>
              </div>
            ) : (
              <p
                className="text-[11px] italic"
                style={{ color: "var(--text-placeholder)" }}
              >
                No summary yet
              </p>
            )}
          </div>

          {cols.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <CollectionBadges collections={cols} maxVisible={2} />
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete paper?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{document.title}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List row — callbacks from parent (no internal mutations)
// ─────────────────────────────────────────────────────────────────────────────

function ListRow({
  document,
  selected,
  selectMode,
  onSelect,
  onAddToCollection,
  onRename,
  onArchive,
  onRestore,
  onDelete,
  onDuplicate,
}: {
  document: Doc<"documents">;
  selected: boolean;
  selectMode: boolean;
  onSelect: (id: string, shift: boolean) => void;
  onAddToCollection: (id: Id<"documents">, title: string) => void;
  onRename: (id: Id<"documents">, title: string) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const router = useRouter();
  const { organization } = useOrganization();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);
  const collections = useQuery(api.documents.getCollectionsForDocument, {
    documentId: document._id,
  });
  const cols = (collections ?? []) as Doc<"collections">[];
  const orgLabel = document.organizationId
    ? organization?.id === document.organizationId
      ? organization.name
      : "Shared"
    : null;

  const handleClick = (e: React.MouseEvent) => {
    if (selectMode) {
      onSelect(document._id, e.shiftKey);
      return;
    }
    router.push(`/documents/${document._id}`);
  };

  return (
    <>
      <div
        className="flex items-start gap-3 px-4 sm:px-5 py-3 cursor-pointer transition-all duration-150 group"
        style={{
          borderBottom: `1px solid var(--border-subtle)`,
          background: selected
            ? "rgba(99,102,241,0.06)"
            : hovered
              ? "var(--bg-muted)"
              : "transparent",
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {selectMode && (
          <div
            className="mt-1 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(document._id, e.shiftKey);
            }}
          >
            <SelectCheckbox
              checked={selected}
              onChange={() => onSelect(document._id, false)}
            />
          </div>
        )}

        <span
          className="text-base w-8 h-8 flex items-center justify-center rounded-lg shrink-0 mt-0.5"
          style={{ background: "var(--bg-input)" }}
        >
          <FileTextIcon
            className="w-4 h-4"
            style={{ color: "var(--text-muted)" }}
          />
        </span>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--text)" }}
            >
              {document.title}
            </p>
            {document.isArchived && (
              <span
                className="text-[9px] font-semibold px-1.5 py-px rounded shrink-0"
                style={{
                  background: "var(--warning-bg)",
                  color: "var(--warning)",
                }}
              >
                ARCHIVED
              </span>
            )}
            {orgLabel && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-px rounded shrink-0"
                style={{
                  background: "var(--accent-bg)",
                  color: "var(--accent-light)",
                }}
              >
                <UsersIcon style={{ width: 9, height: 9 }} />
                {orgLabel}
              </span>
            )}
          </div>

          <div className="flex items-start gap-1.5">
            <SparklesIcon
              className="w-2.5 h-2.5 shrink-0 mt-px"
              style={{
                color:
                  document.aiSummaryStatus === "done"
                    ? "var(--accent-light)"
                    : "var(--border-subtle)",
              }}
            />
            {document.aiSummaryStatus === "done" && document.aiSummary ? (
              <p
                className="text-[11px] leading-relaxed line-clamp-2"
                style={{ color: "var(--text-muted)" }}
              >
                {document.aiSummary}
              </p>
            ) : document.aiSummaryStatus === "pending" ? (
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin shrink-0"
                  style={{ color: "var(--accent-light)" }}
                />
                <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                  Generating summary…
                </p>
              </div>
            ) : (
              <p
                className="text-[11px] italic"
                style={{ color: "var(--text-dim)" }}
              >
                No summary yet
              </p>
            )}
          </div>

          <div
            className="flex items-center gap-2 pt-0.5 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            {cols.length > 0 && (
              <CollectionBadges collections={cols} maxVisible={2} />
            )}
            <span
              className="text-[11px] ml-auto shrink-0 tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              {smartDate(document._creationTime)}
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-1 shrink-0 mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onAddToCollection(document._id, document.title)}
            className="hidden sm:flex w-7 h-7 rounded-lg items-center justify-center transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-input)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            title="Add to collection"
          >
            <FolderPlusIcon className="w-3.5 h-3.5" />
          </button>
          <PaperMenu
            document={document}
            onAddToCollection={() =>
              onAddToCollection(document._id, document.title)
            }
            onRename={() => onRename(document._id, document.title)}
            onDuplicate={onDuplicate}
            onArchive={onArchive}
            onRestore={onRestore}
            onDelete={() => setConfirmDelete(true)}
            onExport={(fmt) => handleExportDoc(document, fmt)}
          />
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete paper?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{document.title}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk action floating bar — smart archive vs restore
// ─────────────────────────────────────────────────────────────────────────────

function BulkBar({
  count,
  total,
  allArchived,
  onArchive,
  onRestore,
  onDelete,
  onClear,
  onAddToCollection,
  onSelectAll,
  onExportZip,
}: {
  count: number;
  total: number;
  allArchived: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onClear: () => void;
  onAddToCollection: () => void;
  onSelectAll: () => void;
  onExportZip: (fmt: "docx" | "pdf") => void;
}) {
  return (
    <div
      className="fixed bottom-[calc(52px+env(safe-area-inset-bottom)+10px)] md:bottom-8 left-1/2 z-50 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-2xl overflow-x-auto"
      style={{
        transform: "translateX(-50%)",
        maxWidth: "calc(100vw - 2rem)",
        scrollbarWidth: "none",
        background: "var(--bg-card)",
        border: "1px solid rgba(99,102,241,0.3)",
        boxShadow:
          "0 8px 40px rgba(0,0,0,0.03), 0 0 0 1px rgba(99,102,241,0.1)",
        backdropFilter: "blur(16px)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        className="text-[12px] font-semibold tabular-nums"
        style={{ color: "var(--accent-pale)" }}
      >
        {count} selected
      </span>
      {count < total && (
        <button
          onClick={onSelectAll}
          className="text-[11px] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Select all {total}
        </button>
      )}
      <div
        className="w-px h-4 mx-0.3"
        style={{ background: "var(--bg-input)" }}
      />

      <button
        onClick={onAddToCollection}
        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
        style={{
          background: "var(--bg-input)",
          color: "var(--text-secondary)",
        }}
      >
        <FolderPlusIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Collection</span>
      </button>

      {/* Export ZIP */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
            style={{
              background: "rgba(52,211,153,0.08)",
              color: "var(--success, #34d399)",
              border: "1px solid rgba(52,211,153,0.2)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(52,211,153,0.14)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(52,211,153,0.08)")
            }
          >
            <PackageIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export ZIP</span>
            <ChevronDownIcon className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-44 mb-1">
          <DropdownMenuItem onClick={() => onExportZip("docx")}>
            <DownloadIcon className="w-3.5 h-3.5 mr-2" />
            ZIP of .docx files
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportZip("pdf")}>
            <FileTextIcon className="w-3.5 h-3.5 mr-2" />
            ZIP of PDF files
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Smart archive / restore button */}
      {allArchived ? (
        <button
          onClick={onRestore}
          className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
          style={{
            background: "rgba(99,102,241,0.08)",
            color: "var(--accent-light)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(99,102,241,0.14)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(99,102,241,0.08)")
          }
        >
          <ArchiveRestoreIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Restore</span>
        </button>
      ) : (
        <button
          onClick={onArchive}
          className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
          style={{
            background: "rgba(251,191,36,0.08)",
            color: "var(--warning)",
            border: "1px solid rgba(251,191,36,0.2)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(251,191,36,0.14)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(251,191,36,0.08)")
          }
        >
          <ArchiveIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Archive</span>
        </button>
      )}

      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
        style={{
          background: "rgba(248,113,113,0.08)",
          color: "var(--danger)",
          border: "1px solid rgba(248,113,113,0.2)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(248,113,113,0.14)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "rgba(248,113,113,0.08)")
        }
      >
        <Trash2Icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Delete</span>
      </button>

      <button
        onClick={onClear}
        className="w-6 h-6 rounded-lg flex items-center justify-center ml-0.5"
        style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination bar
// ─────────────────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = useMemo(() => {
    const arr: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) arr.push(i);
      return arr;
    }
    if (page <= 4) {
      arr.push(1, 2, 3, 4, 5, "…", totalPages);
    } else if (page >= totalPages - 3) {
      arr.push(
        1,
        "…",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      );
    } else {
      arr.push(1, "…", page - 1, page, page + 1, "…", totalPages);
    }
    return arr;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div
      className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0"
      style={{ borderTop: `1px solid var(--border-subtle)` }}
    >
      <span
        className="text-[11px] tabular-nums"
        style={{ color: "var(--text-dim)" }}
      >
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors"
          style={{
            background: "var(--bg-muted)",
            color: page === 1 ? "var(--text-dim)" : "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
            opacity: page === 1 ? 0.4 : 1,
          }}
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              className="text-[11px] px-1"
              style={{ color: "var(--text-dim)" }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className="h-7 min-w-[28px] px-2 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background:
                  p === page ? "rgba(99,102,241,0.2)" : "var(--bg-muted)",
                color: p === page ? "var(--accent-light)" : "var(--text-muted)",
                border: `1px solid ${p === page ? "var(--accent-border)" : "var(--border-subtle)"}`,
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors"
          style={{
            background: "var(--bg-muted)",
            color:
              page === totalPages ? "var(--text-dim)" : "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
            opacity: page === totalPages ? 0.4 : 1,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: "var(--bg-card)",
        border: `1px solid var(--border-subtle)`,
      }}
    >
      <div className="h-0.5 w-full" style={{ background: "var(--bg-input)" }} />
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg shrink-0"
            style={{ background: "var(--bg-input)" }}
          />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3.5 rounded-md w-3/4"
              style={{ background: "var(--bg-input)" }}
            />
            <div
              className="h-2.5 rounded-md w-1/3"
              style={{ background: "var(--bg-muted)" }}
            />
          </div>
          <div
            className="w-7 h-7 rounded-lg shrink-0"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
        <div className="space-y-1.5">
          <div
            className="h-2.5 rounded w-full"
            style={{ background: "var(--bg-muted)" }}
          />
          <div
            className="h-2.5 rounded w-4/5"
            style={{ background: "var(--bg-muted)" }}
          />
          <div
            className="h-2.5 rounded w-2/3"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
        <div className="flex gap-1.5">
          <div
            className="h-4 w-16 rounded-md"
            style={{ background: "var(--bg-muted)" }}
          />
          <div
            className="h-4 w-12 rounded-md"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div
      className="flex items-start gap-3 px-4 sm:px-5 py-3 animate-pulse"
      style={{ borderBottom: `1px solid var(--border-subtle)` }}
    >
      <div
        className="w-8 h-8 rounded-lg shrink-0 mt-0.5"
        style={{ background: "var(--bg-input)" }}
      />
      <div className="flex-1 space-y-2">
        <div
          className="h-3.5 rounded w-1/2"
          style={{ background: "var(--bg-input)" }}
        />
        <div
          className="h-2.5 rounded w-3/4"
          style={{ background: "var(--bg-muted)" }}
        />
        <div className="flex gap-1.5">
          <div
            className="h-4 w-14 rounded-md"
            style={{ background: "var(--bg-muted)" }}
          />
          <div
            className="h-4 w-10 rounded-md"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
      </div>
      <div
        className="w-7 h-7 rounded-lg shrink-0"
        style={{ background: "var(--bg-muted)" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type Filter = "all" | "mine" | "org";
type SortKey = "newest" | "oldest" | "name_asc" | "name_desc";
type ViewMode = "grid" | "list";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name_asc: "A → Z",
  name_desc: "Z → A",
};

export default function DocumentsPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { isLoaded, isSignedIn } = useAuth();

  const { resolvedTheme } = useTheme();

  const toastActionStyle: React.CSSProperties = {
    background: "var(--accent-bg)",
    color: "var(--accent-light)",
    border: "1px solid var(--accent-border)",
    borderRadius: "8px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createDocument = useMutation(api.documents.create);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const updateDocument = useMutation(api.documents.update);
  const archiveMutation = useMutation(api.documents.archive);
  const restoreMutation = useMutation(api.documents.restore);
  const removeMutation = useMutation(api.documents.remove);
  const duplicateMutation = useMutation(api.documents.duplicate);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [renameDialog, setRenameDialog] = useState<{
    id: Id<"documents">;
    title: string;
  } | null>(null);
  const [addColDialog, setAddColDialog] = useState<{
    id: Id<"documents">;
    title: string;
  } | null>(null);
  const [bulkAddColDialog, setBulkAddColDialog] = useState<{
    ids: Id<"documents">[];
  } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [collectionsPanelOpen, setCollectionsPanelOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false); // ← NEW
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("list");
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // Optimistic removal — items hidden immediately before Convex reacts
  const [pendingRemoval, setPendingRemoval] = useState<Set<string>>(new Set());

  const lastSelectedIdx = useRef<number>(-1);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const skip = !(isLoaded && isSignedIn);
  const allDocs = useQuery(
    api.documents.getAll,
    skip ? "skip" : { includeArchived: false }
  );
  const archivedDocs = useQuery(api.documents.getArchived, skip ? "skip" : {});

  // ── Derived data ───────────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    const base = [
      ...(allDocs ?? []),
      ...(showArchived ? (archivedDocs ?? []) : []),
    ];
    const seen = new Set<string>();
    const deduped = base.filter((d) => {
      if (seen.has(d._id)) return false;
      seen.add(d._id);
      return true;
    });
    const q = debouncedSearch.trim().toLowerCase();
    let filtered = q
      ? deduped.filter((d) => d.title.toLowerCase().includes(q))
      : deduped;
    if (filter === "mine") filtered = filtered.filter((d) => !d.organizationId);
    else if (filter === "org" && organization)
      filtered = filtered.filter((d) => d.organizationId === organization.id);
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "newest":
          return b._creationTime - a._creationTime;
        case "oldest":
          return a._creationTime - b._creationTime;
        case "name_asc":
          return a.title.localeCompare(b.title);
        case "name_desc":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });
  }, [
    allDocs,
    archivedDocs,
    showArchived,
    debouncedSearch,
    filter,
    sort,
    organization,
  ]);

  // Exclude optimistically-removed items
  const visibleDocs = useMemo(
    () => filteredDocs.filter((d) => !pendingRemoval.has(d._id)),
    [filteredDocs, pendingRemoval]
  );

  useEffect(() => {
    if (!allDocs || !archivedDocs) return;
    const allIds = new Set([
      ...allDocs.map((d) => d._id),
      ...archivedDocs.map((d) => d._id),
    ]);
    setPendingRemoval((prev) => {
      const next = new Set(prev);
      for (const id of prev) {
        if (!allIds.has(id as Id<"documents">)) {
          next.delete(id);
        }
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [allDocs, archivedDocs]);

  const totalPages = Math.max(1, Math.ceil(visibleDocs.length / PAGE_SIZE));
  const displayDocs = visibleDocs.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  // For smart bulk archive/restore button
  const selectedDocs = useMemo(
    () => filteredDocs.filter((d) => selected.has(d._id)),
    [filteredDocs, selected]
  );
  const allSelectedAreArchived =
    selectedDocs.length > 0 && selectedDocs.every((d) => d.isArchived);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, sort, showArchived]);
  useEffect(() => {
    setSelected(new Set());
  }, [page, debouncedSearch, filter, sort]);
  useEffect(() => {
    if (selected.size === 0 && selectMode) setSelectMode(false);
  }, [selected.size]);

  const isLoading =
    allDocs === undefined || (showArchived && archivedDocs === undefined);
  const totalDocs = allDocs?.length ?? 0;
  const archivedCount = archivedDocs?.length ?? 0;
  const sharedCount = allDocs?.filter((d) => d.organizationId).length ?? 0;

  // ── Centralised single-doc handlers with optimistic UI + undo ──────────────

  const handleArchiveDoc = useCallback(
    async (id: Id<"documents">) => {
      if (!showArchived) {
        setPendingRemoval((prev) => new Set([...prev, id]));
      }
      try {
        await archiveMutation({ id });
        setPendingRemoval((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast("Archived", {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await restoreMutation({ id });
                toast.success("Restored");
              } catch {
                toast.error("Couldn't restore.");
              }
            },
          },
          actionButtonStyle: toastActionStyle,
          duration: 5000,
        });
      } catch {
        setPendingRemoval((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.error("Couldn't archive.");
      }
    },
    [archiveMutation, restoreMutation, showArchived, toastActionStyle]
  );

  const handleRestoreDoc = useCallback(
    async (id: Id<"documents">) => {
      try {
        await restoreMutation({ id });
        toast("Restored", {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await archiveMutation({ id });
                toast.success("Archived");
              } catch {
                toast.error("Couldn't archive.");
              }
            },
          },
          actionButtonStyle: toastActionStyle,
          duration: 5000,
        });
      } catch {
        toast.error("Couldn't restore.");
      }
    },
    [restoreMutation, archiveMutation, toastActionStyle]
  );

  const handleDeleteDoc = useCallback(
    async (id: Id<"documents">) => {
      setPendingRemoval((prev) => new Set([...prev, id]));
      try {
        await removeMutation({ id });
        toast.success("Deleted");
      } catch (err: any) {
        setPendingRemoval((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
        toast.error(err?.data ?? "Couldn't delete.");
      }
    },
    [removeMutation]
  );

  const handleDuplicateDoc = useCallback(
    async (id: Id<"documents">) => {
      try {
        const newId = await duplicateMutation({ id });
        toast.success("Duplicated");
        router.push(`/documents/${newId}`);
      } catch {
        toast.error("Couldn't duplicate.");
      }
    },
    [duplicateMutation, router]
  );

  // ── Select helpers ─────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (id: string, shift: boolean) => {
      if (!selectMode) setSelectMode(true);
      const idx = displayDocs.findIndex((d) => d._id === id);
      setSelected((prev) => {
        const next = new Set(prev);
        if (shift && lastSelectedIdx.current >= 0) {
          const lo = Math.min(idx, lastSelectedIdx.current);
          const hi = Math.max(idx, lastSelectedIdx.current);
          for (let i = lo; i <= hi; i++) next.add(displayDocs[i]._id);
        } else {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return next;
      });
      lastSelectedIdx.current = idx;
    },
    [displayDocs, selectMode]
  );

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(filteredDocs.map((d) => d._id)));
  }, [filteredDocs]);

  const someSelected = selected.size > 0;
  const allPageSelected =
    displayDocs.length > 0 && displayDocs.every((d) => selected.has(d._id));
  const somePageSelected =
    displayDocs.some((d) => selected.has(d._id)) && !allPageSelected;

  // ── Bulk handlers with undo ────────────────────────────────────────────────

  const handleBulkArchive = async () => {
    const ids = Array.from(selected) as Id<"documents">[];
    if (!showArchived) {
      setPendingRemoval((prev) => new Set([...prev, ...ids]));
    }

    const results = await Promise.allSettled(
      ids.map((id) => archiveMutation({ id }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = ids.length - failed;

    setPendingRemoval((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

    setSelected(new Set());
    setSelectMode(false);

    if (failed > 0) {
      toast.error(`${failed} papers couldn't be archived.`);
    } else {
      toast(`${succeeded} paper${succeeded !== 1 ? "s" : ""} archived`, {
        action: {
          label: "Undo",
          onClick: async () => {
            setPendingRemoval((prev) => {
              const s = new Set(prev);
              ids.forEach((id) => s.delete(id));
              return s;
            });
            await Promise.allSettled(ids.map((id) => restoreMutation({ id })));
            toast.success(
              `${succeeded} paper${succeeded !== 1 ? "s" : ""} restored`
            );
          },
        },
        actionButtonStyle: toastActionStyle,
        duration: 5000,
      });
    }
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selected) as Id<"documents">[];
    const results = await Promise.allSettled(
      ids.map((id) => restoreMutation({ id }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = ids.length - failed;

    setSelected(new Set());
    setSelectMode(false);

    if (failed > 0) {
      toast.error(`${failed} papers couldn't be restored.`);
    } else {
      toast(`${succeeded} paper${succeeded !== 1 ? "s" : ""} restored`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await Promise.allSettled(ids.map((id) => archiveMutation({ id })));
            toast.success(
              `${succeeded} paper${succeeded !== 1 ? "s" : ""} archived`
            );
          },
        },
        actionButtonStyle: toastActionStyle,
        duration: 5000,
      });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected) as Id<"documents">[];
    setPendingRemoval((prev) => new Set([...prev, ...ids]));
    const results = await Promise.allSettled(
      ids.map((id) => removeMutation({ id }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(`${failed} papers couldn't be deleted.`);
    } else {
      toast.success(`${ids.length} papers deleted`);
    }
    setSelected(new Set());
    setSelectMode(false);
    setBulkDeleteOpen(false);
  };

  // ── Bulk ZIP export ────────────────────────────────────────────────────────
  const handleBulkExportZip = async (fmt: "docx" | "pdf") => {
    const ids = Array.from(selected);
    const docs = filteredDocs.filter((d) => ids.includes(d._id));
    const toastId = toast.loading(
      `Preparing ${fmt.toUpperCase()} ZIP for ${docs.length} paper${docs.length !== 1 ? "s" : ""}…`
    );
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const safeName = (title: string) =>
        title.replace(/[/\\?%*:|"<>]/g, "-").trim() || "document";
      const usedNames = new Map<string, number>();
      const getUniqueName = (base: string, ext: string) => {
        const key = `${base}.${ext}`;
        const count = usedNames.get(key) ?? 0;
        usedNames.set(key, count + 1);
        return count === 0 ? `${base}.${ext}` : `${base} (${count}).${ext}`;
      };
      const results = await Promise.allSettled(
        docs.map(async (doc) => {
          if (!doc.fileUrl) throw new Error(`No file for "${doc.title}"`);
          if (fmt === "docx") {
            const res = await fetch(doc.fileUrl);
            if (!res.ok) throw new Error(`Failed to fetch "${doc.title}"`);
            zip.file(
              getUniqueName(safeName(doc.title), "docx"),
              await res.blob()
            );
          } else {
            const res = await fetch("/api/onlyoffice-convert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileUrl: doc.fileUrl,
                fileName: doc.title,
              }),
            });
            if (!res.ok)
              throw new Error(`PDF conversion failed for "${doc.title}"`);
            zip.file(
              getUniqueName(safeName(doc.title), "pdf"),
              await res.blob()
            );
          }
        })
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = docs.length - failed;
      if (succeeded === 0) {
        toast.dismiss(toastId);
        toast.error("All exports failed. Nothing to download.");
        return;
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = globalThis.document.createElement("a");
      a.href = url;
      a.download = `papers-export-${fmt}-${new Date().toISOString().slice(0, 10)}.zip`;
      globalThis.document.body.appendChild(a);
      a.click();
      globalThis.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.dismiss(toastId);
      if (failed > 0) {
        toast.warning(
          `ZIP downloaded with ${succeeded} file${succeeded !== 1 ? "s" : ""} — ${failed} failed.`
        );
      } else {
        toast.success(
          `ZIP with ${succeeded} ${fmt.toUpperCase()} file${succeeded !== 1 ? "s" : ""} downloaded`
        );
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("ZIP export failed.");
      console.error("[bulk-export-zip]", err);
    }
  };

  // ── New paper ──────────────────────────────────────────────────────────────
  const handleNewPaper = async () => {
    setIsCreating(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      zip.file(
        "[Content_Types].xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
      );
      zip.file(
        "_rels/.rels",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
      );
      zip.file(
        "word/document.xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t></w:t></w:r></w:p><w:sectPr/></w:body></w:document>`
      );
      zip.file(
        "word/_rels/document.xml.rels",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
      );
      const blob = await zip.generateAsync({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        body: blob,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();
      const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
      const docId = await createDocument({
        title: "Untitled paper",
        organizationId: organization?.id,
        storageId,
      });
      await updateDocument({
        id: docId,
        fileUrl: `${convexSiteUrl}/getFile?storageId=${storageId}`,
      });
      router.push(`/documents/${docId}`);
      toast.success("Paper created");
    } catch {
      toast.error("Couldn't create paper.");
    } finally {
      setIsCreating(false);
    }
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const orgFilterLabel = organization?.name ?? "Org";
  const hasActiveFilters = !!(
    debouncedSearch ||
    filter !== "all" ||
    showArchived
  );

  // ── Empty state copy per context ───────────────────────────────────────────
  const emptyTitle = debouncedSearch
    ? "No papers found"
    : filter === "mine"
      ? "No personal papers yet"
      : filter === "org"
        ? `No ${orgFilterLabel} papers yet`
        : showArchived
          ? "No archived papers"
          : "No papers yet";
  const emptyBody = debouncedSearch
    ? `No results for "${debouncedSearch}".`
    : showArchived
      ? "Papers you archive will appear here."
      : "Create a new paper or upload an existing document.";

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between shrink-0 px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5"
        style={{ borderBottom: `1px solid var(--border-subtle)` }}
      >
        <div>
          <h1
            className="text-[15px] sm:text-base font-semibold"
            style={{ color: "var(--text)" }}
          >
            Papers
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap"
              style={{ color: "var(--text-muted)" }}
            >
              <span>
                {totalDocs} {totalDocs === 1 ? "paper" : "papers"}
              </span>
              {sharedCount > 0 && (
                <>
                  <span style={{ color: "var(--text-dim)" }}>·</span>
                  <span style={{ color: "var(--accent-light)" }}>
                    {sharedCount} shared
                  </span>
                </>
              )}
              {showArchived && archivedCount > 0 && (
                <>
                  <span style={{ color: "var(--text-dim)" }}>·</span>
                  <span style={{ color: "var(--warning)" }}>
                    {archivedCount} archived shown
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Upload button */}
          <button
            onClick={() => setUploadDialogOpen(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium px-3 sm:px-4 py-2 rounded-xl transition-all duration-150"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-muted)",
              border: `1px solid var(--border-subtle)`,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-card)";
              e.currentTarget.style.borderColor = "var(--border-hover)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-muted)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <UploadCloudIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* New paper button */}
          <button
            onClick={handleNewPaper}
            disabled={isCreating}
            className="flex items-center gap-1.5 text-[13px] font-medium px-3 sm:px-4 py-2 rounded-xl transition-all duration-150"
            style={{
              background: "var(--accent-bg)",
              color: "var(--accent-pale)",
              border: `1px solid var(--accent-border)`,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isCreating) {
                e.currentTarget.style.background = "var(--accent-bg-hover)";
                e.currentTarget.style.boxShadow = shadows.glow;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent-bg)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {isCreating ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <PlusIcon className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isCreating ? "Creating…" : "New paper"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div
        className="shrink-0"
        style={{
          borderBottom: `1px solid var(--border-subtle)`,
          background: "var(--bg-muted)",
        }}
      >
        {/* Row 1: search + view + select */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5">
          <div className="relative flex-1 max-w-md">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "var(--text-dim)" }}
            />
            <input
              placeholder="Search papers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-14 text-[13px] rounded-xl outline-none"
              style={{
                background: "var(--bg-muted)",
                border: `1px solid var(--border-subtle)`,
                color: "var(--text)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = `1px solid var(--accent-border)`)
              }
              onBlur={(e) =>
                (e.currentTarget.style.border = `1px solid var(--border-subtle)`)
              }
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-dim)" }}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl shrink-0"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            {[
              { v: "list" as ViewMode, Icon: ListIcon, t: "List" },
              { v: "grid" as ViewMode, Icon: LayoutGridIcon, t: "Grid" },
            ].map(({ v, Icon, t }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={t}
                className="p-1.5 rounded-lg transition-all"
                style={{
                  background:
                    view === v ? "rgba(99,102,241,0.2)" : "transparent",
                  color: view === v ? "var(--accent-light)" : "var(--text-dim)",
                }}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Select mode toggle */}
          <button
            onClick={() => {
              setSelectMode((v) => {
                if (v) setSelected(new Set());
                return !v;
              });
            }}
            className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl text-[11px] font-medium transition-all shrink-0"
            style={{
              background: selectMode ? "var(--accent-bg)" : "var(--bg-muted)",
              border: `1px solid ${selectMode ? "var(--accent-border)" : "var(--border-subtle)"}`,
              color: selectMode ? "var(--accent-light)" : "var(--text-muted)",
            }}
            title="Select mode"
          >
            <CheckSquareIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Select</span>
          </button>
        </div>

        {/* Row 2: filters */}
        <div
          className="flex items-center gap-2 px-4 sm:px-6 pb-2.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl shrink-0"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            {(
              ["all", "mine", ...(organization ? ["org"] : [])] as Filter[]
            ).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap"
                style={{
                  background:
                    filter === f ? "rgba(99,102,241,0.2)" : "transparent",
                  color:
                    filter === f ? "var(--accent-light)" : "var(--text-muted)",
                }}
              >
                {f === "all" ? "All" : f === "mine" ? "Mine" : orgFilterLabel}
              </button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-medium shrink-0 whitespace-nowrap"
                style={{
                  background: "var(--bg-muted)",
                  border: `1px solid var(--border-subtle)`,
                  color: "var(--text-muted)",
                }}
              >
                {SORT_LABELS[sort]}
                <ChevronDownIcon className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <DropdownMenuItem key={key} onClick={() => setSort(key)}>
                  {sort === key && (
                    <CheckIcon
                      className="w-3 h-3 mr-2"
                      style={{ color: "var(--accent-light)" }}
                    />
                  )}
                  {SORT_LABELS[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-medium shrink-0 whitespace-nowrap transition-all"
            style={{
              background: showArchived
                ? "var(--warning-bg)"
                : "var(--bg-muted)",
              border: `1px solid ${showArchived ? "rgba(251,191,36,0.25)" : "var(--border-subtle)"}`,
              color: showArchived ? "var(--warning)" : "var(--text-muted)",
            }}
          >
            <ArchiveIcon className="w-3.5 h-3.5" />
            Archived
            {archivedCount > 0 && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{
                  background: showArchived
                    ? "rgba(251,191,36,0.2)"
                    : "var(--bg-input)",
                  color: showArchived ? "var(--warning)" : "var(--text-dim)",
                }}
              >
                {archivedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCollectionsPanelOpen((v) => !v)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-medium shrink-0 whitespace-nowrap transition-all"
            style={{
              background: collectionsPanelOpen
                ? "var(--accent-bg)"
                : "var(--bg-muted)",
              border: `1px solid ${collectionsPanelOpen ? "var(--accent-border)" : "var(--border-subtle)"}`,
              color: collectionsPanelOpen
                ? "var(--accent-light)"
                : "var(--text-muted)",
            }}
          >
            <FolderIcon className="w-3.5 h-3.5" />
            Collections
          </button>
        </div>
      </div>

      {/* ── Active filter strip ── */}
      {hasActiveFilters && !isLoading && (
        <div
          className="flex items-center gap-2 px-4 sm:px-6 py-2 shrink-0 flex-wrap"
          style={{
            borderBottom: `1px solid var(--border-subtle)`,
            background: "var(--bg-muted)",
          }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            {visibleDocs.length} result{visibleDocs.length !== 1 ? "s" : ""}
          </span>
          {debouncedSearch && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-muted)",
              }}
            >
              &ldquo;{debouncedSearch}&rdquo;
              <button onClick={() => setSearch("")}>
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filter !== "all" && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-light)",
              }}
            >
              {filter === "mine" ? "Mine only" : orgFilterLabel}
              <button onClick={() => setFilter("all")}>
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearch("");
              setFilter("all");
              setShowArchived(false);
            }}
            className="text-[11px] ml-auto"
            style={{ color: "var(--text-dim)" }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Select mode header ── */}
      {selectMode && !someSelected && (
        <div
          className="flex items-center gap-3 px-4 sm:px-5 py-2 shrink-0"
          style={{
            background: "var(--bg-sidebar)",
            borderBottom: `1px solid var(--border-subtle)`,
          }}
        >
          <SelectCheckbox
            checked={allPageSelected}
            indeterminate={somePageSelected}
            onChange={(v) => {
              if (v) setSelected(new Set(displayDocs.map((d) => d._id)));
              else setSelected(new Set());
            }}
          />
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            Click papers to select
          </span>
          <button
            onClick={() => {
              setSelectMode(false);
              setSelected(new Set());
            }}
            className="ml-auto text-[11px]"
            style={{ color: "var(--text-dim)" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={contentRef} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1">
            {isLoading ? (
              view === "grid" ? (
                <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <GridSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <div className="pt-1">
                  {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <ListSkeleton key={i} />
                  ))}
                </div>
              )
            ) : displayDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "var(--bg-muted)" }}
                >
                  {showArchived ? (
                    <ArchiveIcon
                      className="w-6 h-6"
                      style={{ color: "var(--text-dim)" }}
                    />
                  ) : (
                    <FileIcon
                      className="w-6 h-6"
                      style={{ color: "var(--text-dim)" }}
                    />
                  )}
                </div>
                <p
                  className="text-[14px] font-semibold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {emptyTitle}
                </p>
                <p
                  className="text-[12px] mb-6 max-w-[260px] leading-relaxed"
                  style={{ color: "var(--text-dim)" }}
                >
                  {emptyBody}
                </p>
                {!debouncedSearch && !showArchived && (
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <button
                      onClick={() => setUploadDialogOpen(true)}
                      className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-xl"
                      style={{
                        background: "var(--bg-muted)",
                        color: "var(--text-muted)",
                        border: `1px solid var(--border-subtle)`,
                      }}
                    >
                      <UploadCloudIcon className="w-3.5 h-3.5" />
                      Upload
                    </button>
                    <button
                      onClick={handleNewPaper}
                      disabled={isCreating}
                      className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-xl"
                      style={{
                        background: "var(--accent-bg)",
                        color: "var(--accent-pale)",
                        border: `1px solid var(--accent-border)`,
                      }}
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      New paper
                    </button>
                  </div>
                )}
              </div>
            ) : view === "grid" ? (
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                {displayDocs.map((doc) => (
                  <GridCard
                    key={doc._id}
                    document={doc}
                    selected={selected.has(doc._id)}
                    selectMode={selectMode}
                    onSelect={handleSelect}
                    onAddToCollection={(id, title) =>
                      setAddColDialog({ id, title })
                    }
                    onRename={(id, title) => setRenameDialog({ id, title })}
                    onArchive={() => handleArchiveDoc(doc._id)}
                    onRestore={() => handleRestoreDoc(doc._id)}
                    onDelete={() => handleDeleteDoc(doc._id)}
                    onDuplicate={() => handleDuplicateDoc(doc._id)}
                  />
                ))}
              </div>
            ) : (
              <div className="pb-2">
                {displayDocs.map((doc) => (
                  <ListRow
                    key={doc._id}
                    document={doc}
                    selected={selected.has(doc._id)}
                    selectMode={selectMode}
                    onSelect={handleSelect}
                    onAddToCollection={(id, title) =>
                      setAddColDialog({ id, title })
                    }
                    onRename={(id, title) => setRenameDialog({ id, title })}
                    onArchive={() => handleArchiveDoc(doc._id)}
                    onRestore={() => handleRestoreDoc(doc._id)}
                    onDelete={() => handleDeleteDoc(doc._id)}
                    onDuplicate={() => handleDuplicateDoc(doc._id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && visibleDocs.length > PAGE_SIZE && (
            <div className="pb-[calc(env(safe-area-inset-bottom)+52px)] md:pb-0">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={visibleDocs.length}
                pageSize={PAGE_SIZE}
                onChange={handlePageChange}
              />
            </div>
          )}
        </div>

        <CollectionsPanel
          open={collectionsPanelOpen}
          onClose={() => setCollectionsPanelOpen(false)}
        />
      </div>

      {/* Bulk bar */}
      {someSelected && (
        <BulkBar
          count={selected.size}
          total={visibleDocs.length}
          allArchived={allSelectedAreArchived}
          onArchive={handleBulkArchive}
          onRestore={handleBulkRestore}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={() => {
            setSelected(new Set());
            setSelectMode(false);
          }}
          onSelectAll={handleSelectAll}
          onAddToCollection={() => {
            setBulkAddColDialog({
              ids: Array.from(selected) as Id<"documents">[],
            });
          }}
          onExportZip={handleBulkExportZip}
        />
      )}

      {/* ── Dialogs ── */}
      <UploadDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
      {addColDialog && (
        <AddToCollectionDialog
          open={!!addColDialog}
          onOpenChange={(v) => !v && setAddColDialog(null)}
          documentId={addColDialog.id}
          documentTitle={addColDialog.title}
        />
      )}
      {bulkAddColDialog && (
        <BulkAddToCollectionDialog
          open={!!bulkAddColDialog}
          onOpenChange={(v) => !v && setBulkAddColDialog(null)}
          documentIds={bulkAddColDialog.ids}
        />
      )}
      {renameDialog && (
        <RenameDialog
          open={!!renameDialog}
          onOpenChange={(v) => !v && setRenameDialog(null)}
          documentId={renameDialog.id}
          currentTitle={renameDialog.title}
        />
      )}
      <BulkDeleteDialog
        open={bulkDeleteOpen}
        count={selected.size}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}
