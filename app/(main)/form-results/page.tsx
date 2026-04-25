// app/(main)/form-results/page.tsx
"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  Fragment,
} from "react";
import {
  DownloadIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Trash2Icon,
  ArchiveIcon,
  FilterIcon,
  XIcon,
  MinusIcon,
  CheckIcon,
  CheckSquareIcon,
  EyeIcon,
  CalendarIcon,
  MoreVerticalIcon,
  PauseIcon,
  PlayIcon,
  FileTextIcon,
  PackageIcon,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createPortal } from "react-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

type SubmissionStatus = "all" | "generated" | "pending" | "error";

interface Submission {
  _id: string;
  filename: string;
  status: string;
  submittedAt: number;
  connectionId: string;
  respondentEmail?: string;
  fieldValues?: Record<string, string>;
  fileUrl?: string;
  errorMessage?: string;
  storageId?: string;
  ownerId: string;
}

interface Connection {
  _id: string;
  formTitle: string;
  templateId: string;
  isActive: boolean;
  googleFormId?: string;
  spreadsheetId?: string;
  templateName?: string;
  fieldMappings: any[];
  lastPolledAt?: number;
  _creationTime: number;
}

interface OverflowMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

// ── Export helpers ────────────────────────────────────────────────────────────

async function exportSubmission(submission: Submission, fmt: "docx" | "pdf") {
  if (!submission.fileUrl) {
    toast.error("No file available for this submission.");
    return;
  }
  if (fmt === "docx") {
    const toastId = toast.loading("Preparing download…");
    try {
      const res = await fetch(submission.fileUrl);
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${submission.filename}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
        body: JSON.stringify({
          fileUrl: submission.fileUrl,
          fileName: submission.filename,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${submission.filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.dismiss(toastId);
      toast.success("PDF downloaded");
    } catch {
      toast.dismiss(toastId);
      toast.error("PDF export failed. Check OnlyOffice setup.");
    }
  }
}

// ── Bottom Sheet / Overflow Menu ─────────────────────────────────────────────

function BottomSheet({
  open,
  onClose,
  items,
  title,
}: {
  open: boolean;
  onClose: () => void;
  items: OverflowMenuItem[];
  title?: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:justify-end sm:p-4"
      style={{
        background: "var(--overlay-backdrop)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full sm:w-56 rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--popover)",
          border: `1px solid var(--border-subtle)`,
          boxShadow: "var(--shadow-flyout)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            className="px-4 pt-4 pb-2"
            style={{ borderBottom: `1px solid var(--border-subtle)` }}
          >
            <p
              className="text-xs font-semibold truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {title}
            </p>
          </div>
        )}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div
            className="w-8 h-1 rounded-full"
            style={{ background: "var(--bg-input)" }}
          />
        </div>
        <div className="py-2">
          {items
            .filter((item) => !item.hidden)
            .map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                disabled={item.disabled}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left"
                style={{
                  color: item.danger ? "var(--danger)" : "var(--text)",
                  opacity: item.disabled ? 0.4 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled)
                    e.currentTarget.style.background = item.danger
                      ? "var(--danger-bg)"
                      : "var(--accent-soft)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  className="w-4 h-4 shrink-0"
                  style={{
                    color: item.danger ? "var(--danger)" : "var(--text-muted)",
                  }}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
        </div>
        <div
          className="sm:hidden px-4 py-3"
          style={{ borderTop: `1px solid var(--border-subtle)` }}
        >
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "generated")
    return (
      <CheckCircleIcon
        className="w-4 h-4 shrink-0"
        style={{ color: "var(--success)" }}
      />
    );
  if (status === "error")
    return (
      <XCircleIcon
        className="w-4 h-4 shrink-0"
        style={{ color: "var(--danger)" }}
      />
    );
  return (
    <ClockIcon
      className="w-4 h-4 shrink-0"
      style={{ color: "var(--warning)" }}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = (
    {
      generated: {
        bg: "var(--success-bg)",
        color: "var(--success)",
        label: "Done",
      },
      error: {
        bg: "var(--danger-bg)",
        color: "var(--danger)",
        label: "Failed",
      },
      pending: {
        bg: "var(--warning-bg)",
        color: "var(--warning)",
        label: "Processing",
      },
    } as Record<string, { bg: string; color: string; label: string }>
  )[status] ?? {
    bg: "var(--bg-input)",
    color: "var(--text-dim)",
    label: status,
  };

  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

// ── SelectCheckbox ────────────────────────────────────────────────────────────

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
        width: 18,
        height: 18,
        background:
          checked || indeterminate ? "var(--primary)" : "var(--bg-input)",
        border: `1.5px solid ${
          checked || indeterminate ? "var(--primary)" : "var(--border-hover)"
        }`,
      }}
    >
      {indeterminate ? (
        <MinusIcon
          style={{ width: 10, height: 10, color: "var(--primary-foreground)" }}
        />
      ) : checked ? (
        <CheckIcon
          style={{ width: 10, height: 10, color: "var(--primary-foreground)" }}
        />
      ) : null}
    </button>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  fileUrl,
  filename,
  onClose,
}: {
  fileUrl: string;
  filename: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setState("loading");
    setPdfBlobUrl(null);

    let revoked = false;

    async function convertToPdf() {
      try {
        const res = await fetch("/api/onlyoffice-convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl, fileName: filename }),
        });
        if (!res.ok) throw new Error(`Convert failed: ${res.status}`);
        const blob = await res.blob();
        if (revoked) return;
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setState("ready");
      } catch (err) {
        console.error("[PreviewModal] PDF conversion error:", err);
        if (!revoked) setState("error");
      }
    }

    convertToPdf();

    return () => {
      revoked = true;
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [fileUrl, filename]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = async () => {
    const res = await fetch(fileUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInTab = () => {
    if (!pdfBlobUrl) return;
    window.open(pdfBlobUrl, "_blank");
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{
        background: "var(--overlay-backdrop)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="flex flex-col w-full max-w-5xl rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-card)",
          border: `1px solid var(--border-subtle)`,
          boxShadow: "var(--shadow-elevated)",
          maxHeight: "95vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: `1px solid var(--border-subtle)` }}
        >
          <EyeIcon
            className="w-4 h-4 shrink-0"
            style={{ color: "var(--accent-light)" }}
          />
          <p
            className="flex-1 text-sm font-medium truncate"
            style={{ color: "var(--text)" }}
            title={`${filename}.docx`}
          >
            {filename}.docx
          </p>

          {pdfBlobUrl && (
            <button
              onClick={handleOpenInTab}
              aria-label="Open PDF in new tab"
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: `1px solid var(--border-subtle)`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-input)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--bg-muted)")
              }
            >
              <ExternalLinkIcon className="w-3 h-3" />
              <span className="hidden sm:inline">Open PDF</span>
            </button>
          )}

          <button
            onClick={handleDownload}
            aria-label="Download document"
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: "var(--success-bg)",
              color: "var(--success)",
              border: `1px solid color-mix(in srgb, var(--success) 20%, transparent)`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "color-mix(in srgb, var(--success) 12%, transparent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--success-bg)")
            }
          >
            <DownloadIcon className="w-3 h-3" />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            onClick={onClose}
            aria-label="Close preview"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-dim)")
            }
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 relative" style={{ minHeight: "60vh" }}>
          {state === "loading" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
              style={{ background: "var(--bg-card)" }}
            >
              <div
                className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--accent-light)" }}
              />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Converting document…
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center z-10">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{
                  background: "var(--bg-muted)",
                  border: `1px solid var(--border-subtle)`,
                }}
              >
                <FileTextIcon
                  className="w-4 h-4"
                  style={{ color: "var(--text-muted)" }}
                />{" "}
              </div>
              <div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--text)" }}
                >
                  Preview not available
                </p>
                <p
                  className="text-xs max-w-xs leading-relaxed"
                  style={{ color: "var(--text-dim)" }}
                >
                  Conversion failed. Download the file to view it locally.
                </p>
              </div>
            </div>
          )}

          {pdfBlobUrl && (
            <iframe
              key={pdfBlobUrl}
              src={pdfBlobUrl}
              title={`Preview: ${filename}`}
              className="w-full h-full border-0"
              style={{ minHeight: "60vh" }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{
          background: "var(--bg-muted)",
          border: `1px solid var(--border-subtle)`,
        }}
      >
        📭
      </div>
      <div>
        <p
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {title}
        </p>
        <p
          className="text-xs max-w-xs mx-auto leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          {description}
        </p>
      </div>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] flex items-center transition-all duration-150"
            style={{
              background: "var(--accent-bg)",
              color: "var(--accent-pale)",
              border: `1px solid var(--accent-border)`,
            }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
            style={{
              background: "var(--accent-bg)",
              color: "var(--accent-pale)",
              border: `1px solid var(--accent-border)`,
            }}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

// ── Submission Row ────────────────────────────────────────────────────────────

function SubmissionRow({
  submission,
  selected,
  selectMode,
  onSelect,
  onRetry,
  onDelete,
  onPreview,
  isBeingPreviewed,
}: {
  submission: Submission;
  selected: boolean;
  selectMode: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onRetry: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPreview: (submission: Submission) => void;
  isBeingPreviewed: boolean;
}) {
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry(submission._id);
    } finally {
      setRetrying(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await onDelete(submission._id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (selectMode) {
      e.stopPropagation();
      onSelect(submission._id, !selected);
    }
  };

  const isGenerated = submission.status === "generated" && !!submission.fileUrl;

  return (
    <>
      <div style={{ borderBottom: `1px solid var(--border-subtle)` }}>
        <div
          className="flex items-start gap-3 px-4 sm:px-5 py-3.5 transition-colors cursor-pointer"
          style={{
            background: selected
              ? "var(--nav-active-bg)"
              : hovered
                ? "var(--bg-muted)"
                : "transparent",
          }}
          onClick={handleRowClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {selectMode && (
            <div
              className="mt-0.5 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(submission._id, !selected);
              }}
            >
              <SelectCheckbox
                checked={selected}
                onChange={(v) => onSelect(submission._id, v)}
              />
            </div>
          )}

          <div className="mt-0.5 shrink-0">
            <StatusIcon status={submission.status} />
          </div>

          <div className="flex-1 min-w-0 space-y-0.5">
            <p
              className="text-sm font-medium leading-snug"
              style={{ color: "var(--text)" }}
              title={`${submission.filename}.docx`}
            >
              <span className="line-clamp-2 sm:line-clamp-1">
                {submission.filename}.docx
              </span>
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {submission.respondentEmail && (
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {submission.respondentEmail}
                </span>
              )}
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--text-dim)" }}
              >
                {format(
                  new Date(submission.submittedAt),
                  "MMM d, yyyy · h:mm a"
                )}
              </span>
            </div>
            {submission.status === "error" && submission.errorMessage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="text-xs flex items-center gap-1 mt-0.5 min-h-[44px]"
                style={{ color: "var(--danger)" }}
              >
                {expanded ? (
                  <ChevronUpIcon className="w-3 h-3" />
                ) : (
                  <ChevronDownIcon className="w-3 h-3" />
                )}
                {expanded ? "Hide error" : "Show error"}
              </button>
            )}
          </div>

          <div className="shrink-0 mt-0.5">
            <StatusBadge status={submission.status} />
          </div>

          {/* Three-dots overflow menu */}
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                className="min-w-[32px] min-h-[32px] rounded-lg flex items-center justify-center shrink-0 transition-colors outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: `1px solid var(--border-subtle)`,
                  color: "var(--text-muted)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-card)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-input)";
                }}
              >
                <MoreVerticalIcon className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {/* Preview */}
                {isGenerated && (
                  <DropdownMenuItem
                    onClick={() => onPreview(submission)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <EyeIcon className="w-3.5 h-3.5" />
                    Preview
                  </DropdownMenuItem>
                )}

                {/* Download .docx */}
                {isGenerated && (
                  <DropdownMenuItem
                    onClick={() => exportSubmission(submission, "docx")}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    Export as .docx
                  </DropdownMenuItem>
                )}

                {/* Export as PDF */}
                {isGenerated && (
                  <DropdownMenuItem
                    onClick={() => exportSubmission(submission, "pdf")}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FileTextIcon className="w-3.5 h-3.5" />
                    Export as PDF
                  </DropdownMenuItem>
                )}

                {/* Separator before retry/delete */}
                {isGenerated && <DropdownMenuSeparator />}

                {/* Retry — only for errors */}
                {submission.status === "error" && (
                  <DropdownMenuItem
                    onClick={handleRetry}
                    disabled={retrying}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCwIcon
                      className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`}
                    />
                    {retrying ? "Retrying…" : "Retry"}
                  </DropdownMenuItem>
                )}

                {/* Delete */}
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting}
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2Icon className="w-3.5 h-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Expanded error */}
        {expanded && submission.errorMessage && (
          <div className="px-4 sm:px-5 pb-3">
            <div
              className="rounded-xl p-3"
              style={{
                background: "var(--danger-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--danger) 15%, transparent)",
              }}
            >
              <p
                className="text-xs font-semibold mb-1"
                style={{ color: "var(--danger)" }}
              >
                Error details
              </p>
              <p
                className="text-xs font-mono break-words leading-relaxed"
                style={{ color: "var(--danger)" }}
              >
                {submission.errorMessage}
              </p>
              {submission.errorMessage?.toLowerCase().includes("token") && (
                <p
                  className="text-xs mt-2 leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  💡 This may be caused by an expired Google token. Try
                  reconnecting your Google account from the template&apos;s
                  Connect Form page.
                </p>
              )}
              {submission.errorMessage?.toLowerCase().includes("template") && (
                <p
                  className="text-xs mt-2 leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  💡 The template file may be missing or corrupt. Check your
                  template in the editor.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete submission?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{submission.filename}.docx&rdquo; will be permanently
              deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirmed}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Connection Group ──────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function ConnectionGroup({
  connection,
  submissions,
  selectedIds,
  selectMode,
  onSelectChange,
  statusFilter,
  searchQuery,
  dateFrom,
  dateTo,
  onRetry,
  onDelete,
  onDeleteConnection,
  onToggleActive,
  onSync,
  onPreview,
  previewingSubmissionId,
  defaultExpanded,
}: {
  connection: Connection;
  submissions: Submission[];
  selectedIds: Set<string>;
  selectMode: boolean;
  onSelectChange: (id: string, checked: boolean) => void;
  statusFilter: SubmissionStatus;
  searchQuery: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  onRetry: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteConnection: (connection: Connection) => void;
  onToggleActive: (connectionId: string, isActive: boolean) => Promise<void>;
  onSync: (connectionId: string) => Promise<void>;
  onPreview: (submission: Submission) => void;
  previewingSubmissionId: string | null;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [syncing, setSyncing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteConn, setConfirmDeleteConn] = useState(false);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !s.filename.toLowerCase().includes(q) &&
          !(s.respondentEmail?.toLowerCase().includes(q) ?? false)
        )
          return false;
      }
      if (dateFrom && s.submittedAt < startOfDay(dateFrom).getTime())
        return false;
      if (dateTo && s.submittedAt > endOfDay(dateTo).getTime()) return false;
      return true;
    });
  }, [submissions, statusFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [statusFilter, searchQuery, dateFrom, dateTo]);

  const displayed = filtered.slice(0, displayLimit);
  const hasMore = filtered.length > displayLimit;

  const counts = useMemo(
    () => ({
      total: submissions.length,
      generated: submissions.filter((s) => s.status === "generated").length,
      error: submissions.filter((s) => s.status === "error").length,
      pending: submissions.filter((s) => s.status === "pending").length,
    }),
    [submissions]
  );

  const allDisplayedSelected =
    displayed.length > 0 && displayed.every((s) => selectedIds.has(s._id));
  const someDisplayedSelected =
    displayed.some((s) => selectedIds.has(s._id)) && !allDisplayedSelected;
  const selectedCount = displayed.filter((s) => selectedIds.has(s._id)).length;

  const handleSelectAll = (v: boolean) => {
    displayed.forEach((s) => onSelectChange(s._id, v));
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync(connection._id);
      toast.success(`"${connection.formTitle}" synced`);
    } catch (err: any) {
      toast.error(err?.message ?? "Sync failed. Check your Google connection.");
    } finally {
      setSyncing(false);
    }
  };

  const connectionMenuItems: OverflowMenuItem[] = [
    {
      icon: <ExternalLinkIcon className="w-4 h-4" />,
      label: "Open Google Form",
      onClick: () => {
        if (connection.googleFormId) {
          window.open(
            `https://docs.google.com/forms/d/${connection.googleFormId}/edit`,
            "_blank"
          );
        } else {
          toast.info("Form link not available for this connection");
        }
      },
      disabled: !connection.googleFormId,
    },
    {
      icon: <FileSpreadsheetIcon className="w-4 h-4" />,
      label: "View Spreadsheet",
      onClick: () => {
        if (connection.spreadsheetId) {
          window.open(
            `https://docs.google.com/spreadsheets/d/${connection.spreadsheetId}/edit`,
            "_blank"
          );
        } else {
          toast.info("Spreadsheet link not available for this connection");
        }
      },
      disabled: !connection.spreadsheetId,
    },
    {
      icon: syncing ? (
        <RefreshCwIcon className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCwIcon className="w-4 h-4" />
      ),
      label: syncing ? "Syncing…" : "Sync Now",
      onClick: handleSync,
      disabled: syncing,
    },
    {
      icon: connection.isActive ? (
        <PauseIcon className="w-4 h-4" />
      ) : (
        <PlayIcon className="w-4 h-4" />
      ),
      label: connection.isActive ? "Pause Connection" : "Resume Connection",
      onClick: () => onToggleActive(connection._id, !connection.isActive),
    },
    {
      icon: expanded ? (
        <ChevronUpIcon className="w-4 h-4" />
      ) : (
        <ChevronDownIcon className="w-4 h-4" />
      ),
      label: expanded ? "Collapse" : "Expand",
      onClick: () => setExpanded((v) => !v),
    },
    {
      icon: <Trash2Icon className="w-4 h-4" />,
      label: "Delete Connection",
      onClick: () => setConfirmDeleteConn(true),
      danger: true,
    },
  ];

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          border: `1px solid var(--border-subtle)`,
          background: "var(--bg-card)",
        }}
      >
        {/* Connection header */}
        <div
          className="w-full flex items-start gap-3 p-4 text-left transition-colors cursor-pointer"
          style={{
            borderBottom: expanded ? `1px solid var(--border-subtle)` : "none",
            background: "transparent",
          }}
          onClick={() => setExpanded((v) => !v)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg-muted)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                {connection.formTitle}
              </p>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: connection.isActive
                    ? "var(--success-bg)"
                    : "var(--bg-input)",
                  color: connection.isActive
                    ? "var(--success)"
                    : "var(--text-dim)",
                }}
              >
                {connection.isActive ? "active" : "paused"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {counts.total} total
              </span>
              <span className="text-xs" style={{ color: "var(--success)" }}>
                {counts.generated} generated
              </span>
              {counts.error > 0 && (
                <span className="text-xs" style={{ color: "var(--danger)" }}>
                  {counts.error} errors
                </span>
              )}
              {counts.pending > 0 && (
                <span className="text-xs" style={{ color: "var(--warning)" }}>
                  {counts.pending} pending
                </span>
              )}
            </div>
          </div>

          {/* Right: menu + chevron */}
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: `1px solid var(--border-subtle)`,
                  color: "var(--text-muted)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-muted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-input)";
                }}
              >
                <MoreVerticalIcon className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {connectionMenuItems.map((item, idx) =>
                  item.hidden ? null : (
                    <DropdownMenuItem
                      key={idx}
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={`flex items-center gap-2 cursor-pointer ${item.danger ? "text-destructive focus:text-destructive" : ""}`}
                    >
                      {item.icon}
                      {item.label}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div
              className="flex items-center justify-center w-7 h-7"
              style={{ color: "var(--text-dim)" }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>

        {/* Submissions list */}
        {expanded && (
          <>
            {filtered.length === 0 ? (
              <div className="px-4 sm:px-5 py-10 text-center">
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                  {submissions.length === 0
                    ? "No responses yet. Submit the form or tap Sync to check for new responses."
                    : "No submissions match the current filters."}
                </p>
              </div>
            ) : (
              <>
                {selectMode && (
                  <div
                    className="flex items-center gap-3 px-4 sm:px-5 py-2.5"
                    style={{
                      borderBottom: `1px solid var(--border-subtle)`,
                      background: "var(--bg-muted)",
                    }}
                  >
                    <SelectCheckbox
                      checked={allDisplayedSelected}
                      indeterminate={someDisplayedSelected}
                      onChange={handleSelectAll}
                    />
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {filtered.length} submission
                      {filtered.length !== 1 ? "s" : ""}
                      {selectedCount > 0 && ` · ${selectedCount} selected`}
                      {hasMore && ` (showing ${displayed.length})`}
                    </span>
                  </div>
                )}

                {displayed.map((s) => (
                  <SubmissionRow
                    key={s._id}
                    submission={s}
                    selected={selectedIds.has(s._id)}
                    selectMode={selectMode}
                    onSelect={onSelectChange}
                    onRetry={onRetry}
                    onDelete={onDelete}
                    onPreview={onPreview}
                    isBeingPreviewed={previewingSubmissionId === s._id}
                  />
                ))}

                {hasMore && (
                  <div
                    className="flex items-center justify-center px-4 py-3"
                    style={{ borderTop: `1px solid var(--border-subtle)` }}
                  >
                    <button
                      onClick={() =>
                        setDisplayLimit((prev) => prev + PAGE_SIZE)
                      }
                      className="text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 min-h-[40px]"
                      style={{
                        background: "var(--bg-muted)",
                        color: "var(--text-muted)",
                        border: `1px solid var(--border-subtle)`,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg-input)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "var(--bg-muted)")
                      }
                    >
                      Load more ({filtered.length - displayLimit} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Delete connection confirmation */}
      <AlertDialog open={confirmDeleteConn} onOpenChange={setConfirmDeleteConn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to &ldquo;{connection.formTitle}
              &rdquo;. Generated documents will NOT be deleted. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDeleteConn(false);
                onDeleteConnection(connection);
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

// ── Floating Bulk Actions ─────────────────────────────────────────────────────

function BulkActions({
  selectedIds,
  submissions,
  total,
  onClear,
  onDelete,
  onSelectAll,
}: {
  selectedIds: Set<string>;
  submissions: Submission[];
  total: number;
  onClear: () => void;
  onDelete: (ids: string[]) => Promise<void>;
  onSelectAll: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const count = selectedIds.size;
  const selectedSubs = submissions.filter((s) => selectedIds.has(s._id));
  const downloadable = selectedSubs.filter(
    (s) => s.status === "generated" && s.fileUrl
  );

  // ── Bulk ZIP export ──────────────────────────────────────────────────────────
  const handleBulkExportZip = async (fmt: "docx" | "pdf") => {
    if (downloadable.length === 0) {
      toast.error("No generated documents selected.");
      return;
    }
    const toastId = toast.loading(
      `Preparing ${fmt.toUpperCase()} ZIP for ${downloadable.length} submission${downloadable.length !== 1 ? "s" : ""}…`
    );
    setDownloading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const safeName = (name: string) =>
        name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "submission";

      const usedNames = new Map<string, number>();
      const getUniqueName = (base: string, ext: string) => {
        const key = `${base}.${ext}`;
        const count = usedNames.get(key) ?? 0;
        usedNames.set(key, count + 1);
        return count === 0 ? `${base}.${ext}` : `${base} (${count}).${ext}`;
      };

      const results = await Promise.allSettled(
        downloadable.map(async (s) => {
          if (fmt === "docx") {
            const res = await fetch(s.fileUrl!);
            if (!res.ok) throw new Error(`Failed to fetch "${s.filename}"`);
            zip.file(
              getUniqueName(safeName(s.filename), "docx"),
              await res.blob()
            );
          } else {
            const res = await fetch("/api/onlyoffice-convert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileUrl: s.fileUrl,
                fileName: s.filename,
              }),
            });
            if (!res.ok)
              throw new Error(`PDF conversion failed for "${s.filename}"`);
            zip.file(
              getUniqueName(safeName(s.filename), "pdf"),
              await res.blob()
            );
          }
        })
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = downloadable.length - failed;

      if (succeeded === 0) {
        toast.dismiss(toastId);
        toast.error("All exports failed. Nothing to download.");
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `form-results-${fmt}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
      console.error("[bulk-export-zip-form-results]", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleBulkDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await onDelete(Array.from(selectedIds));
      onClear();
      toast.success(`${count} submission${count !== 1 ? "s" : ""} deleted`);
    } catch {
      toast.error("Some deletions failed. Please try again.");
    } finally {
      setDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  if (count === 0) return null;

  return (
    <>
      <div
        className="fixed bottom-[calc(52px+env(safe-area-inset-bottom)+10px)] md:bottom-8 left-1/2 z-50 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-2xl overflow-x-auto"
        style={{
          transform: "translateX(-50%)",
          maxWidth: "calc(100vw - 2rem)",
          scrollbarWidth: "none",
          background: "var(--bg-card)",
          border: "1px solid var(--accent-border)",
          boxShadow: "var(--shadow-elevated)",
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
          className="w-px h-4 mx-0.5"
          style={{ background: "var(--border-subtle)" }}
        />

        {/* Export ZIP dropdown — only shown when there are downloadable items */}
        {downloadable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={downloading}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
                style={{
                  background: "rgba(52,211,153,0.08)",
                  color: "var(--success, #34d399)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  opacity: downloading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!downloading)
                    e.currentTarget.style.background = "rgba(52,211,153,0.14)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(52,211,153,0.08)";
                }}
              >
                {downloading ? (
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--success)" }}
                  />
                ) : (
                  <PackageIcon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {downloading ? "Exporting…" : "Export ZIP"}
                </span>
                {!downloading && (
                  <>
                    <span className="text-[10px] opacity-75">
                      ({downloadable.length})
                    </span>
                    <ChevronDownIcon className="w-3 h-3" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              side="top"
              className="w-44 mb-1"
            >
              <DropdownMenuItem
                onClick={() => handleBulkExportZip("docx")}
                className="flex items-center gap-2 cursor-pointer"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                ZIP of .docx files
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBulkExportZip("pdf")}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileTextIcon className="w-3.5 h-3.5" />
                ZIP of PDF files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Delete */}
        <button
          onClick={() => setConfirmBulkDelete(true)}
          disabled={deleting}
          aria-label="Delete selected submissions"
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

        {/* Clear */}
        <button
          onClick={onClear}
          aria-label="Clear selection"
          className="w-6 h-6 rounded-lg flex items-center justify-center ml-0.5"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {count} submission{count !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {count} submission
              {count !== 1 ? "s" : ""} and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDeleteConfirmed}
            >
              Delete {count} submission{count !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function GroupSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: "var(--bg-card)",
        border: `1px solid var(--border-subtle)`,
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className="w-9 h-9 rounded-xl shrink-0"
          style={{ background: "var(--bg-muted)" }}
        />
        <div className="flex-1 space-y-2">
          <div
            className="h-4 rounded w-1/2"
            style={{ background: "var(--bg-input)" }}
          />
          <div
            className="h-3 rounded w-1/3"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FormResultsPage() {
  const { isLoaded, isSignedIn } = useAuth();

  const submissions = useQuery(
    api.formConnections.getAllSubmissions,
    isLoaded && isSignedIn ? {} : "skip"
  ) as Submission[] | undefined;
  const connections = useQuery(
    api.formConnections.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  ) as (Connection & { templateName: string })[] | undefined;

  const retryAction = useAction(api.processFormResponses.retrySubmission);
  const deleteSubmission = useMutation(api.formConnections.deleteSubmission);
  const removeConnection = useMutation(api.formConnections.remove);
  const updateConnection = useMutation(api.formConnections.update);
  const syncAction = useAction(api.processFormResponses.syncConnection);

  // Filters
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFromStr, setDateFromStr] = useState("");
  const [dateToStr, setDateToStr] = useState("");

  const dateFrom = useMemo(
    () => (dateFromStr ? new Date(dateFromStr) : null),
    [dateFromStr]
  );
  const dateTo = useMemo(
    () => (dateToStr ? new Date(dateToStr) : null),
    [dateToStr]
  );

  const hasDateFilter = !!dateFrom || !!dateTo;

  // Preview modal state
  const [previewSubmission, setPreviewSubmission] = useState<Submission | null>(
    null
  );

  // Selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedIds.size === 0 && selectMode) setSelectMode(false);
  }, [selectedIds.size]);

  const handleSelectChange = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!submissions) return;
    setSelectedIds(new Set(submissions.map((s) => s._id)));
  }, [submissions]);

  const handleRetry = useCallback(
    async (id: string) => {
      await retryAction({ submissionId: id as Id<"formSubmissions"> });
      toast.success("Retry started — check back in a moment");
    },
    [retryAction]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSubmission({ id: id as Id<"formSubmissions"> });
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    },
    [deleteSubmission]
  );

  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      await Promise.allSettled(
        ids.map((id) => deleteSubmission({ id: id as Id<"formSubmissions"> }))
      );
    },
    [deleteSubmission]
  );

  const handleSync = useCallback(
    async (connectionId: string) => {
      await syncAction({ connectionId: connectionId as Id<"formConnections"> });
    },
    [syncAction]
  );

  const handleDeleteConnection = useCallback(
    async (connection: Connection) => {
      try {
        await removeConnection({ id: connection._id as Id<"formConnections"> });
        toast.success(`"${connection.formTitle}" connection deleted`);
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to delete connection");
      }
    },
    [removeConnection]
  );

  const handleToggleActive = useCallback(
    async (connectionId: string, isActive: boolean) => {
      try {
        await updateConnection({
          id: connectionId as Id<"formConnections">,
          isActive,
        });
        toast.success(isActive ? "Connection resumed" : "Connection paused");
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to update connection");
      }
    },
    [updateConnection]
  );

  const handlePreview = useCallback((sub: Submission) => {
    setPreviewSubmission(sub);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewSubmission(null);
  }, []);

  // Global counts (unfiltered)
  const globalCounts = useMemo(
    () => ({
      all: submissions?.length ?? 0,
      generated:
        submissions?.filter((s) => s.status === "generated").length ?? 0,
      pending: submissions?.filter((s) => s.status === "pending").length ?? 0,
      error: submissions?.filter((s) => s.status === "error").length ?? 0,
    }),
    [submissions]
  );

  // Determine the "latest" connection ID — by lastPolledAt, fallback to _creationTime
  const latestConnectionId = useMemo(() => {
    if (!connections || connections.length === 0) return null;
    return connections.reduce((best, conn) => {
      const bestTime = best.lastPolledAt ?? best._creationTime;
      const connTime = conn.lastPolledAt ?? conn._creationTime;
      return connTime > bestTime ? conn : best;
    })._id;
  }, [connections]);

  // Group submissions by connection
  const groupedSubmissions = useMemo(() => {
    if (!connections || !submissions) return [];
    return connections.map((conn) => ({
      connection: conn,
      submissions: submissions.filter((s) => s.connectionId === conn._id),
    }));
  }, [connections, submissions]);

  const isLoading = submissions === undefined || connections === undefined;
  const someSelected = selectedIds.size > 0;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setSearchQuery("");
    setDateFromStr("");
    setDateToStr("");
  };

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    (hasDateFilter ? 1 : 0);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5 shrink-0"
        style={{ borderBottom: `1px solid var(--border-subtle)` }}
      >
        <div>
          <h1
            className="text-[15px] sm:text-base font-semibold"
            style={{ color: "var(--text)" }}
          >
            Form results
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap"
              style={{ color: "var(--text-muted)" }}
            >
              <span>
                {globalCounts.all} submission{globalCounts.all !== 1 ? "s" : ""}
              </span>
              {globalCounts.error > 0 && (
                <>
                  <span style={{ color: "var(--text-dim)" }}>·</span>
                  <span style={{ color: "var(--danger)" }}>
                    {globalCounts.error} errors
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Header right: Select (mobile) + Filter toggle (mobile) */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            onClick={() => {
              setSelectMode((v) => {
                if (v) setSelectedIds(new Set());
                return !v;
              });
            }}
            aria-label="Toggle selection mode"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl min-h-[44px] transition-colors"
            style={{
              background: selectMode ? "var(--accent-bg)" : "var(--bg-muted)",
              color: selectMode ? "var(--accent-light)" : "var(--text-muted)",
              border: `1px solid ${selectMode ? "var(--accent-border)" : "var(--border-subtle)"}`,
            }}
          >
            <CheckSquareIcon className="w-3.5 h-3.5" />
            Select
          </button>

          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Toggle filters"
            className="relative flex items-center justify-center w-[44px] h-[44px] rounded-xl transition-colors"
            style={{
              background: showFilters ? "var(--accent-bg)" : "var(--bg-muted)",
              color: showFilters ? "var(--accent-light)" : "var(--text-muted)",
              border: `1px solid ${showFilters ? "var(--accent-border)" : "var(--border-subtle)"}`,
            }}
          >
            <FilterIcon className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="shrink-0"
        style={{
          borderBottom: `1px solid var(--border-subtle)`,
          background: "var(--bg-card)",
        }}
      >
        <div
          className={`${showFilters ? "flex" : "hidden sm:flex"} flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 sm:px-6 py-3`}
        >
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "var(--text-dim)" }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename or email…"
              className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl outline-none transition-colors"
              style={{
                background: "var(--bg-muted)",
                border: `1px solid var(--border-subtle)`,
                color: "var(--text)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent-border)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-subtle)")
              }
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-dim)" }}
                aria-label="Clear search"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            {(["all", "generated", "pending", "error"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all capitalize whitespace-nowrap"
                style={{
                  background:
                    statusFilter === f ? "var(--accent-bg)" : "transparent",
                  color:
                    statusFilter === f
                      ? "var(--accent-light)"
                      : "var(--text-muted)",
                }}
              >
                {f}
                <span className="text-[10px] opacity-75">
                  {globalCounts[f]}
                </span>
              </button>
            ))}
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <CalendarIcon
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: "var(--text-dim)" }}
            />
            <span
              className="text-[11px] shrink-0"
              style={{ color: "var(--text-dim)" }}
            >
              From
            </span>
            <input
              type="date"
              value={dateFromStr}
              onChange={(e) => setDateFromStr(e.target.value)}
              aria-label="From date"
              className="h-9 px-2 text-[12px] rounded-xl outline-none transition-colors"
              style={{
                background: "var(--bg-muted)",
                border: `1px solid ${dateFromStr ? "var(--accent-border)" : "var(--border-subtle)"}`,
                color: dateFromStr ? "var(--text)" : "var(--text-dim)",
                width: 128,
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent-border)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = dateFromStr
                  ? "var(--accent-border)"
                  : "var(--border-subtle)")
              }
            />
            <span
              className="text-[11px] shrink-0"
              style={{ color: "var(--text-dim)" }}
            >
              To
            </span>
            <input
              type="date"
              value={dateToStr}
              onChange={(e) => setDateToStr(e.target.value)}
              aria-label="To date"
              className="h-9 px-2 text-[12px] rounded-xl outline-none transition-colors"
              style={{
                background: "var(--bg-muted)",
                border: `1px solid ${dateToStr ? "var(--accent-border)" : "var(--border-subtle)"}`,
                color: dateToStr ? "var(--text)" : "var(--text-dim)",
                width: 128,
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent-border)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = dateToStr
                  ? "var(--accent-border)"
                  : "var(--border-subtle)")
              }
            />
            {hasDateFilter && (
              <button
                onClick={() => {
                  setDateFromStr("");
                  setDateToStr("");
                }}
                aria-label="Clear date filter"
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--danger)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-dim)")
                }
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Select mode toggle — desktop only */}
          <button
            onClick={() => {
              setSelectMode((v) => {
                if (v) setSelectedIds(new Set());
                return !v;
              });
            }}
            className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-medium transition-all shrink-0"
            style={{
              background: selectMode ? "var(--accent-bg)" : "var(--bg-muted)",
              border: `1px solid ${selectMode ? "var(--accent-border)" : "var(--border-subtle)"}`,
              color: selectMode ? "var(--accent-light)" : "var(--text-muted)",
            }}
          >
            <CheckSquareIcon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Select</span>
          </button>
        </div>

        {/* Active filter badges */}
        {activeFilterCount > 0 && (
          <div
            className={`${showFilters ? "flex" : "hidden sm:flex"} items-center gap-2 flex-wrap px-4 sm:px-6 pb-2`}
          >
            {statusFilter !== "all" && (
              <span
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-bg)",
                  color: "var(--accent-light)",
                  border: `1px solid var(--accent-border)`,
                }}
              >
                Status: {statusFilter}
                <button
                  onClick={() => setStatusFilter("all")}
                  aria-label="Remove status filter"
                >
                  <XIcon className="w-2.5 h-2.5 ml-0.5" />
                </button>
              </span>
            )}
            {dateFromStr && (
              <span
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-bg)",
                  color: "var(--accent-light)",
                  border: `1px solid var(--accent-border)`,
                }}
              >
                From: {dateFromStr}
                <button
                  onClick={() => setDateFromStr("")}
                  aria-label="Remove from-date filter"
                >
                  <XIcon className="w-2.5 h-2.5 ml-0.5" />
                </button>
              </span>
            )}
            {dateToStr && (
              <span
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-bg)",
                  color: "var(--accent-light)",
                  border: `1px solid var(--accent-border)`,
                }}
              >
                To: {dateToStr}
                <button
                  onClick={() => setDateToStr("")}
                  aria-label="Remove to-date filter"
                >
                  <XIcon className="w-2.5 h-2.5 ml-0.5" />
                </button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="text-[11px]"
              style={{ color: "var(--text-dim)" }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Select mode hint bar */}
      {selectMode && !someSelected && (
        <div
          className="flex items-center gap-3 px-4 sm:px-5 py-2 shrink-0"
          style={{
            background: "var(--bg-muted)",
            borderBottom: `1px solid var(--border-subtle)`,
          }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            Tap submissions to select
          </span>
          <button
            onClick={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-lg min-h-[36px]"
            style={{
              color: "var(--text-muted)",
              background: "var(--bg-card)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pb-[calc(env(safe-area-inset-bottom)+52px+2rem)] md:pb-8">
        {isLoading ? (
          <div className="space-y-5 max-w-5xl">
            {[1, 2].map((i) => (
              <GroupSkeleton key={i} />
            ))}
          </div>
        ) : connections?.length === 0 ? (
          <EmptyState
            title="No Google Forms connected"
            description="Connect a Google Form to a template to start generating documents automatically from form responses."
            action={{ label: "Go to Templates", href: "/templates" }}
          />
        ) : submissions?.length === 0 ? (
          <EmptyState
            title="No responses yet"
            description="Submit your Google Form or tap 'Sync' on a connection to check for new responses."
          />
        ) : (
          <div className="space-y-5 max-w-5xl">
            {groupedSubmissions.map(({ connection, submissions: connSubs }) => (
              <ConnectionGroup
                key={connection._id}
                connection={connection}
                submissions={connSubs}
                selectedIds={selectedIds}
                selectMode={selectMode}
                onSelectChange={handleSelectChange}
                statusFilter={statusFilter}
                searchQuery={searchQuery}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onRetry={handleRetry}
                onDelete={handleDelete}
                onDeleteConnection={handleDeleteConnection}
                onToggleActive={handleToggleActive}
                onSync={handleSync}
                onPreview={handlePreview}
                previewingSubmissionId={previewSubmission?._id ?? null}
                defaultExpanded={connection._id === latestConnectionId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bulk actions floating bar */}
      <BulkActions
        selectedIds={selectedIds}
        submissions={submissions ?? []}
        total={submissions?.length ?? 0}
        onClear={handleClearSelection}
        onDelete={handleBulkDelete}
        onSelectAll={handleSelectAll}
      />

      {/* Document preview modal */}
      {previewSubmission && previewSubmission.fileUrl && (
        <PreviewModal
          fileUrl={previewSubmission.fileUrl}
          filename={previewSubmission.filename}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
}
