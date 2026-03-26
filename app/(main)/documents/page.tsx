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
import { colors, shadows } from "@/lib/design-tokens";
import { COLLECTION_ICONS, getIconComponent } from "@/lib/collection-icons";


// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** <24h → "2 hours ago", ≥24h → "Mar 26, 2:30 PM" */
function smartDate(ts: number): string {
  if (differenceInHours(Date.now(), ts) < 24) {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  }
  return format(new Date(ts), "MMM d, h:mm a");
}

const PAGE_SIZE = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Add-to-collection dialog
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
          style={{ color: colors.textMuted }}
        >
          {documentTitle}
        </p>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {collections === undefined ? (
            <div className="flex justify-center py-8">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.accentLight }}
              />
            </div>
          ) : collections.length === 0 ? (
            <p
              className="text-[12px] text-center py-8"
              style={{ color: colors.textDim }}
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
                      ? `${col.color ?? colors.accent}12`
                      : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isIn ? `${col.color ?? colors.accent}30` : colors.border}`,
                    minHeight: 48,
                  }}
                  onMouseEnter={(e) => {
                    if (!isIn && !loading)
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isIn)
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.02)";
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: `${col.color ?? colors.accent}18` }}
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
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-medium truncate"
                      style={{ color: colors.text }}
                    >
                      {col.name}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: colors.textDim }}
                    >
                      {col.documentCount ?? 0} papers
                    </p>
                  </div>
                  {isLoading ? (
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                      style={{ borderColor: colors.accentLight }}
                    />
                  ) : isIn ? (
                    <CheckIcon
                      className="w-4 h-4 shrink-0"
                      style={{ color: col.color ?? colors.accentLight }}
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
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${colors.accentBorder}`,
              color: colors.text,
            }}
            placeholder="Paper name"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{
                color: colors.textMuted,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${colors.border}`,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{
                background: colors.accentBg,
                color: colors.accentLight,
                border: `1px solid ${colors.accentBorder}`,
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
// Collections panel — desktop side / mobile bottom sheet
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
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div className="flex items-center gap-2">
          <FolderIcon
            className="w-3.5 h-3.5"
            style={{ color: colors.accentLight }}
          />
          <span
            className="text-[13px] font-semibold"
            style={{ color: colors.textSecondary }}
          >
            Collections
          </span>
          {collections && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-md"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: colors.textDim,
              }}
            >
              {collections.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            color: colors.textDim,
            background: "rgba(255,255,255,0.04)",
          }}
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
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <FolderIcon
              className="w-7 h-7 mb-2"
              style={{ color: colors.textDim }}
            />
            <p className="text-[12px]" style={{ color: colors.textMuted }}>
              No collections yet
            </p>
            <button
              onClick={() => router.push("/collections")}
              className="mt-2 text-[11px] font-medium"
              style={{ color: colors.accentLight }}
            >
              Create one →
            </button>
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {(
              collections as (Doc<"collections"> & { documentCount?: number })[]
            ).map((col) => {
              const accentColor = col.color ?? colors.accent;
              return (
                <div key={col._id}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => router.push(`/collections/${col._id}`)}
                      className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
                      style={{ minHeight: 44 }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(255,255,255,0.03)")
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
                        })()}{" "}
                      </span>
                      <span
                        className="flex-1 text-[12px] font-medium truncate"
                        style={{ color: colors.textSecondary }}
                      >
                        {col.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          color: colors.textDim,
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
                      style={{ color: colors.textDim }}
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
        style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
      >
        <button
          onClick={() => router.push("/collections")}
          className="w-full text-[12px] font-medium py-2.5 rounded-xl text-center transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: colors.textMuted,
            border: `1px solid ${colors.border}`,
          }}
        >
          Manage collections →
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <div
        className="hidden md:flex shrink-0 flex-col transition-all duration-200 overflow-hidden"
        style={{
          width: open ? 268 : 0,
          borderLeft: open ? `1px solid ${colors.borderSubtle}` : "none",
          background: colors.bgSidebar,
        }}
      >
        {open && inner}
      </div>
      {/* Mobile bottom sheet */}
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
          background: "#15151e",
          border: "1px solid rgba(255,255,255,0.08)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
          maxHeight: "80vh",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            className="w-9 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
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
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      </div>
    );
  if (docs.length === 0)
    return (
      <p
        className="ml-6 text-[11px] px-3 py-1.5"
        style={{ color: colors.textDim }}
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
            (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <span className="text-sm shrink-0">{doc.icon ?? "📄"}</span>
          <span
            className="flex-1 text-[11px] font-medium truncate"
            style={{ color: colors.textMuted }}
          >
            {doc.title}
          </span>
        </button>
      ))}
      {docs.length > 5 && (
        <p className="px-3 py-1 text-[10px]" style={{ color: colors.textDim }}>
          +{docs.length - 5} more
        </p>
      )}
      <button
        onClick={() => router.push(`/collections/${collectionId}`)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium"
        style={{ color: colors.textDim }}
        onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
        onMouseLeave={(e) => (e.currentTarget.style.color = colors.textDim)}
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
          checked || indeterminate ? colors.accent : "rgba(255,255,255,0.08)",
        border: `1.5px solid ${checked || indeterminate ? colors.accent : "rgba(255,255,255,0.2)"}`,
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

function AIDot({ status }: { status?: string }) {
  if (status === "done")
    return (
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: colors.accentLight }}
        title="AI summary ready"
      />
    );
  if (status === "pending")
    return (
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
        style={{ background: colors.warning }}
        title="Generating…"
      />
    );
  return null;
}

/** Up to maxVisible badges, then a "+N" pill */
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
            background: col.color ? `${col.color}18` : "rgba(255,255,255,0.06)",
            color: col.color ?? colors.textMuted,
            border: `1px solid ${col.color ? `${col.color}28` : colors.border}`,
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
            background: "rgba(255,255,255,0.06)",
            color: colors.textDim,
            border: `1px solid ${colors.border}`,
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
}: {
  document: Doc<"documents">;
  onAddToCollection: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${colors.border}`,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.12)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
          }
        >
          <MoreHorizontalIcon
            className="w-3.5 h-3.5"
            style={{ color: colors.textMuted }}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/documents/${document._id}`);
          }}
        >
          <FileTextIcon className="w-3.5 h-3.5 mr-2" />
          Open
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
// Grid card — compact, information-dense
// ─────────────────────────────────────────────────────────────────────────────

function GridCard({
  document,
  selected,
  selectMode,
  onSelect,
  onAddToCollection,
  onRename,
}: {
  document: Doc<"documents">;
  selected: boolean;
  selectMode: boolean;
  onSelect: (id: string, shift: boolean) => void;
  onAddToCollection: (id: Id<"documents">, title: string) => void;
  onRename: (id: Id<"documents">, title: string) => void;
}) {
  const router = useRouter();
  const { organization } = useOrganization();
  const duplicate = useMutation(api.documents.duplicate);
  const archive = useMutation(api.documents.archive);
  const restore = useMutation(api.documents.restore);
  const remove = useMutation(api.documents.remove);
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
              ? colors.bgCardHover
              : colors.bgCard,
          border: `1px solid ${selected ? colors.accentBorder : hovered ? colors.borderHover : colors.border}`,
          boxShadow: selected
            ? `0 0 0 2px ${colors.accent}28`
            : hovered
              ? shadows.cardHover
              : "none",
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Top accent line matching first collection color */}
        <div
          className="h-0.5 w-full shrink-0"
          style={{
            background:
              cols[0]?.color ??
              (document.organizationId
                ? colors.accent
                : "rgba(255,255,255,0.06)"),
          }}
        />

        <div className="p-3.5 flex flex-col gap-2.5 flex-1">
          {/* Header: icon + title + select/menu */}
          <div className="flex items-start gap-2.5">
            {/* Select checkbox — only in select mode */}
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
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              {document.icon ?? "📄"}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-semibold leading-snug line-clamp-2"
                style={{ color: colors.text }}
              >
                {document.title}
              </p>
              {/* Date + status inline */}
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {smartDate(document._creationTime)}
                </span>
                <AIDot status={document.aiSummaryStatus} />
                {document.isArchived && (
                  <span
                    className="text-[9px] font-semibold px-1.5 py-px rounded"
                    style={{
                      background: colors.warningBg,
                      color: colors.warning,
                    }}
                  >
                    ARCHIVED
                  </span>
                )}
                {orgLabel && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-px rounded"
                    style={{
                      background: colors.accentBg,
                      color: colors.accentLight,
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
                onDuplicate={async () => {
                  try {
                    const id = await duplicate({ id: document._id });
                    toast.success("Duplicated");
                    router.push(`/documents/${id}`);
                  } catch {
                    toast.error("Couldn't duplicate.");
                  }
                }}
                onArchive={async () => {
                  try {
                    await archive({ id: document._id });
                    toast.success("Archived");
                  } catch {
                    toast.error("Couldn't archive.");
                  }
                }}
                onRestore={async () => {
                  try {
                    await restore({ id: document._id });
                    toast.success("Restored");
                  } catch {
                    toast.error("Couldn't restore.");
                  }
                }}
                onDelete={() => setConfirmDelete(true)}
              />
            </div>
          </div>

          {/* AI summary — compact, no framed box */}
          <div className="flex items-start gap-1.5 flex-1 min-h-[36px]">
            <SparklesIcon
              className="w-2.5 h-2.5 shrink-0 mt-0.5"
              style={{
                color:
                  document.aiSummaryStatus === "done"
                    ? colors.accentLight
                    : "rgba(255,255,255,0.2)",
              }}
            />
            {document.aiSummaryStatus === "done" && document.aiSummary ? (
              <p
                className="text-[11px] leading-relaxed line-clamp-3"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {document.aiSummary}
              </p>
            ) : document.aiSummaryStatus === "pending" ? (
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin shrink-0"
                  style={{ color: colors.accentLight }}
                />
                <p
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Generating summary…
                </p>
              </div>
            ) : (
              <p
                className="text-[11px] italic"
                style={{ color: "rgba(255,255,255,0.18)" }}
              >
                No summary yet
              </p>
            )}
          </div>

          {/* Collections — only if any */}
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
              onClick={async () => {
                try {
                  await remove({ id: document._id });
                  toast.success("Deleted");
                } catch (err: any) {
                  toast.error(err?.data ?? "Couldn't delete.");
                }
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
// List row — two-line layout with AI summary visible
// ─────────────────────────────────────────────────────────────────────────────

function ListRow({
  document,
  selected,
  selectMode,
  onSelect,
  onAddToCollection,
  onRename,
}: {
  document: Doc<"documents">;
  selected: boolean;
  selectMode: boolean;
  onSelect: (id: string, shift: boolean) => void;
  onAddToCollection: (id: Id<"documents">, title: string) => void;
  onRename: (id: Id<"documents">, title: string) => void;
}) {
  const router = useRouter();
  const { organization } = useOrganization();
  const duplicate = useMutation(api.documents.duplicate);
  const archive = useMutation(api.documents.archive);
  const restore = useMutation(api.documents.restore);
  const remove = useMutation(api.documents.remove);
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
          borderBottom: `1px solid ${colors.border}`,
          background: selected
            ? "rgba(99,102,241,0.06)"
            : hovered
              ? "rgba(255,255,255,0.02)"
              : "transparent",
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Select checkbox — only in select mode */}
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

        {/* Paper icon */}
        <span
          className="text-base w-8 h-8 flex items-center justify-center rounded-lg shrink-0 mt-0.5"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {document.icon ?? "📄"}
        </span>

        {/* Content block */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Row 1: title + meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="text-[13px] font-semibold"
              style={{ color: colors.text }}
            >
              {document.title}
            </p>

            {/* Status chips inline */}
            {document.isArchived && (
              <span
                className="text-[9px] font-semibold px-1.5 py-px rounded shrink-0"
                style={{ background: colors.warningBg, color: colors.warning }}
              >
                ARCHIVED
              </span>
            )}
            {orgLabel && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-px rounded shrink-0"
                style={{
                  background: colors.accentBg,
                  color: colors.accentLight,
                }}
              >
                <UsersIcon style={{ width: 9, height: 9 }} />
                {orgLabel}
              </span>
            )}
          </div>

          {/* Row 2: AI summary */}
          <div className="flex items-start gap-1.5">
            <SparklesIcon
              className="w-2.5 h-2.5 shrink-0 mt-px"
              style={{
                color:
                  document.aiSummaryStatus === "done"
                    ? colors.accentLight
                    : "rgba(255,255,255,0.15)",
              }}
            />
            {document.aiSummaryStatus === "done" && document.aiSummary ? (
              <p
                className="text-[11px] leading-relaxed line-clamp-2"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {document.aiSummary}
              </p>
            ) : document.aiSummaryStatus === "pending" ? (
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin shrink-0"
                  style={{ color: colors.accentLight }}
                />
                <p
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Generating summary…
                </p>
              </div>
            ) : (
              <p
                className="text-[11px] italic"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                No summary yet
              </p>
            )}
          </div>

          {/* Row 3: collections + date */}
          <div
            className="flex items-center gap-2 pt-0.5 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            {cols.length > 0 && (
              <CollectionBadges collections={cols} maxVisible={2} />
            )}
            <span
              className="text-[11px] ml-auto shrink-0 tabular-nums"
              style={{ color: "rgba(255,255,255,0.38)" }}
            >
              {smartDate(document._creationTime)}
            </span>
          </div>
        </div>

        {/* Right actions — always visible */}
        <div
          className="flex items-center gap-1 shrink-0 mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onAddToCollection(document._id, document.title)}
            className="hidden sm:flex w-7 h-7 rounded-lg items-center justify-center transition-colors"
            style={{ color: colors.textDim }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
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
            onDuplicate={async () => {
              try {
                const id = await duplicate({ id: document._id });
                toast.success("Duplicated");
                router.push(`/documents/${id}`);
              } catch {
                toast.error("Couldn't duplicate.");
              }
            }}
            onArchive={async () => {
              try {
                await archive({ id: document._id });
                toast.success("Archived");
              } catch {
                toast.error("Couldn't archive.");
              }
            }}
            onRestore={async () => {
              try {
                await restore({ id: document._id });
                toast.success("Restored");
              } catch {
                toast.error("Couldn't restore.");
              }
            }}
            onDelete={() => setConfirmDelete(true)}
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
              onClick={async () => {
                try {
                  await remove({ id: document._id });
                  toast.success("Deleted");
                } catch (err: any) {
                  toast.error(err?.data ?? "Couldn't delete.");
                }
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
// Bulk action floating bar
// ─────────────────────────────────────────────────────────────────────────────

function BulkBar({
  count,
  total,
  onArchive,
  onDelete,
  onClear,
  onAddToCollection,
  onSelectAll,
}: {
  count: number;
  total: number;
  onArchive: () => void;
  onDelete: () => void;
  onClear: () => void;
  onAddToCollection: () => void;
  onSelectAll: () => void;
}) {
  return (
    <div
      className="fixed bottom-[calc(52px+env(safe-area-inset-bottom)+10px)] md:bottom-8 left-1/2 z-50 flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-2xl"
      style={{
        transform: "translateX(-50%)",
        background: "#1c1c28",
        border: "1px solid rgba(99,102,241,0.3)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)",
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
      <button
        onClick={onAddToCollection}
        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
        style={{
          background: "rgba(255,255,255,0.06)",
          color: colors.textSecondary,
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
        }
      >
        <FolderPlusIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Collection</span>
      </button>
      <button
        onClick={onArchive}
        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
        style={{
          background: "rgba(251,191,36,0.08)",
          color: colors.warning,
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
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
        style={{
          background: "rgba(248,113,113,0.08)",
          color: colors.danger,
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
        style={{
          background: "rgba(255,255,255,0.06)",
          color: colors.textMuted,
        }}
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
      style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
    >
      <span
        className="text-[11px] tabular-nums"
        style={{ color: colors.textDim }}
      >
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: page === 1 ? colors.textDim : colors.textMuted,
            border: `1px solid ${colors.border}`,
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
              style={{ color: colors.textDim }}
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
                  p === page
                    ? "rgba(99,102,241,0.2)"
                    : "rgba(255,255,255,0.03)",
                color: p === page ? colors.accentLight : colors.textMuted,
                border: `1px solid ${p === page ? colors.accentBorder : colors.border}`,
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
            background: "rgba(255,255,255,0.04)",
            color: page === totalPages ? colors.textDim : colors.textMuted,
            border: `1px solid ${colors.border}`,
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
        background: colors.bgCard,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        className="h-0.5 w-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg shrink-0"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3.5 rounded-md w-3/4"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <div
              className="h-2.5 rounded-md w-1/3"
              style={{ background: "rgba(255,255,255,0.05)" }}
            />
          </div>
          <div
            className="w-7 h-7 rounded-lg shrink-0"
            style={{ background: "rgba(255,255,255,0.05)" }}
          />
        </div>
        <div className="space-y-1.5">
          <div
            className="h-2.5 rounded w-full"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          <div
            className="h-2.5 rounded w-4/5"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          <div
            className="h-2.5 rounded w-2/3"
            style={{ background: "rgba(255,255,255,0.03)" }}
          />
        </div>
        <div className="flex gap-1.5">
          <div
            className="h-4 w-16 rounded-md"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          <div
            className="h-4 w-12 rounded-md"
            style={{ background: "rgba(255,255,255,0.03)" }}
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
      style={{ borderBottom: `1px solid ${colors.border}` }}
    >
      <div
        className="w-8 h-8 rounded-lg shrink-0 mt-0.5"
        style={{ background: "rgba(255,255,255,0.07)" }}
      />
      <div className="flex-1 space-y-2">
        <div
          className="h-3.5 rounded w-1/2"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <div
          className="h-2.5 rounded w-3/4"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />
        <div className="flex gap-1.5">
          <div
            className="h-4 w-14 rounded-md"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          <div
            className="h-4 w-10 rounded-md"
            style={{ background: "rgba(255,255,255,0.03)" }}
          />
        </div>
      </div>
      <div
        className="w-7 h-7 rounded-lg shrink-0"
        style={{ background: "rgba(255,255,255,0.05)" }}
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
  const createDocument = useMutation(api.documents.create);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const updateDocument = useMutation(api.documents.update);
  const archiveMutation = useMutation(api.documents.archive);
  const removeMutation = useMutation(api.documents.remove);

  const [renameDialog, setRenameDialog] = useState<{
    id: Id<"documents">;
    title: string;
  } | null>(null);
  const [addColDialog, setAddColDialog] = useState<{
    id: Id<"documents">;
    title: string;
  } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [collectionsPanelOpen, setCollectionsPanelOpen] = useState(false);
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
  const lastSelectedIdx = useRef<number>(-1);
  const contentRef = useRef<HTMLDivElement>(null);

  const skip = !(isLoaded && isSignedIn);
  const allDocs = useQuery(
    api.documents.getAll,
    skip ? "skip" : { includeArchived: false }
  );
  const archivedDocs = useQuery(api.documents.getArchived, skip ? "skip" : {});

  // Full filtered+sorted list (no pagination yet)
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

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));
  const displayDocs = filteredDocs.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, sort, showArchived]);

  // Clear selection when page changes or filters change
  useEffect(() => {
    setSelected(new Set());
  }, [page, debouncedSearch, filter, sort]);

  // Exit select mode when nothing is selected
  useEffect(() => {
    if (selected.size === 0 && selectMode) setSelectMode(false);
  }, [selected.size]);

  const isLoading =
    allDocs === undefined || (showArchived && archivedDocs === undefined);
  const totalDocs = allDocs?.length ?? 0;
  const archivedCount = archivedDocs?.length ?? 0;
  const sharedCount = allDocs?.filter((d) => d.organizationId).length ?? 0;

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

  const handleBulkArchive = async () => {
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => archiveMutation({ id: id as Id<"documents"> }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    failed
      ? toast.error(`${failed} papers couldn't be archived.`)
      : toast.success(`${ids.length} papers archived`);
    setSelected(new Set());
    setSelectMode(false);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => removeMutation({ id: id as Id<"documents"> }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    failed
      ? toast.error(`${failed} papers couldn't be deleted.`)
      : toast.success(`${ids.length} papers deleted`);
    setSelected(new Set());
    setSelectMode(false);
    setBulkDeleteOpen(false);
  };

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

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between shrink-0 px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div>
          <h1
            className="text-[15px] sm:text-base font-semibold"
            style={{ color: colors.text }}
          >
            Papers
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap"
              style={{ color: colors.textMuted }}
            >
              <span>
                {totalDocs} {totalDocs === 1 ? "paper" : "papers"}
              </span>
              {sharedCount > 0 && (
                <>
                  <span style={{ color: colors.textDim }}>·</span>
                  <span style={{ color: colors.accentLight }}>
                    {sharedCount} shared
                  </span>
                </>
              )}
              {showArchived && archivedCount > 0 && (
                <>
                  <span style={{ color: colors.textDim }}>·</span>
                  <span style={{ color: colors.warning }}>
                    {archivedCount} archived shown
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={handleNewPaper}
          disabled={isCreating}
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0"
          style={{
            background: colors.accentBg,
            color: colors.accentPale,
            border: `1px solid ${colors.accentBorder}`,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (!isCreating) {
              e.currentTarget.style.background = colors.accentBgHover;
              e.currentTarget.style.boxShadow = shadows.glow;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.accentBg;
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {isCreating ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <PlusIcon className="w-3.5 h-3.5" />
          )}
          {isCreating ? "Creating…" : "New paper"}
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div
        className="shrink-0"
        style={{
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: "rgba(255,255,255,0.01)",
        }}
      >
        {/* Row 1: search + view + select mode */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5">
          <div className="relative flex-1 max-w-md">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: colors.textDim }}
            />
            <input
              placeholder="Search papers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl outline-none"
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
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: colors.textDim }}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl shrink-0"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${colors.border}`,
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
                  color: view === v ? colors.accentLight : colors.textDim,
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

        {/* Row 2: filters — scrollable */}
        <div
          className="flex items-center gap-2 px-4 sm:px-6 pb-2.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl shrink-0"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${colors.border}`,
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
                  color: filter === f ? colors.accentLight : colors.textMuted,
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
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${colors.border}`,
                  color: colors.textMuted,
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
                      style={{ color: colors.accentLight }}
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
                ? colors.warningBg
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${showArchived ? "rgba(251,191,36,0.25)" : colors.border}`,
              color: showArchived ? colors.warning : colors.textMuted,
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
                    : "rgba(255,255,255,0.08)",
                  color: showArchived ? colors.warning : colors.textDim,
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
                ? colors.accentBg
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${collectionsPanelOpen ? colors.accentBorder : colors.border}`,
              color: collectionsPanelOpen
                ? colors.accentLight
                : colors.textMuted,
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
            borderBottom: `1px solid ${colors.border}`,
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <span className="text-[11px]" style={{ color: colors.textDim }}>
            {filteredDocs.length} result{filteredDocs.length !== 1 ? "s" : ""}
          </span>
          {debouncedSearch && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: colors.textMuted,
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
              style={{ background: colors.accentBg, color: colors.accentLight }}
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
            style={{ color: colors.textDim }}
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
            background: colors.bgSidebar,
            borderBottom: `1px solid ${colors.borderSubtle}`,
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
          <span className="text-[11px]" style={{ color: colors.textDim }}>
            Click papers to select
          </span>
          <button
            onClick={() => {
              setSelectMode(false);
              setSelected(new Set());
            }}
            className="ml-auto text-[11px]"
            style={{ color: colors.textDim }}
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
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <FileIcon
                    className="w-6 h-6"
                    style={{ color: colors.textDim }}
                  />
                </div>
                <p
                  className="text-[14px] font-semibold mb-1.5"
                  style={{ color: colors.textSecondary }}
                >
                  {search ? "No papers found" : "No papers yet"}
                </p>
                <p
                  className="text-[12px] mb-6 max-w-[240px] leading-relaxed"
                  style={{ color: colors.textDim }}
                >
                  {search
                    ? `No results for "${search}".`
                    : "Create your first paper to get started."}
                </p>
                {!search && (
                  <button
                    onClick={handleNewPaper}
                    disabled={isCreating}
                    className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-xl"
                    style={{
                      background: colors.accentBg,
                      color: colors.accentPale,
                      border: `1px solid ${colors.accentBorder}`,
                    }}
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    New paper
                  </button>
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
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && filteredDocs.length > PAGE_SIZE && (
            <div className="pb-[calc(env(safe-area-inset-bottom)+52px)] md:pb-0">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={filteredDocs.length}
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
          total={filteredDocs.length}
          onArchive={handleBulkArchive}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={() => {
            setSelected(new Set());
            setSelectMode(false);
          }}
          onSelectAll={handleSelectAll}
          onAddToCollection={() => {
            const firstId = Array.from(selected)[0] as Id<"documents">;
            setAddColDialog({ id: firstId, title: `${selected.size} papers` });
          }}
        />
      )}

      {/* Dialogs */}
      {addColDialog && (
        <AddToCollectionDialog
          open={!!addColDialog}
          onOpenChange={(v) => !v && setAddColDialog(null)}
          documentId={addColDialog.id}
          documentTitle={addColDialog.title}
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
