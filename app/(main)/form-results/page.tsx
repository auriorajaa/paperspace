// app/(main)/form-results/page.tsx
"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { colors } from "@/lib/design-tokens";
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
}

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "generated")
    return (
      <CheckCircleIcon
        className="w-4 h-4 shrink-0"
        style={{ color: "#34d399" }}
      />
    );
  if (status === "error")
    return (
      <XCircleIcon className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
    );
  return (
    <ClockIcon className="w-4 h-4 shrink-0" style={{ color: "#fbbf24" }} />
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = (
    {
      generated: {
        bg: "rgba(52,211,153,0.1)",
        color: "#34d399",
        label: "Done",
      },
      error: { bg: "rgba(248,113,113,0.1)", color: "#f87171", label: "Failed" },
      pending: {
        bg: "rgba(251,191,36,0.1)",
        color: "#fbbf24",
        label: "Processing",
      },
    } as Record<string, { bg: string; color: string; label: string }>
  )[status] ?? {
    bg: "rgba(255,255,255,0.06)",
    color: colors.textDim,
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
        width: 16,
        height: 16,
        background:
          checked || indeterminate ? colors.accent : "rgba(255,255,255,0.08)",
        border: `1.5px solid ${
          checked || indeterminate ? colors.accent : "rgba(255,255,255,0.2)"
        }`,
      }}
    >
      {indeterminate ? (
        <MinusIcon style={{ width: 9, height: 9, color: "#fff" }} />
      ) : checked ? (
        <CheckIcon style={{ width: 9, height: 9, color: "#fff" }} />
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
  // FIX: Separate loading and error states; reset both when fileUrl changes
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // FIX: Reset state and set timeout whenever the file changes (including re-opens)
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    // If Google Docs viewer hasn't fired onLoad within 10s, treat as error
    loadTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setHasError(true);
    }, 10000);

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [fileUrl]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // FIX: Clean load handler — no CORS contentDocument check
  const handleLoad = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setIsLoading(false);
    setHasError(false);
  };

  // FIX: Clean error handler
  const handleError = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setIsLoading(false);
    setHasError(true);
  };

  // Google Docs viewer URL for DOCX files
  const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={handleOverlayClick}
    >
      <div
        className="flex flex-col w-full max-w-5xl rounded-2xl overflow-hidden"
        style={{
          background: "#13131a",
          border: `1px solid ${colors.border}`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          maxHeight: "95vh", // FIX: increased from 90vh for more vertical space
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: `1px solid ${colors.border}` }}
        >
          <EyeIcon
            className="w-4 h-4 shrink-0"
            style={{ color: colors.accentLight }}
          />
          <p
            className="flex-1 text-sm font-medium truncate"
            style={{ color: colors.text }}
            title={`${filename}.docx`}
          >
            {filename}.docx
          </p>
          <a
            href={fileUrl}
            download={`${filename}.docx`}
            aria-label="Download document"
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34d399",
              border: "1px solid rgba(52,211,153,0.2)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(52,211,153,0.18)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(52,211,153,0.1)")
            }
            onClick={async (e) => {
              e.preventDefault();
              const res = await fetch(fileUrl);
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${filename}.docx`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <DownloadIcon className="w-3 h-3" />
            <span className="hidden sm:inline">Download</span>
          </a>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: colors.textDim }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.textDim)}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Iframe content */}
        <div className="flex-1 relative" style={{ minHeight: "50vh" }}>
          {/* FIX: Loading overlay — shown while iframe initializes */}
          {isLoading && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
              style={{ background: "#13131a" }}
            >
              <div
                className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.accentLight }}
              />
              <p className="text-sm" style={{ color: colors.textMuted }}>
                Loading document preview…
              </p>
            </div>
          )}

          {/* FIX: Error state — only shown when loading is done AND there's an error */}
          {hasError && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center z-10">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${colors.border}`,
                }}
              >
                📄
              </div>
              <div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: colors.text }}
                >
                  Preview not available
                </p>
                <p
                  className="text-xs max-w-xs leading-relaxed"
                  style={{ color: colors.textDim }}
                >
                  The document viewer couldn't load this file. Download it to
                  view it locally.
                </p>
              </div>
            </div>
          )}

          {/* FIX: key prop forces remount when switching between submissions;
               opacity hides the iframe while loading without unmounting it */}
          <iframe
            key={`${filename}-${fileUrl}`}
            src={viewerUrl}
            title={`Preview: ${filename}.docx`}
            className="w-full h-full border-0"
            style={{
              minHeight: "50vh",
              opacity: isLoading || hasError ? 0 : 1,
              transition: "opacity 0.2s ease",
            }}
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      </div>
    </div>
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
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${colors.border}`,
        }}
      >
        📭
      </div>
      <div>
        <p
          className="text-sm font-semibold mb-1"
          style={{ color: colors.textSecondary }}
        >
          {title}
        </p>
        <p
          className="text-xs max-w-xs mx-auto leading-relaxed"
          style={{ color: colors.textDim }}
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
              background: colors.accentBg,
              color: colors.accentPale,
              border: `1px solid ${colors.accentBorder}`,
            }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
            style={{
              background: colors.accentBg,
              color: colors.accentPale,
              border: `1px solid ${colors.accentBorder}`,
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
  onEnterSelectMode,
  onPreview,
  isBeingPreviewed,
}: {
  submission: Submission;
  selected: boolean;
  selectMode: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onRetry: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEnterSelectMode: () => void;
  onPreview: (submission: Submission) => void;
  // FIX: lets the Eye button reflect active-preview state for this row
  isBeingPreviewed: boolean;
}) {
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

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

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      if (!selectMode) onEnterSelectMode();
    }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (selectMode) {
      e.stopPropagation();
      onSelect(submission._id, !selected);
    }
  };

  return (
    <>
      <div
        style={{ borderBottom: `1px solid ${colors.border}` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className="flex items-start gap-3 px-4 sm:px-5 py-3 transition-colors cursor-pointer"
          style={{
            background: selected
              ? "rgba(99,102,241,0.06)"
              : hovered
                ? "rgba(255,255,255,0.02)"
                : "transparent",
          }}
          onClick={handleRowClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {selectMode && (
            <div
              className="mt-1 shrink-0"
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

          <div className="flex-1 min-w-0 space-y-1">
            <p
              className="text-sm font-medium leading-snug"
              style={{ color: colors.text }}
              title={`${submission.filename}.docx`}
            >
              <span className="line-clamp-2 sm:line-clamp-1">
                {submission.filename}.docx
              </span>
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {submission.respondentEmail && (
                <span className="text-xs" style={{ color: colors.textMuted }}>
                  {submission.respondentEmail}
                </span>
              )}
              <span
                className="text-xs tabular-nums"
                style={{ color: colors.textDim }}
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
                className="text-xs flex items-center gap-1 mt-0.5"
                style={{ color: "#f87171" }}
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

          {/* Actions */}
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {submission.status === "generated" && submission.fileUrl && (
              <>
                {/* FIX: Preview button reflects active state when this submission is open */}
                <button
                  onClick={() => onPreview(submission)}
                  aria-label="Preview document"
                  className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150"
                  style={{
                    background: isBeingPreviewed
                      ? "rgba(99,102,241,0.22)"
                      : "rgba(99,102,241,0.08)",
                    color: "#818cf8",
                    border: `1px solid ${isBeingPreviewed ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.18)"}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isBeingPreviewed)
                      e.currentTarget.style.background =
                        "rgba(99,102,241,0.16)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isBeingPreviewed)
                      e.currentTarget.style.background =
                        "rgba(99,102,241,0.08)";
                  }}
                  title="Preview document"
                >
                  <EyeIcon className="w-3.5 h-3.5" />
                </button>

                {/* Download button */}
                <button
                  onClick={async () => {
                    const res = await fetch(submission.fileUrl!);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${submission.filename}.docx`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  aria-label="Download document"
                  className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl min-h-[44px] sm:min-h-0 transition-all duration-150"
                  style={{
                    background: "rgba(52,211,153,0.1)",
                    color: "#34d399",
                    border: "1px solid rgba(52,211,153,0.2)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(52,211,153,0.18)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "rgba(52,211,153,0.1)")
                  }
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </>
            )}
            {submission.status === "error" && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                aria-label="Retry generation"
                className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl min-h-[44px] sm:min-h-0 transition-all duration-150"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  color: "#818cf8",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(99,102,241,0.18)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(99,102,241,0.1)")
                }
              >
                <RefreshCwIcon
                  className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {retrying ? "Retrying…" : "Retry"}
                </span>
              </button>
            )}
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              aria-label="Delete submission"
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
              style={{ color: colors.textDim }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#f87171";
                e.currentTarget.style.background = "rgba(248,113,113,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.textDim;
                e.currentTarget.style.background = "transparent";
              }}
            >
              {deleting ? (
                <div
                  className="w-3.5 h-3.5 rounded-full border border-t-transparent animate-spin"
                  style={{ borderColor: "currentColor" }}
                />
              ) : (
                <Trash2Icon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded error */}
        {expanded && submission.errorMessage && (
          <div className="px-4 sm:px-5 pb-3">
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(248,113,113,0.06)",
                border: "1px solid rgba(248,113,113,0.15)",
              }}
            >
              <p
                className="text-xs font-semibold mb-1"
                style={{ color: "#f87171" }}
              >
                Error details
              </p>
              <p
                className="text-xs font-mono break-words leading-relaxed"
                style={{ color: "#fca5a5" }}
              >
                {submission.errorMessage}
              </p>
              {submission.errorMessage?.toLowerCase().includes("token") && (
                <p
                  className="text-xs mt-2 leading-relaxed"
                  style={{ color: colors.textMuted }}
                >
                  💡 This may be caused by an expired Google token. Try
                  reconnecting your Google account from the template's Connect
                  Form page.
                </p>
              )}
              {submission.errorMessage?.toLowerCase().includes("template") && (
                <p
                  className="text-xs mt-2 leading-relaxed"
                  style={{ color: colors.textMuted }}
                >
                  💡 The template file may be missing or corrupt. Check your
                  template in the editor.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

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
  onSync,
  onEnterSelectMode,
  onPreview,
  previewingSubmissionId,
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
  onSync: (connectionId: string) => Promise<void>;
  onEnterSelectMode: () => void;
  onPreview: (submission: Submission) => void;
  previewingSubmissionId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

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

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${colors.border}`,
        background: "rgba(255,255,255,0.015)",
      }}
    >
      {/* Connection header */}
      <div
        className="flex items-start gap-3 p-4"
        style={{
          borderBottom: expanded ? `1px solid ${colors.borderSubtle}` : "none",
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{
            background: "rgba(99,102,241,0.12)",
            border: `1px solid ${colors.accentBorder}`,
          }}
        >
          📋
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: colors.text }}>
              {connection.formTitle}
            </p>
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{
                background: connection.isActive
                  ? "rgba(52,211,153,0.1)"
                  : "rgba(255,255,255,0.06)",
                color: connection.isActive ? "#34d399" : colors.textDim,
              }}
            >
              {connection.isActive ? "active" : "paused"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            <span className="text-xs" style={{ color: colors.textMuted }}>
              {counts.total} total
            </span>
            <span className="text-xs" style={{ color: "#34d399" }}>
              {counts.generated} generated
            </span>
            {counts.error > 0 && (
              <span className="text-xs" style={{ color: "#f87171" }}>
                {counts.error} errors
              </span>
            )}
            {counts.pending > 0 && (
              <span className="text-xs" style={{ color: "#fbbf24" }}>
                {counts.pending} pending
              </span>
            )}
          </div>
        </div>

        {/* Header actions — FIX: always 4 buttons, disabled state instead of hidden */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {/* Google Form button — always visible, disabled when no ID */}
          <a
            href={
              connection.googleFormId
                ? `https://docs.google.com/forms/d/${connection.googleFormId}/edit`
                : undefined
            }
            target={connection.googleFormId ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-label="Open Google Form"
            onClick={(e) => {
              if (!connection.googleFormId) {
                e.preventDefault();
                toast.info("Form link not available for this connection");
              }
            }}
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              !connection.googleFormId ? "cursor-not-allowed" : ""
            }`}
            style={{
              color: colors.textDim,
              border: `1px solid ${colors.border}`,
              opacity: connection.googleFormId ? 1 : 0.4,
            }}
            onMouseEnter={(e) => {
              if (connection.googleFormId) {
                e.currentTarget.style.color = colors.accentLight;
                e.currentTarget.style.borderColor = colors.accentBorder;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.textDim;
              e.currentTarget.style.borderColor = colors.border;
            }}
            title={
              connection.googleFormId
                ? "Open Google Form"
                : "Form link not available"
            }
          >
            <ExternalLinkIcon className="w-3.5 h-3.5" />
          </a>

          {/* Spreadsheet button — always visible, disabled when no ID */}
          <a
            href={
              connection.spreadsheetId
                ? `https://docs.google.com/spreadsheets/d/${connection.spreadsheetId}/edit`
                : undefined
            }
            target={connection.spreadsheetId ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-label="View in Google Sheets"
            onClick={(e) => {
              if (!connection.spreadsheetId) {
                e.preventDefault();
                toast.info(
                  "Spreadsheet link not available for this connection"
                );
              }
            }}
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              !connection.spreadsheetId ? "cursor-not-allowed" : ""
            }`}
            style={{
              color: colors.textDim,
              border: `1px solid ${colors.border}`,
              opacity: connection.spreadsheetId ? 1 : 0.4,
            }}
            onMouseEnter={(e) => {
              if (connection.spreadsheetId) {
                e.currentTarget.style.color = "#34d399";
                e.currentTarget.style.borderColor = "rgba(52,211,153,0.25)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.textDim;
              e.currentTarget.style.borderColor = colors.border;
            }}
            title={
              connection.spreadsheetId
                ? "View responses in Google Sheets"
                : "Spreadsheet link not available"
            }
          >
            <FileSpreadsheetIcon className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={handleSync}
            disabled={syncing}
            aria-label="Sync now"
            className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl min-h-[44px] sm:min-h-0 transition-all duration-150"
            style={{
              background: "rgba(99,102,241,0.1)",
              color: "#818cf8",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(99,102,241,0.18)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(99,102,241,0.1)")
            }
          >
            <RefreshCwIcon
              className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">
              {syncing ? "Syncing…" : "Sync"}
            </span>
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="flex items-center gap-1 text-[13px] font-medium px-3 py-2 rounded-xl min-h-[44px] sm:min-h-0 transition-all duration-150"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.09)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
          >
            {expanded ? (
              <ChevronUpIcon className="w-3.5 h-3.5" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {expanded ? "Collapse" : "Expand"}
            </span>
          </button>
        </div>
      </div>

      {/* Submissions list */}
      {expanded && (
        <>
          {filtered.length === 0 ? (
            <div className="px-4 sm:px-5 py-10 text-center">
              <p className="text-sm" style={{ color: colors.textDim }}>
                {submissions.length === 0
                  ? "No responses yet. Submit the form or click Sync to check for new responses."
                  : "No submissions match the current filters."}
              </p>
            </div>
          ) : (
            <>
              {/* Select-all row */}
              {selectMode && (
                <div
                  className="flex items-center gap-3 px-4 sm:px-5 py-2.5"
                  style={{
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    background: "rgba(255,255,255,0.01)",
                  }}
                >
                  <SelectCheckbox
                    checked={allDisplayedSelected}
                    indeterminate={someDisplayedSelected}
                    onChange={handleSelectAll}
                  />
                  <span className="text-xs" style={{ color: colors.textDim }}>
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
                  onEnterSelectMode={onEnterSelectMode}
                  onPreview={onPreview}
                  isBeingPreviewed={previewingSubmissionId === s._id}
                />
              ))}

              {/* Load more button */}
              {hasMore && (
                <div
                  className="flex items-center justify-center px-4 py-3"
                  style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
                >
                  <button
                    onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
                    className="text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 min-h-[40px]"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: colors.textMuted,
                      border: `1px solid ${colors.border}`,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.08)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)")
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

  const handleBulkDownload = async () => {
    if (downloadable.length === 0) {
      toast.error("No generated documents selected.");
      return;
    }
    setDownloading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      await Promise.all(
        downloadable.map(async (s) => {
          const res = await fetch(s.fileUrl!);
          if (!res.ok) return;
          const blob = await res.blob();
          zip.file(`${s.filename}.docx`, blob);
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `form_results_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Downloaded ${downloadable.length} document${downloadable.length !== 1 ? "s" : ""} as ZIP`
      );
    } catch {
      toast.error("Failed to create ZIP. Please try again.");
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
        className="fixed bottom-[calc(52px+env(safe-area-inset-bottom)+10px)] md:bottom-8 left-1/2 z-50 flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-2xl"
        style={{
          transform: "translateX(-50%)",
          background: "#1c1c28",
          border: "1px solid rgba(99,102,241,0.3)",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)",
          backdropFilter: "blur(16px)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          className="text-[12px] font-semibold tabular-nums"
          style={{ color: colors.accentPale }}
        >
          {count} selected
        </span>

        {count < total && (
          <button
            onClick={onSelectAll}
            className="text-[11px] font-medium"
            style={{ color: colors.textMuted }}
          >
            Select all {total}
          </button>
        )}

        <div
          className="w-px h-4 mx-0.5"
          style={{ background: "rgba(255,255,255,0.1)" }}
        />

        {downloadable.length > 0 && (
          <button
            onClick={handleBulkDownload}
            disabled={downloading}
            aria-label="Download selected as ZIP"
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
            style={{
              background: "rgba(52,211,153,0.12)",
              color: "#34d399",
              border: "1px solid rgba(52,211,153,0.22)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(52,211,153,0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(52,211,153,0.12)")
            }
          >
            {downloading ? (
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "#34d399" }}
              />
            ) : (
              <ArchiveIcon className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {downloading ? "Zipping…" : "ZIP"}
            </span>
            {!downloading && (
              <span className="text-[10px] opacity-75">
                ({downloadable.length})
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setConfirmBulkDelete(true)}
          disabled={deleting}
          aria-label="Delete selected submissions"
          className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
          style={{
            background: "rgba(248,113,113,0.08)",
            color: "#f87171",
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
          aria-label="Clear selection"
          className="w-6 h-6 rounded-lg flex items-center justify-center ml-0.5"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: colors.textMuted,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = colors.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
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
        background: "rgba(255,255,255,0.015)",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className="w-9 h-9 rounded-xl shrink-0"
          style={{ background: "rgba(99,102,241,0.1)" }}
        />
        <div className="flex-1 space-y-2">
          <div
            className="h-4 rounded w-1/2"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
          <div
            className="h-3 rounded w-1/3"
            style={{ background: "rgba(255,255,255,0.05)" }}
          />
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${colors.border}` }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: `1px solid ${colors.border}` }}
          >
            <div
              className="w-4 h-4 rounded"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            <div className="flex-1 space-y-1.5">
              <div
                className="h-3.5 rounded w-3/4"
                style={{ background: "rgba(255,255,255,0.07)" }}
              />
              <div
                className="h-2.5 rounded w-1/2"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            </div>
          </div>
        ))}
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

  const handleEnterSelectMode = useCallback(() => {
    setSelectMode(true);
  }, []);

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
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5 shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div>
          <h1
            className="text-[15px] sm:text-base font-semibold"
            style={{ color: colors.text }}
          >
            Form results
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap"
              style={{ color: colors.textMuted }}
            >
              <span>
                {globalCounts.all} submission{globalCounts.all !== 1 ? "s" : ""}
              </span>
              {globalCounts.error > 0 && (
                <>
                  <span style={{ color: colors.textDim }}>·</span>
                  <span style={{ color: "#f87171" }}>
                    {globalCounts.error} errors
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Toggle filters"
          className="relative flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl min-h-[44px] transition-colors sm:hidden"
          style={{
            background: showFilters
              ? "rgba(99,102,241,0.12)"
              : "rgba(255,255,255,0.05)",
            color: showFilters ? colors.accentLight : colors.textMuted,
            border: `1px solid ${showFilters ? colors.accentBorder : colors.border}`,
          }}
        >
          <FilterIcon className="w-3.5 h-3.5" />
          {activeFilterCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
              style={{ background: colors.accent, color: "#fff" }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Toolbar */}
      <div
        className="shrink-0"
        style={{
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: "rgba(255,255,255,0.01)",
        }}
      >
        <div
          className={`${showFilters ? "flex" : "hidden sm:flex"} flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 sm:px-6 py-3`}
        >
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: colors.textDim }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename or email…"
              className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = colors.accentBorder)
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = colors.border)
              }
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: colors.textDim }}
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
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${colors.border}`,
            }}
          >
            {(["all", "generated", "pending", "error"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all capitalize whitespace-nowrap"
                style={{
                  background:
                    statusFilter === f ? "rgba(99,102,241,0.2)" : "transparent",
                  color:
                    statusFilter === f ? colors.accentLight : colors.textMuted,
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
              style={{ color: colors.textDim }}
            />
            {/* FIX: Added visible "From" / "To" labels for clarity on mobile */}
            <span
              className="text-[11px] shrink-0"
              style={{ color: colors.textDim }}
            >
              From
            </span>
            <input
              type="date"
              value={dateFromStr}
              onChange={(e) => setDateFromStr(e.target.value)}
              aria-label="From date"
              className="h-9 px-2 text-[12px] rounded-xl outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${dateFromStr ? colors.accentBorder : colors.border}`,
                color: dateFromStr ? colors.text : colors.textDim,
                colorScheme: "dark",
                width: 128,
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = colors.accentBorder)
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = dateFromStr
                  ? colors.accentBorder
                  : colors.border)
              }
            />
            <span
              className="text-[11px] shrink-0"
              style={{ color: colors.textDim }}
            >
              To
            </span>
            <input
              type="date"
              value={dateToStr}
              onChange={(e) => setDateToStr(e.target.value)}
              aria-label="To date"
              className="h-9 px-2 text-[12px] rounded-xl outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${dateToStr ? colors.accentBorder : colors.border}`,
                color: dateToStr ? colors.text : colors.textDim,
                colorScheme: "dark",
                width: 128,
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = colors.accentBorder)
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = dateToStr
                  ? colors.accentBorder
                  : colors.border)
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
                style={{ color: colors.textDim }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = colors.textDim)
                }
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Select mode toggle */}
          <button
            onClick={() => {
              setSelectMode((v) => {
                if (v) setSelectedIds(new Set());
                return !v;
              });
            }}
            className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-medium transition-all shrink-0"
            style={{
              background: selectMode
                ? colors.accentBg
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${selectMode ? colors.accentBorder : colors.border}`,
              color: selectMode ? colors.accentLight : colors.textMuted,
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
                  background: "rgba(99,102,241,0.1)",
                  color: colors.accentLight,
                  border: `1px solid ${colors.accentBorder}`,
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
                  background: "rgba(99,102,241,0.1)",
                  color: colors.accentLight,
                  border: `1px solid ${colors.accentBorder}`,
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
                  background: "rgba(99,102,241,0.1)",
                  color: colors.accentLight,
                  border: `1px solid ${colors.accentBorder}`,
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
              style={{ color: colors.textDim }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Select mode header */}
      {selectMode && !someSelected && (
        <div
          className="flex items-center gap-3 px-4 sm:px-5 py-2 shrink-0"
          style={{
            background: colors.bgSidebar,
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <span className="text-[11px]" style={{ color: colors.textDim }}>
            Click submissions to select
          </span>
          <button
            onClick={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            className="ml-auto text-[11px]"
            style={{ color: colors.textDim }}
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
            description="Submit your Google Form or click 'Sync' on a connection to check for new responses."
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
                onSync={handleSync}
                onEnterSelectMode={handleEnterSelectMode}
                onPreview={handlePreview}
                previewingSubmissionId={previewSubmission?._id ?? null}
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
