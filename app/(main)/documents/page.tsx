"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useOrganization, useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState, useMemo, useEffect, useRef } from "react";
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
  ClockIcon,
  BuildingIcon,
  CheckIcon,
  XIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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

// ── Add to Collection Dialog ──────────────────────────────────────────────────

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
      toast.error(err?.message ?? "Couldn't add. Try again.");
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
          className="text-xs mb-3 truncate"
          style={{ color: colors.textMuted }}
        >
          {documentTitle}
        </p>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {collections === undefined ? (
            <div className="flex items-center justify-center py-6">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.accentLight }}
              />
            </div>
          ) : collections.length === 0 ? (
            <p
              className="text-xs text-center py-6"
              style={{ color: colors.textDim }}
            >
              No collections yet. Create one first.
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
                    cursor: isIn ? "default" : "pointer",
                    opacity: loading && !isLoading ? 0.5 : 1,
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
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: `${col.color ?? colors.accent}18` }}
                  >
                    {col.icon ?? "📁"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: colors.text }}
                    >
                      {col.name}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: colors.textDim }}
                    >
                      {col.documentCount ?? 0} docs
                    </p>
                  </div>
                  {isLoading ? (
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                      style={{ borderColor: colors.accentLight }}
                    />
                  ) : isIn ? (
                    <CheckIcon
                      className="w-3.5 h-3.5 shrink-0"
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

// ── Rename Dialog ─────────────────────────────────────────────────────────────

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
      toast.error("Couldn't rename. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename document</DialogTitle>
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
            placeholder="Document name"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
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
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
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

// ── Collections Panel ─────────────────────────────────────────────────────────

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

  return (
    <div
      className="shrink-0 flex flex-col transition-all duration-200 overflow-hidden"
      style={{
        width: open ? 280 : 0,
        borderLeft: open ? `1px solid ${colors.borderSubtle}` : "none",
        background: colors.bgSidebar,
      }}
    >
      {open && (
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
                className="text-xs font-semibold"
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
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
              style={{ color: colors.textDim }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = colors.textMuted)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = colors.textDim)
              }
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {collections === undefined ? (
              <div className="space-y-1.5 px-3 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl animate-pulse"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  />
                ))}
              </div>
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <FolderIcon
                  className="w-8 h-8 mb-2"
                  style={{ color: colors.textDim }}
                />
                <p className="text-xs" style={{ color: colors.textMuted }}>
                  No collections yet
                </p>
                <button
                  onClick={() => router.push("/collections")}
                  className="mt-3 text-[11px] font-medium"
                  style={{ color: colors.accentLight }}
                >
                  Create one →
                </button>
              </div>
            ) : (
              <div className="space-y-0.5 px-2">
                {(
                  collections as (Doc<"collections"> & {
                    documentCount?: number;
                  })[]
                ).map((col) => (
                  <CollectionPanelItem
                    key={col._id}
                    col={col}
                    expanded={expandedId === col._id}
                    onToggle={() =>
                      setExpandedId(expandedId === col._id ? null : col._id)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className="px-4 py-3 shrink-0"
            style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
          >
            <button
              onClick={() => router.push("/collections")}
              className="w-full text-[11px] font-medium py-2 rounded-lg transition-colors text-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = colors.textSecondary)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = colors.textMuted)
              }
            >
              Manage all collections →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CollectionPanelItem({
  col,
  expanded,
  onToggle,
}: {
  col: Doc<"collections"> & { documentCount?: number };
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const docs = useQuery(
    api.collections.getDocuments,
    expanded ? { collectionId: col._id } : "skip"
  );
  const accentColor = col.color ?? colors.accent;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left group"
        style={{
          background: expanded ? `${accentColor}10` : "transparent",
          border: `1px solid ${expanded ? `${accentColor}25` : "transparent"}`,
        }}
        onMouseEnter={(e) => {
          if (!expanded)
            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.background = "transparent";
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: accentColor }}
        />
        <span className="text-sm shrink-0">{col.icon ?? "📁"}</span>
        <span
          className="flex-1 text-xs font-medium truncate"
          style={{ color: expanded ? colors.text : colors.textSecondary }}
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
        <ChevronRightIcon
          className="w-3 h-3 shrink-0 transition-transform duration-150"
          style={{
            color: colors.textDim,
            transform: expanded ? "rotate(90deg)" : "none",
          }}
        />
      </button>

      {expanded && (
        <div className="ml-4 mb-1 space-y-0.5">
          {docs === undefined ? (
            <div className="space-y-1 px-2 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 rounded-lg animate-pulse"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <p
              className="text-[11px] px-3 py-2"
              style={{ color: colors.textDim }}
            >
              No documents in this collection
            </p>
          ) : (
            docs.map((doc) => (
              <button
                key={doc._id}
                onClick={() => router.push(`/documents/${doc._id}`)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left group"
                style={{ color: colors.textMuted }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.color = colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = colors.textMuted;
                }}
              >
                <span className="text-sm shrink-0">{doc.icon ?? "📄"}</span>
                <span className="flex-1 text-[11px] font-medium truncate">
                  {doc.title}
                </span>
                <ChevronRightIcon
                  className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: colors.textDim }}
                />
              </button>
            ))
          )}
          <button
            onClick={() => router.push(`/collections/${col._id}`)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors"
            style={{ color: colors.textDim }}
            onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.textDim)}
          >
            <FolderOpenIcon className="w-3 h-3" />
            Open collection page →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div
      className="rounded-2xl p-4 space-y-3 animate-pulse"
      style={{
        background: colors.bgCard,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl shrink-0"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />
        <div className="flex-1 space-y-2">
          <div
            className="h-3.5 rounded-md w-3/4"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
          <div
            className="h-2.5 rounded-md w-1/3"
            style={{ background: "rgba(255,255,255,0.05)" }}
          />
        </div>
      </div>
      <div
        className="h-10 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)" }}
      />
      <div
        className="h-3 rounded w-1/2"
        style={{ background: "rgba(255,255,255,0.04)" }}
      />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div
      className="flex items-center gap-3 px-5 py-3.5 animate-pulse"
      style={{ borderBottom: `1px solid ${colors.border}` }}
    >
      <div
        className="w-7 h-7 rounded-lg shrink-0"
        style={{ background: "rgba(255,255,255,0.07)" }}
      />
      <div className="flex-1 space-y-1.5">
        <div
          className="h-3.5 rounded w-1/3"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <div
          className="h-2.5 rounded w-1/5"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />
      </div>
      <div
        className="h-3 rounded w-20"
        style={{ background: "rgba(255,255,255,0.05)" }}
      />
    </div>
  );
}

// ── Document Grid Card ────────────────────────────────────────────────────────

function DocumentGridCard({
  document,
  onAddToCollection,
  onRename,
}: {
  document: Doc<"documents">;
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

  const handleDuplicate = async () => {
    try {
      const newId = await duplicate({ id: document._id });
      toast.success("Duplicated");
      router.push(`/documents/${newId}`);
    } catch {
      toast.error("Couldn't duplicate. Try again.");
    }
  };
  const handleArchive = async () => {
    try {
      await archive({ id: document._id });
      toast.success("Archived");
    } catch {
      toast.error("Couldn't archive. Try again.");
    }
  };
  const handleRestore = async () => {
    try {
      await restore({ id: document._id });
      toast.success("Restored");
    } catch {
      toast.error("Couldn't restore. Try again.");
    }
  };
  const handleDelete = async () => {
    try {
      await remove({ id: document._id });
      toast.success("Deleted");
    } catch (err: any) {
      toast.error(err?.data ?? "Couldn't delete. Try again.");
    }
  };

  // Org badge label
  const orgLabel = document.organizationId
    ? organization?.id === document.organizationId
      ? organization.name
      : "Shared"
    : null;

  return (
    <>
      <div
        className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer group transition-all duration-200"
        style={{
          background: hovered ? colors.bgCardHover : colors.bgCard,
          border: `1px solid ${hovered ? colors.borderHover : colors.border}`,
          boxShadow: hovered ? shadows.cardHover : "none",
        }}
        onClick={() => router.push(`/documents/${document._id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex items-start gap-3">
          <div
            className="text-lg shrink-0 w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            {document.icon ?? "📄"}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: colors.text }}
            >
              {document.title}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <ClockIcon
                className="w-2.5 h-2.5"
                style={{ color: colors.textDim }}
              />
              <p className="text-[11px]" style={{ color: colors.textMuted }}>
                {formatDistanceToNow(new Date(document._creationTime), {
                  addSuffix: true,
                })}
              </p>
              {orgLabel && (
                <>
                  <span style={{ color: colors.textDim }}>·</span>
                  <BuildingIcon
                    className="w-2.5 h-2.5"
                    style={{ color: colors.textDim }}
                  />
                  <p
                    className="text-[11px]"
                    style={{ color: colors.textMuted }}
                  >
                    {orgLabel}
                  </p>
                </>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.07)" }}
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
                  handleDuplicate();
                }}
              >
                <CopyIcon className="w-3.5 h-3.5 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(document._id, document.title);
                }}
              >
                <PencilIcon className="w-3.5 h-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCollection(document._id, document.title);
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
                    handleRestore();
                  }}
                >
                  <ArchiveRestoreIcon className="w-3.5 h-3.5 mr-2" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive();
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
                  setConfirmDelete(true);
                }}
              >
                <Trash2Icon className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {document.isArchived && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium w-fit"
            style={{
              background: colors.warningBg,
              color: colors.warning,
              border: `1px solid rgba(251,191,36,0.2)`,
            }}
          >
            <ArchiveIcon className="w-2.5 h-2.5" />
            Archived
          </span>
        )}

        <div
          className="rounded-xl px-3 py-2.5 flex items-start gap-2 min-h-[44px]"
          style={{
            background: colors.accentBg,
            border: `1px solid ${colors.accentBorder}`,
          }}
        >
          <SparklesIcon
            className="w-3 h-3 shrink-0 mt-0.5"
            style={{ color: colors.accentLight }}
          />
          {document.aiSummaryStatus === "done" && document.aiSummary ? (
            <p
              className="text-[11px] leading-relaxed line-clamp-2"
              style={{ color: colors.textSecondary }}
            >
              {document.aiSummary}
            </p>
          ) : document.aiSummaryStatus === "pending" ? (
            <div className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin"
                style={{ color: colors.accentLight }}
              />
              <p className="text-[11px]" style={{ color: colors.textMuted }}>
                Generating summary…
              </p>
            </div>
          ) : (
            <p className="text-[11px] italic" style={{ color: colors.textDim }}>
              AI summary not yet generated
            </p>
          )}
        </div>

        {collections && collections.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(collections as Doc<"collections">[]).slice(0, 2).map((col) => (
              <span
                key={col._id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                style={{
                  background: col.color
                    ? `${col.color}20`
                    : "rgba(255,255,255,0.06)",
                  color: col.color ?? colors.textMuted,
                  border: `1px solid ${col.color ? `${col.color}30` : colors.border}`,
                }}
              >
                <span>{col.icon}</span>
                <span>{col.name}</span>
              </span>
            ))}
            {collections.length > 2 && (
              <span className="text-[10px]" style={{ color: colors.textDim }}>
                +{collections.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{document.title}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Document List Row ─────────────────────────────────────────────────────────

function DocumentListRow({
  document,
  onAddToCollection,
  onRename,
}: {
  document: Doc<"documents">;
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

  const handleDuplicate = async () => {
    try {
      const newId = await duplicate({ id: document._id });
      toast.success("Duplicated");
      router.push(`/documents/${newId}`);
    } catch {
      toast.error("Couldn't duplicate.");
    }
  };
  const handleArchive = async () => {
    try {
      await archive({ id: document._id });
      toast.success("Archived");
    } catch {
      toast.error("Couldn't archive.");
    }
  };
  const handleRestore = async () => {
    try {
      await restore({ id: document._id });
      toast.success("Restored");
    } catch {
      toast.error("Couldn't restore.");
    }
  };
  const handleDelete = async () => {
    try {
      await remove({ id: document._id });
      toast.success("Deleted");
    } catch (err: any) {
      toast.error(err?.data ?? "Couldn't delete.");
    }
  };

  const orgLabel = document.organizationId
    ? organization?.id === document.organizationId
      ? organization.name
      : "Shared"
    : null;

  return (
    <>
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer group transition-all duration-150"
        style={{
          borderBottom: `1px solid ${colors.border}`,
          background: hovered ? "rgba(255,255,255,0.02)" : "transparent",
        }}
        onClick={() => router.push(`/documents/${document._id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          className="text-base w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {document.icon ?? "📄"}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[13px] font-medium truncate"
            style={{ color: colors.text }}
          >
            {document.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              {formatDistanceToNow(new Date(document._creationTime), {
                addSuffix: true,
              })}
            </span>
            {document.isArchived && (
              <span
                className="text-[10px] font-medium px-1.5 py-px rounded-md"
                style={{ background: colors.warningBg, color: colors.warning }}
              >
                Archived
              </span>
            )}
            {orgLabel && (
              <span
                className="text-[10px] font-medium px-1.5 py-px rounded-md"
                style={{
                  background: colors.accentBg,
                  color: colors.accentLight,
                }}
              >
                {orgLabel}
              </span>
            )}
            {collections &&
              (collections as Doc<"collections">[]).slice(0, 2).map((col) => (
                <span
                  key={col._id}
                  className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-md text-[10px] font-medium"
                  style={{
                    background: col.color
                      ? `${col.color}18`
                      : "rgba(255,255,255,0.06)",
                    color: col.color ?? colors.textMuted,
                    border: `1px solid ${col.color ? `${col.color}28` : colors.border}`,
                  }}
                >
                  {col.icon} {col.name}
                </span>
              ))}
          </div>
        </div>

        {document.aiSummaryStatus === "done" && document.aiSummary && (
          <p
            className="hidden lg:block text-[11px] max-w-[200px] truncate shrink-0"
            style={{ color: colors.textMuted }}
          >
            {document.aiSummary}
          </p>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCollection(document._id, document.title);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: colors.textMuted }}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: colors.textMuted }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <MoreHorizontalIcon className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
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
                  handleDuplicate();
                }}
              >
                <CopyIcon className="w-3.5 h-3.5 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(document._id, document.title);
                }}
              >
                <PencilIcon className="w-3.5 h-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {document.isArchived ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore();
                  }}
                >
                  <ArchiveRestoreIcon className="w-3.5 h-3.5 mr-2" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive();
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
                  setConfirmDelete(true);
                }}
              >
                <Trash2Icon className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{document.title}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Filter = "all" | "mine" | "org";
type SortKey = "newest" | "oldest" | "name_asc" | "name_desc";
type ViewMode = "grid" | "list";

export default function DocumentsPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { isLoaded, isSignedIn } = useAuth();

  const createDocument = useMutation(api.documents.create);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const updateDocument = useMutation(api.documents.update);

  const [renameDialog, setRenameDialog] = useState<{
    id: Id<"documents">;
    title: string;
  } | null>(null);
  const [collectionsPanelOpen, setCollectionsPanelOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [addColDialog, setAddColDialog] = useState<{
    id: Id<"documents">;
    title: string;
  } | null>(null);

  const allDocs = useQuery(
    api.documents.getAll,
    isLoaded && isSignedIn ? { includeArchived: false } : "skip"
  );
  const archivedDocs = useQuery(
    api.documents.getArchived,
    isLoaded && isSignedIn ? {} : "skip"
  );

  const displayDocs = useMemo(() => {
    const activeDocs = allDocs ?? [];
    const archived = showArchived ? (archivedDocs ?? []) : [];
    const combined = [...activeDocs, ...archived];
    const seen = new Set<string>();
    const source = combined.filter((d) => {
      if (seen.has(d._id)) return false;
      seen.add(d._id);
      return true;
    });

    const searchLower = debouncedSearch.trim().toLowerCase();
    let filtered = searchLower
      ? source.filter((d) => d.title.toLowerCase().includes(searchLower))
      : source;

    filtered = filtered.filter((d) => {
      if (filter === "mine") return !d.organizationId;
      if (filter === "org")
        return !!(organization && d.organizationId === organization.id);
      return true;
    });

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

  const isLoading =
    allDocs === undefined || (showArchived && archivedDocs === undefined);
  const totalDocs = allDocs?.length ?? 0;
  const archivedCount = useQuery(
    api.documents.getArchived,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const sharedCount = allDocs?.filter((d) => d.organizationId).length ?? 0;

  const handleNewDocument = async () => {
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
      const fileUrl = `${convexSiteUrl}/getFile?storageId=${storageId}`;
      const docId = await createDocument({
        title: "Untitled document",
        organizationId: organization?.id,
        storageId,
      });
      await updateDocument({ id: docId, fileUrl });
      router.push(`/documents/${docId}`);
      toast.success("Document created");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create document.");
    } finally {
      setIsCreating(false);
    }
  };

  const SORT_LABELS: Record<SortKey, string> = {
    newest: "Newest first",
    oldest: "Oldest first",
    name_asc: "Name A–Z",
    name_desc: "Name Z–A",
  };

  // ── Filter label — pakai nama org kalau ada ───────────────────────────────
  const orgFilterLabel = organization?.name ?? "Org";

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-5 shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div>
          <h1
            className="text-[15px] font-semibold"
            style={{ color: colors.text }}
          >
            Documents
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5"
              style={{ color: colors.textMuted }}
            >
              {totalDocs} active
              {sharedCount > 0 && (
                <span style={{ color: colors.accentLight }}>
                  {" "}
                  · {sharedCount} shared
                </span>
              )}
              {showArchived &&
                archivedDocs !== undefined &&
                archivedDocs.length > 0 && (
                  <span style={{ color: colors.warning }}>
                    {" "}
                    · {archivedDocs.length} archived shown
                  </span>
                )}
            </p>
          )}
        </div>
        <button
          onClick={handleNewDocument}
          disabled={isCreating}
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150"
          style={{
            background: colors.accentBg,
            color: colors.accentPale,
            border: `1px solid ${colors.accentBorder}`,
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
          {isCreating ? "Creating…" : "New document"}
        </button>
      </div>

      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-2 px-6 py-3 shrink-0"
        style={{
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: "rgba(255,255,255,0.01)",
        }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <SearchIcon
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: colors.textDim }}
          />
          <input
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
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
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: colors.textDim }}
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${colors.border}`,
          }}
        >
          {(["all", "mine", ...(organization ? ["org"] : [])] as Filter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-md text-[11px] font-medium transition-all"
                style={{
                  background:
                    filter === f ? "rgba(99,102,241,0.2)" : "transparent",
                  color: filter === f ? colors.accentLight : colors.textMuted,
                }}
              >
                {f === "all" ? "All" : f === "mine" ? "Mine" : orgFilterLabel}
              </button>
            )
          )}
        </div>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium transition-colors"
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
          <DropdownMenuContent align="end">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <DropdownMenuItem key={key} onClick={() => setSort(key)}>
                {SORT_LABELS[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Archive toggle */}
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium transition-all"
          style={{
            background: showArchived
              ? colors.warningBg
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${showArchived ? "rgba(251,191,36,0.25)" : colors.border}`,
            color: showArchived ? colors.warning : colors.textMuted,
          }}
        >
          <ArchiveIcon className="w-3 h-3" />
          {showArchived ? "Hide archived" : "Archived"}
          {archivedCount !== undefined && archivedCount.length > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{
                background: showArchived
                  ? "rgba(251,191,36,0.2)"
                  : "rgba(255,255,255,0.08)",
                color: showArchived ? colors.warning : colors.textDim,
              }}
            >
              {archivedCount.length}
            </span>
          )}
        </button>

        {/* Collections panel toggle */}
        <button
          onClick={() => setCollectionsPanelOpen((v) => !v)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium transition-all"
          style={{
            background: collectionsPanelOpen
              ? colors.accentBg
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${collectionsPanelOpen ? colors.accentBorder : colors.border}`,
            color: collectionsPanelOpen ? colors.accentLight : colors.textMuted,
          }}
        >
          <FolderIcon className="w-3 h-3" />
          Collections
        </button>

        {/* View toggle */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-lg ml-auto"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${colors.border}`,
          }}
        >
          {[
            { mode: "grid" as ViewMode, icon: LayoutGridIcon },
            { mode: "list" as ViewMode, icon: ListIcon },
          ].map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className="p-1.5 rounded-md transition-all"
              style={{
                background:
                  view === mode ? "rgba(99,102,241,0.2)" : "transparent",
                color: view === mode ? colors.accentLight : colors.textDim,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            view === "grid" ? (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <GridSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <RowSkeleton key={i} />
                ))}
              </div>
            )
          ) : displayDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <FileTextIcon
                  className="w-6 h-6"
                  style={{ color: colors.textDim }}
                />
              </div>
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: colors.textSecondary }}
              >
                {search ? "No documents found" : "No documents yet"}
              </p>
              <p
                className="text-[11px] mb-5 max-w-xs"
                style={{ color: colors.textDim }}
              >
                {search
                  ? `No results for "${search}". Try a different term.`
                  : "Create your first document to get started."}
              </p>
              {!search && (
                <button
                  onClick={handleNewDocument}
                  disabled={isCreating}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl transition-all"
                  style={{
                    background: colors.accentBg,
                    color: colors.accentPale,
                    border: `1px solid ${colors.accentBorder}`,
                  }}
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  New document
                </button>
              )}
            </div>
          ) : view === "grid" ? (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayDocs.map((doc) => (
                <DocumentGridCard
                  key={doc._id}
                  document={doc}
                  onAddToCollection={(id, title) =>
                    setAddColDialog({ id, title })
                  }
                  onRename={(id, title) => setRenameDialog({ id, title })}
                />
              ))}
            </div>
          ) : (
            <div>
              {displayDocs.map((doc) => (
                <DocumentListRow
                  key={doc._id}
                  document={doc}
                  onAddToCollection={(id, title) =>
                    setAddColDialog({ id, title })
                  }
                  onRename={(id, title) => setRenameDialog({ id, title })}
                />
              ))}
            </div>
          )}
        </div>

        <CollectionsPanel
          open={collectionsPanelOpen}
          onClose={() => setCollectionsPanelOpen(false)}
        />
      </div>

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
    </div>
  );
}
