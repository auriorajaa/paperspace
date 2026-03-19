"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  ChevronLeftIcon,
  PlusIcon,
  FileTextIcon,
  SparklesIcon,
  Trash2Icon,
  PencilIcon,
  StarIcon,
  TagIcon,
  SearchIcon,
  AlertCircleIcon,
  FolderOpenIcon,
  XIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  LayoutGridIcon,
  ListIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";
import { useDebounce } from "@/lib/useDebounce";
import { colors } from "@/lib/design-tokens";

type DocSortKey = "added" | "newest" | "oldest" | "name_asc" | "name_desc";
type ViewMode = "grid" | "list";

// ── Add Document Dialog ───────────────────────────────────────────────────────

function AddDocumentDialog({
  open,
  onOpenChange,
  collectionId,
  existingDocIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  collectionId: Id<"collections">;
  existingDocIds: Set<string>;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const searchResults = useQuery(
    api.documents.search,
    isLoaded && isSignedIn ? { query: debouncedSearch } : "skip"
  );
  const addDocument = useMutation(api.collections.addDocument);

  const toggleSelect = (id: string) => {
    if (existingDocIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!selected.size) return;
    setLoading(true);
    let ok = 0;
    for (const docId of selected) {
      try {
        await addDocument({
          collectionId,
          documentId: docId as Id<"documents">,
        });
        ok++;
      } catch (err: any) {
        if (!err?.message?.includes("already"))
          toast.error(`Failed to add one document.`);
      }
    }
    if (ok > 0) toast.success(`Added ${ok} document${ok !== 1 ? "s" : ""}`);
    setSelected(new Set());
    onOpenChange(false);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: colors.textDim }}
            />
            <input
              placeholder="Search your documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full h-9 pl-8 pr-3 text-sm rounded-xl outline-none"
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
          <div
            className="max-h-64 overflow-y-auto space-y-1 rounded-xl p-1"
            style={{ border: `1px solid ${colors.border}` }}
          >
            {searchResults === undefined ? (
              <div className="flex items-center justify-center py-8">
                <div
                  className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: colors.accentLight }}
                />
              </div>
            ) : searchResults.length === 0 ? (
              <div
                className="flex items-center justify-center py-8 text-xs"
                style={{ color: colors.textMuted }}
              >
                No documents found
              </div>
            ) : (
              searchResults.map((doc) => {
                const alreadyIn = existingDocIds.has(doc._id);
                const isSel = selected.has(doc._id);
                return (
                  <button
                    key={doc._id}
                    type="button"
                    onClick={() => toggleSelect(doc._id)}
                    disabled={alreadyIn}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                    style={{
                      background: isSel ? colors.accentBg : "transparent",
                      opacity: alreadyIn ? 0.5 : 1,
                      cursor: alreadyIn ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (!alreadyIn && !isSel)
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span className="text-base shrink-0">
                      {doc.icon ?? "📄"}
                    </span>
                    <span
                      className="flex-1 text-sm truncate"
                      style={{ color: colors.text }}
                    >
                      {doc.title}
                    </span>
                    {alreadyIn ? (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          color: colors.textDim,
                        }}
                      >
                        Already added
                      </span>
                    ) : isSel ? (
                      <CheckIcon
                        className="w-4 h-4 shrink-0"
                        style={{ color: colors.accentLight }}
                      />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          {selected.size > 0 && (
            <p className="text-xs" style={{ color: colors.textMuted }}>
              {selected.size} document{selected.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading || !selected.size}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: colors.accentBg,
              color: colors.accentLight,
              border: `1px solid ${colors.accentBorder}`,
              opacity: !selected.size ? 0.5 : 1,
            }}
          >
            {loading
              ? "Adding…"
              : `Add${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Document Card ─────────────────────────────────────────────────────────────

function DocCard({
  document,
  collectionId,
  accentColor,
}: {
  document: Doc<"documents">;
  collectionId: Id<"collections">;
  accentColor: string;
}) {
  const router = useRouter();
  const removeDocument = useMutation(api.collections.removeDocument);
  const [removing, setRemoving] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);
    try {
      await removeDocument({ collectionId, documentId: document._id });
      toast.success("Removed from collection");
    } catch {
      toast.error("Couldn't remove. Try again.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer group transition-all duration-200"
      style={{
        background: hovered
          ? "rgba(255,255,255,0.045)"
          : "rgba(255,255,255,0.025)",
        border: `1px solid ${hovered ? accentColor + "30" : colors.border}`,
        boxShadow: hovered
          ? `0 0 0 1px ${accentColor}10, 0 8px 24px rgba(0,0,0,0.3)`
          : "none",
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
          <div className="flex items-center gap-1.5 mt-0.5">
            <ClockIcon
              className="w-2.5 h-2.5"
              style={{ color: colors.textDim }}
            />
            <p className="text-[11px]" style={{ color: colors.textMuted }}>
              {formatDistanceToNow(new Date(document._creationTime), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{ color: colors.textDim }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(248,113,113,0.12)";
            e.currentTarget.style.color = "#f87171";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = colors.textDim;
          }}
          title="Remove from collection"
        >
          {removing ? (
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: colors.textDim }}
            />
          ) : (
            <XIcon className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* AI Summary */}
      <div
        className="rounded-xl px-3 py-2.5 flex items-start gap-2 min-h-[44px]"
        style={{
          background: `${accentColor}08`,
          border: `1px solid ${accentColor}15`,
        }}
      >
        <SparklesIcon
          className="w-3 h-3 shrink-0 mt-0.5"
          style={{ color: accentColor + "99" }}
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
              style={{ color: accentColor }}
            />
            <p className="text-[11px]" style={{ color: colors.textMuted }}>
              Generating…
            </p>
          </div>
        ) : (
          <p className="text-[11px] italic" style={{ color: colors.textDim }}>
            AI summary not yet generated
          </p>
        )}
      </div>
    </div>
  );
}

function DocListRow({
  document,
  collectionId,
  accentColor,
}: {
  document: Doc<"documents">;
  collectionId: Id<"collections">;
  accentColor: string;
}) {
  const router = useRouter();
  const removeDocument = useMutation(api.collections.removeDocument);
  const [removing, setRemoving] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);
    try {
      await removeDocument({ collectionId, documentId: document._id });
      toast.success("Removed");
    } catch {
      toast.error("Couldn't remove. Try again.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-5 py-3.5 cursor-pointer group transition-colors"
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
        <p className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
          {formatDistanceToNow(new Date(document._creationTime), {
            addSuffix: true,
          })}
        </p>
      </div>
      {document.aiSummaryStatus === "done" && document.aiSummary && (
        <p
          className="hidden lg:block text-[11px] max-w-[200px] truncate shrink-0"
          style={{ color: colors.textMuted }}
        >
          {document.aiSummary}
        </p>
      )}
      <button
        onClick={handleRemove}
        disabled={removing}
        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
        style={{ color: colors.textDim }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(248,113,113,0.12)";
          e.currentTarget.style.color = "#f87171";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = colors.textDim;
        }}
        title="Remove from collection"
      >
        {removing ? (
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: colors.textDim }}
          />
        ) : (
          <XIcon className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const collectionId = params.collectionId as Id<"collections">;

  const collection = useQuery(
    api.collections.getById,
    isLoaded && isSignedIn ? { id: collectionId } : "skip"
  );
  const documents = useQuery(
    api.collections.getDocuments,
    isLoaded && isSignedIn ? { collectionId } : "skip"
  );
  const toggleFavorite = useMutation(api.collections.toggleFavorite);
  const remove = useMutation(api.collections.remove);

  const [addDocOpen, setAddDocOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [search, setSearch] = useState("");
  const [docSort, setDocSort] = useState<DocSortKey>("added");
  const [view, setView] = useState<ViewMode>("grid");

  const debouncedSearch = useDebounce(search, 200);

  const accentColor = collection?.color ?? "#6366f1";

  const filteredDocs = useMemo(() => {
    if (!documents) return [];
    let docs = [...documents];
    if (debouncedSearch.trim()) {
      docs = docs.filter((d) =>
        d.title.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
    }
    docs.sort((a, b) => {
      switch (docSort) {
        case "newest":
          return b._creationTime - a._creationTime;
        case "oldest":
          return a._creationTime - b._creationTime;
        case "name_asc":
          return a.title.localeCompare(b.title);
        case "name_desc":
          return b.title.localeCompare(a.title);
        default:
          return 0; // added — keep original order
      }
    });
    return docs;
  }, [documents, debouncedSearch, docSort]);

  const existingDocIds = useMemo(
    () => new Set((documents ?? []).map((d) => d._id as string)),
    [documents]
  );

  const handleDelete = async () => {
    try {
      await remove({ id: collectionId });
      toast.success("Collection deleted");
      router.push("/collections");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't delete. Try again.");
    }
  };

  const DOC_SORT_LABELS: Record<DocSortKey, string> = {
    added: "Date added",
    newest: "Newest created",
    oldest: "Oldest created",
    name_asc: "Name A–Z",
    name_desc: "Name Z–A",
  };

  // Loading
  if (collection === undefined) {
    return (
      <div className="flex flex-col h-full" style={{ background: colors.bg }}>
        <div
          className="px-6 py-5 animate-pulse"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div
            className="h-3 rounded w-20 mb-4"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl"
              style={{ background: "rgba(255,255,255,0.07)" }}
            />
            <div className="flex-1 space-y-2">
              <div
                className="h-5 rounded w-48"
                style={{ background: "rgba(255,255,255,0.08)" }}
              />
              <div
                className="h-3 rounded w-32"
                style={{ background: "rgba(255,255,255,0.05)" }}
              />
            </div>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 space-y-3 animate-pulse"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex gap-3">
                <div
                  className="w-9 h-9 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                />
                <div className="flex-1 space-y-1.5">
                  <div
                    className="h-3.5 rounded w-3/4"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  />
                  <div
                    className="h-2.5 rounded w-1/2"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  />
                </div>
              </div>
              <div
                className="h-10 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (collection === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        style={{ background: colors.bg }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: colors.dangerBg }}
        >
          <AlertCircleIcon
            className="w-6 h-6"
            style={{ color: colors.danger }}
          />
        </div>
        <p className="text-sm font-semibold" style={{ color: colors.text }}>
          Collection not found
        </p>
        <button
          onClick={() => router.push("/collections")}
          className="text-xs font-medium px-4 py-2 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
          }}
        >
          Back to Collections
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* Top accent line */}
      <div
        className="h-0.5 shrink-0"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent 60%)`,
        }}
      />

      {/* Header */}
      <div
        className="px-6 py-5 shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        {/* Breadcrumb */}
        <Link
          href="/collections"
          className="inline-flex items-center gap-1 text-[11px] font-medium mb-4 transition-colors"
          style={{ color: colors.textMuted }}
          onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Collections
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{
                background: `${accentColor}18`,
                border: `1px solid ${accentColor}30`,
              }}
            >
              {collection.icon ?? "📁"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-lg font-semibold tracking-tight"
                  style={{ color: colors.text }}
                >
                  {collection.name}
                </h1>
                {collection.isFavorite && (
                  <StarIcon className="w-4 h-4 fill-amber-400 text-amber-400" />
                )}
              </div>
              {collection.description && (
                <p
                  className="text-sm mt-0.5"
                  style={{ color: colors.textMuted }}
                >
                  {collection.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: `${accentColor}18`, color: accentColor }}
                >
                  {documents?.length ?? 0} doc
                  {(documents?.length ?? 0) !== 1 ? "s" : ""}
                </span>
                <span className="text-[11px]" style={{ color: colors.textDim }}>
                  Created{" "}
                  {formatDistanceToNow(new Date(collection._creationTime), {
                    addSuffix: true,
                  })}
                </span>
                {collection.tags &&
                  collection.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                      style={{
                        background: `${accentColor}15`,
                        color: `${accentColor}CC`,
                        border: `1px solid ${accentColor}25`,
                      }}
                    >
                      <TagIcon className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => toggleFavorite({ id: collectionId })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: collection.isFavorite
                  ? "rgba(251,191,36,0.12)"
                  : "rgba(255,255,255,0.05)",
                color: collection.isFavorite ? "#fbbf24" : colors.textMuted,
                border: `1px solid ${collection.isFavorite ? "rgba(251,191,36,0.3)" : colors.border}`,
              }}
            >
              <StarIcon
                className={`w-3.5 h-3.5 ${collection.isFavorite ? "fill-amber-400" : ""}`}
              />
              {collection.isFavorite ? "Pinned" : "Pin"}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: "rgba(248,113,113,0.08)",
                color: "#f87171",
                border: "1px solid rgba(248,113,113,0.2)",
              }}
            >
              <Trash2Icon className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-6 py-3 shrink-0"
        style={{
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: "rgba(255,255,255,0.01)",
        }}
      >
        <div className="relative flex-1 max-w-xs">
          <SearchIcon
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: colors.textDim }}
          />
          <input
            placeholder="Search in this collection…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
            onFocus={(e) =>
              (e.currentTarget.style.border = `1px solid ${accentColor}40`)
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

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${colors.border}`,
                color: colors.textMuted,
              }}
            >
              {DOC_SORT_LABELS[docSort]}
              <ChevronDownIcon className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(DOC_SORT_LABELS) as DocSortKey[]).map((key) => (
              <DropdownMenuItem key={key} onClick={() => setDocSort(key)}>
                {DOC_SORT_LABELS[key]}
                {docSort === key && (
                  <span
                    className="ml-auto text-[10px]"
                    style={{ color: colors.accentLight }}
                  >
                    ✓
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View toggle */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-lg"
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
                background: view === mode ? `${accentColor}25` : "transparent",
                color: view === mode ? accentColor : colors.textDim,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <button
          onClick={() => setAddDocOpen(true)}
          className="flex items-center gap-1.5 ml-auto text-xs font-medium px-3.5 py-2 rounded-xl transition-all"
          style={{
            background: `${accentColor}18`,
            color: accentColor,
            border: `1px solid ${accentColor}30`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${accentColor}28`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${accentColor}18`;
          }}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add document
        </button>
      </div>

      {/* Search results count */}
      {search && (
        <div
          className="px-6 py-2 shrink-0"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <p className="text-[11px]" style={{ color: colors.textMuted }}>
            {filteredDocs.length} result{filteredDocs.length !== 1 ? "s" : ""}{" "}
            for &ldquo;{search}&rdquo;
          </p>
        </div>
      )}

      {/* Documents */}
      <div className="flex-1 overflow-y-auto">
        {documents === undefined ? (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 space-y-3 animate-pulse"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="flex gap-3">
                  <div
                    className="w-9 h-9 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                  />
                  <div className="flex-1 space-y-1.5">
                    <div
                      className="h-3.5 rounded w-3/4"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    />
                    <div
                      className="h-2.5 rounded w-1/2"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                  </div>
                </div>
                <div
                  className="h-10 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              </div>
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: `${accentColor}12`,
                border: `1px solid ${accentColor}25`,
              }}
            >
              <FolderOpenIcon
                className="w-6 h-6"
                style={{ color: accentColor + "80" }}
              />
            </div>
            <p
              className="text-sm font-semibold mb-1"
              style={{ color: colors.textSecondary }}
            >
              {search ? "No documents found" : "No documents yet"}
            </p>
            <p
              className="text-[11px] mb-4 max-w-xs"
              style={{ color: colors.textDim }}
            >
              {search
                ? `No results for "${search}".`
                : "Add your first document to this collection."}
            </p>
            {!search && (
              <button
                onClick={() => setAddDocOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl"
                style={{
                  background: `${accentColor}18`,
                  color: accentColor,
                  border: `1px solid ${accentColor}30`,
                }}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Add document
              </button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredDocs.map((doc) => (
              <DocCard
                key={doc._id}
                document={doc}
                collectionId={collectionId}
                accentColor={accentColor}
              />
            ))}
          </div>
        ) : (
          <div>
            {filteredDocs.map((doc) => (
              <DocListRow
                key={doc._id}
                document={doc}
                collectionId={collectionId}
                accentColor={accentColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add document dialog */}
      <AddDocumentDialog
        open={addDocOpen}
        onOpenChange={setAddDocOpen}
        collectionId={collectionId}
        existingDocIds={existingDocIds}
      />

      {/* Delete confirm */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete collection?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{collection.name}&rdquo; will be permanently deleted.
              <strong className="block mt-1" style={{ color: colors.text }}>
                Documents inside will NOT be deleted.
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete collection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
