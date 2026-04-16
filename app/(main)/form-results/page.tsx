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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Mobile: slide-up sheet; Desktop: compact dropdown */}
      <div
        className="w-full sm:w-56 rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "#1a1a28",
          border: `1px solid ${colors.border}`,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            className="px-4 pt-4 pb-2"
            style={{ borderBottom: `1px solid ${colors.border}` }}
          >
            <p
              className="text-xs font-semibold truncate"
              style={{ color: colors.textMuted }}
            >
              {title}
            </p>
          </div>
        )}
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div
            className="w-8 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
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
                  color: item.danger ? "#f87171" : colors.text,
                  opacity: item.disabled ? 0.4 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled)
                    e.currentTarget.style.background = item.danger
                      ? "rgba(248,113,113,0.08)"
                      : "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  className="w-4 h-4 shrink-0"
                  style={{ color: item.danger ? "#f87171" : colors.textMuted }}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
        </div>
        {/* iOS-style cancel row on mobile */}
        <div
          className="sm:hidden px-4 py-3"
          style={{ borderTop: `1px solid ${colors.border}` }}
        >
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: colors.textSecondary,
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
        width: 18,
        height: 18,
        background:
          checked || indeterminate ? colors.accent : "rgba(255,255,255,0.08)",
        border: `1.5px solid ${
          checked || indeterminate ? colors.accent : "rgba(255,255,255,0.2)"
        }`,
      }}
    >
      {indeterminate ? (
        <MinusIcon style={{ width: 10, height: 10, color: "#fff" }} />
      ) : checked ? (
        <CheckIcon style={{ width: 10, height: 10, color: "#fff" }} />
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
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    loadTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setHasError(true);
    }, 10000);
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [fileUrl]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleLoad = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setIsLoading(false);
    setHasError(true);
  };

  const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="flex flex-col w-full max-w-5xl rounded-2xl overflow-hidden"
        style={{
          background: "#13131a",
          border: `1px solid ${colors.border}`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          maxHeight: "95vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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

        <div className="flex-1 relative" style={{ minHeight: "60vh" }}>
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

          <iframe
            key={`${filename}-${fileUrl}`}
            src={viewerUrl}
            title={`Preview: ${filename}.docx`}
            className="w-full h-full border-0"
            style={{
              minHeight: "60vh",
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

  const handleDownload = async () => {
    if (!submission.fileUrl) return;
    const res = await fetch(submission.fileUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${submission.filename}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (selectMode) {
      e.stopPropagation();
      onSelect(submission._id, !selected);
    }
  };

  const menuItems: OverflowMenuItem[] = [
    {
      icon: <EyeIcon className="w-4 h-4" />,
      label: "Preview",
      onClick: () => onPreview(submission),
      hidden: submission.status !== "generated" || !submission.fileUrl,
    },
    {
      icon: <DownloadIcon className="w-4 h-4" />,
      label: "Download",
      onClick: handleDownload,
      hidden: submission.status !== "generated" || !submission.fileUrl,
    },
    {
      icon: retrying ? (
        <RefreshCwIcon className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCwIcon className="w-4 h-4" />
      ),
      label: retrying ? "Retrying…" : "Retry",
      onClick: handleRetry,
      disabled: retrying,
      hidden: submission.status !== "error",
    },
    {
      icon: deleting ? (
        <div
          className="w-4 h-4 rounded-full border border-t-transparent animate-spin"
          style={{ borderColor: "#f87171" }}
        />
      ) : (
        <Trash2Icon className="w-4 h-4" />
      ),
      label: "Delete",
      onClick: () => setConfirmDelete(true),
      danger: true,
      disabled: deleting,
    },
  ];

  return (
    <>
      <div style={{ borderBottom: `1px solid ${colors.border}` }}>
        <div
          className="flex items-start gap-3 px-4 sm:px-5 py-3.5 transition-colors cursor-pointer"
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
          {/* Checkbox — always visible in select mode */}
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
                className="text-xs flex items-center gap-1 mt-0.5 min-h-[44px]"
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

          {/* Three-dots overflow menu - menggunakan DropdownMenu */}
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center shrink-0 transition-colors outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${colors.border}`,
                  color: colors.textMuted,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
              >
                <MoreVerticalIcon className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {menuItems.map((item, idx) =>
                  item.hidden ? null : (
                    <DropdownMenuItem
                      key={idx}
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={`flex items-center gap-2 cursor-pointer ${item.danger ? "text-destructive focus:text-destructive" : ""}`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  )
                )}
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
          border: `1px solid ${colors.border}`,
          background: "rgba(255,255,255,0.015)",
        }}
      >
        {/* Connection header - menggunakan div role="button" */}
        <div
          className="w-full flex items-start gap-3 p-4 text-left transition-colors cursor-pointer"
          style={{
            borderBottom: expanded
              ? `1px solid ${colors.borderSubtle}`
              : "none",
          }}
          onClick={() => setExpanded((v) => !v)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
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
          {/* <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: `1px solid ${colors.accentBorder}`,
            }}
          >
            📋
          </div> */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="text-sm font-semibold"
                style={{ color: colors.text }}
              >
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

          {/* Kanan: tiga titik + chevron */}
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${colors.border}`,
                  color: colors.textMuted,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
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
              style={{ color: colors.textDim }}
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
                <p className="text-sm" style={{ color: colors.textDim }}>
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
                    onPreview={onPreview}
                    isBeingPreviewed={previewingSubmissionId === s._id}
                  />
                ))}

                {hasMore && (
                  <div
                    className="flex items-center justify-center px-4 py-3"
                    style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
                  >
                    <button
                      onClick={() =>
                        setDisplayLimit((prev) => prev + PAGE_SIZE)
                      }
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
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all min-h-[44px]"
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
          className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center ml-0.5"
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

        {/* Header right: Select (mobile) + Filter toggle (mobile) */}
        <div className="flex items-center gap-2 sm:hidden">
          {/* Explicit Select button — mobile-only, always discoverable */}
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
              background: selectMode
                ? "rgba(99,102,241,0.15)"
                : "rgba(255,255,255,0.05)",
              color: selectMode ? colors.accentLight : colors.textMuted,
              border: `1px solid ${selectMode ? colors.accentBorder : colors.border}`,
            }}
          >
            <CheckSquareIcon className="w-3.5 h-3.5" />
            Select
          </button>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Toggle filters"
            className="relative flex items-center justify-center w-[44px] h-[44px] rounded-xl transition-colors"
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

          {/* Select mode toggle — desktop only (mobile has it in header) */}
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

      {/* Select mode hint bar */}
      {selectMode && !someSelected && (
        <div
          className="flex items-center gap-3 px-4 sm:px-5 py-2 shrink-0"
          style={{
            background: colors.bgSidebar,
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <span className="text-[11px]" style={{ color: colors.textDim }}>
            Tap submissions to select
          </span>
          <button
            onClick={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-lg min-h-[36px]"
            style={{
              color: colors.textMuted,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${colors.border}`,
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
