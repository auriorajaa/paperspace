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
  SparklesIcon,
  Trash2Icon,
  StarIcon,
  TagIcon,
  SearchIcon,
  AlertCircleIcon,
  XIcon,
  CheckIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  ListIcon,
  FolderOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  // Lucide icons used for collection display
  FolderIcon,
  BookOpenIcon,
  BookIcon,
  FileTextIcon,
  ZapIcon,
  TargetIcon,
  GlobeIcon,
  HomeIcon,
  BuildingIcon,
  BriefcaseIcon,
  ArchiveIcon,
  BoxIcon,
  BookmarkIcon,
  DatabaseIcon,
  CodeIcon,
  RocketIcon,
  ShieldIcon,
  FlagIcon,
  TrophyIcon,
  BellIcon,
  LockIcon,
  HeartIcon,
  CameraIcon,
  MusicIcon,
  SunIcon,
  MoonIcon,
  LayersIcon,
  HardDriveIcon,
  MailIcon,
  ClipboardIcon,
  TerminalIcon,
  PackageIcon,
} from "lucide-react";
import { differenceInHours, format, formatDistanceToNow } from "date-fns";
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

// ─────────────────────────────────────────────────────────────────────────────
// Utilities (shared with collections page)
// ─────────────────────────────────────────────────────────────────────────────

function smartDate(ts: number): string {
  if (differenceInHours(Date.now(), ts) < 24)
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  return format(new Date(ts), "MMM d, yyyy 'at' h:mm a");
}

function smartDateShort(ts: number): string {
  if (differenceInHours(Date.now(), ts) < 24)
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  return format(new Date(ts), "MMM d, yyyy");
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  folder: FolderIcon,
  "book-open": BookOpenIcon,
  book: BookIcon,
  "file-text": FileTextIcon,
  layers: LayersIcon,
  database: DatabaseIcon,
  code: CodeIcon,
  terminal: TerminalIcon,
  briefcase: BriefcaseIcon,
  building: BuildingIcon,
  home: HomeIcon,
  rocket: RocketIcon,
  target: TargetIcon,
  trophy: TrophyIcon,
  shield: ShieldIcon,
  zap: ZapIcon,
  heart: HeartIcon,
  star: StarIcon,
  bookmark: BookmarkIcon,
  tag: TagIcon,
  archive: ArchiveIcon,
  box: BoxIcon,
  package: PackageIcon,
  "hard-drive": HardDriveIcon,
  globe: GlobeIcon,
  mail: MailIcon,
  bell: BellIcon,
  lock: LockIcon,
  flag: FlagIcon,
  clipboard: ClipboardIcon,
  camera: CameraIcon,
  music: MusicIcon,
  sun: SunIcon,
  moon: MoonIcon,
};

function ColIcon({
  iconKey,
  className,
  style,
}: {
  iconKey?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = ICON_MAP[iconKey ?? "folder"] ?? FolderIcon;
  return <Icon className={className} style={style} />;
}

type DocSortKey = "added" | "newest" | "oldest" | "name_asc" | "name_desc";
type ViewMode = "grid" | "list";

// ─────────────────────────────────────────────────────────────────────────────
// Add document dialog
// ─────────────────────────────────────────────────────────────────────────────

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
          toast.error("Failed to add one paper.");
      }
    }
    if (ok > 0) toast.success(`Added ${ok} paper${ok !== 1 ? "s" : ""}`);
    setSelected(new Set());
    onOpenChange(false);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add papers to collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: colors.textDim }}
            />
            <input
              placeholder="Search your papers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full h-9 pl-8 pr-3 text-[13px] rounded-xl outline-none"
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
            className="max-h-64 overflow-y-auto space-y-0.5 rounded-xl p-1"
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
                className="flex items-center justify-center py-8 text-[12px]"
                style={{ color: colors.textMuted }}
              >
                No papers found
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                    style={{
                      background: isSel ? colors.accentBg : "transparent",
                      opacity: alreadyIn ? 0.5 : 1,
                      cursor: alreadyIn ? "not-allowed" : "pointer",
                      minHeight: 44,
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
                      className="flex-1 text-[13px] truncate"
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
                        Already in
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
            <p className="text-[11px]" style={{ color: colors.textMuted }}>
              {selected.size} paper{selected.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-[13px] font-medium"
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
            className="px-4 py-2 rounded-xl text-[13px] font-medium"
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

// ─────────────────────────────────────────────────────────────────────────────
// Document grid card — compact, inline AI, always-visible remove
// ─────────────────────────────────────────────────────────────────────────────

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
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeDocument({ collectionId, documentId: document._id });
      toast.success("Removed from collection");
    } catch {
      toast.error("Couldn't remove. Try again.");
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  return (
    <>
      <div
        className="rounded-2xl flex flex-col overflow-hidden cursor-pointer transition-all duration-200 h-full"
        style={{
          background: hovered
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.025)",
          border: `1px solid ${hovered ? accentColor + "35" : colors.border}`,
          boxShadow: hovered
            ? `0 0 0 1px ${accentColor}12, 0 8px 24px rgba(0,0,0,0.28)`
            : "none",
          transform: hovered ? "translateY(-1px)" : "none",
        }}
        onClick={() => router.push(`/documents/${document._id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Accent top */}
        <div
          className="h-0.5 w-full shrink-0"
          style={{ background: accentColor, opacity: 0.7 }}
        />

        <div className="flex flex-col gap-2.5 p-3.5 flex-1">
          {/* Header */}
          <div className="flex items-start gap-2.5">
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
              <p
                className="text-[11px] mt-0.5 tabular-nums"
                style={{ color: "rgba(255,255,255,0.42)" }}
              >
                {smartDateShort(document._creationTime)}
              </p>
            </div>
            {/* Remove button — always visible on mobile, hover on desktop */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setConfirmRemove(true);
              }}
            >
              <button
                disabled={removing}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${colors.border}`,
                  color: colors.textDim,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(248,113,113,0.12)";
                  e.currentTarget.style.color = "#f87171";
                  e.currentTarget.style.border =
                    "1px solid rgba(248,113,113,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = colors.textDim;
                  e.currentTarget.style.border = `1px solid ${colors.border}`;
                }}
                title="Remove from collection"
              >
                {removing ? (
                  <div
                    className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: colors.textDim }}
                  />
                ) : (
                  <XIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* AI summary — inline, no heavy box */}
          <div className="flex items-start gap-1.5 flex-1 min-h-[32px]">
            <SparklesIcon
              className="w-2.5 h-2.5 shrink-0 mt-0.5"
              style={{
                color:
                  document.aiSummaryStatus === "done"
                    ? accentColor + "bb"
                    : "rgba(255,255,255,0.18)",
              }}
            />
            {document.aiSummaryStatus === "done" && document.aiSummary ? (
              <p
                className="text-[11px] leading-relaxed line-clamp-3"
                style={{ color: "rgba(255,255,255,0.48)" }}
              >
                {document.aiSummary}
              </p>
            ) : document.aiSummaryStatus === "pending" ? (
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin shrink-0"
                  style={{ color: accentColor }}
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
        </div>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from collection?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{document.title}&rdquo; will be removed from this
              collection. The paper itself won't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document list row
// ─────────────────────────────────────────────────────────────────────────────

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
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeDocument({ collectionId, documentId: document._id });
      toast.success("Removed");
    } catch {
      toast.error("Couldn't remove. Try again.");
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  return (
    <>
      <div
        className="flex items-start gap-3 px-4 sm:px-5 py-3 cursor-pointer transition-all duration-150"
        style={{
          borderBottom: `1px solid ${colors.border}`,
          background: hovered ? "rgba(255,255,255,0.02)" : "transparent",
        }}
        onClick={() => router.push(`/documents/${document._id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          className="text-base w-8 h-8 flex items-center justify-center rounded-lg shrink-0 mt-0.5"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {document.icon ?? "📄"}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <p
            className="text-[13px] font-semibold"
            style={{ color: colors.text }}
          >
            {document.title}
          </p>
          {/* AI summary */}
          <div className="flex items-start gap-1.5">
            <SparklesIcon
              className="w-2.5 h-2.5 shrink-0 mt-px"
              style={{
                color:
                  document.aiSummaryStatus === "done"
                    ? accentColor + "aa"
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
                  style={{ color: accentColor }}
                />
                <p
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Generating…
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
          <p
            className="text-[11px] tabular-nums"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            {smartDate(document._creationTime)}
          </p>
        </div>
        {/* Always-visible remove */}
        <div
          className="shrink-0 mt-0.5"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmRemove(true);
          }}
        >
          <button
            disabled={removing}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${colors.border}`,
              color: colors.textDim,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(248,113,113,0.12)";
              e.currentTarget.style.color = "#f87171";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = colors.textDim;
            }}
            title="Remove from collection"
          >
            {removing ? (
              <div
                className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.textDim }}
              />
            ) : (
              <XIcon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from collection?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{document.title}&rdquo; will be removed. The paper itself
              won't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────────────────────────────────────────

function DocGridSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        className="h-0.5 w-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div
            className="w-8 h-8 rounded-lg shrink-0"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3.5 rounded w-3/4"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <div
              className="h-2.5 rounded w-1/3"
              style={{ background: "rgba(255,255,255,0.05)" }}
            />
          </div>
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
        </div>
      </div>
    </div>
  );
}

function DocListSkeleton() {
  return (
    <div
      className="flex items-start gap-3 px-4 sm:px-5 py-3 animate-pulse"
      style={{ borderBottom: `1px solid ${colors.border}` }}
    >
      <div
        className="w-8 h-8 rounded-lg shrink-0 mt-0.5"
        style={{ background: "rgba(255,255,255,0.07)" }}
      />
      <div className="flex-1 space-y-1.5">
        <div
          className="h-3.5 rounded w-1/2"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <div
          className="h-2.5 rounded w-3/4"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />
        <div
          className="h-2.5 rounded w-1/4"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
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
    if (debouncedSearch.trim())
      docs = docs.filter((d) =>
        d.title.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
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
          return 0;
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

  // ── Loading state ──────────────────────────────────────────────────────────
  if (collection === undefined) {
    return (
      <div className="flex flex-col h-full" style={{ background: colors.bg }}>
        <div
          className="px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-5 animate-pulse"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div
            className="h-3 rounded w-24 mb-5"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl shrink-0"
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
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <DocGridSkeleton key={i} />
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
        <p className="text-[14px] font-semibold" style={{ color: colors.text }}>
          Collection not found
        </p>
        <button
          onClick={() => router.push("/collections")}
          className="text-[12px] font-medium px-4 py-2 rounded-xl"
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

  const tags = collection.tags ?? [];

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* Accent top line */}
      <div
        className="h-0.5 shrink-0"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent 70%)`,
        }}
      />

      {/* ── Header ── */}
      <div
        className="px-4 sm:px-6 pt-[calc(48px+0.75rem)] sm:pt-4 pb-4 shrink-0"
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

        {/* Main header — stack on mobile, row on sm+ */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            {/* Collection icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `${accentColor}18`,
                border: `2px solid ${accentColor}30`,
              }}
            >
              <ColIcon
                iconKey={collection.icon}
                className="w-6 h-6"
                style={{ color: accentColor }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className="text-base sm:text-lg font-semibold tracking-tight"
                  style={{ color: colors.text }}
                >
                  {collection.name}
                </h1>
                {collection.isFavorite && (
                  <StarIcon className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                )}
              </div>
              {collection.description && (
                <p
                  className="text-[12px] sm:text-sm mt-0.5"
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
                  {documents?.length ?? 0} paper
                  {(documents?.length ?? 0) !== 1 ? "s" : ""}
                </span>
                <span className="text-[11px]" style={{ color: colors.textDim }}>
                  Created {smartDateShort(collection._creationTime)}
                </span>
                {tags.map((tag) => (
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
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <button
              onClick={() => toggleFavorite({ id: collectionId })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: collection.isFavorite
                  ? "rgba(251,191,36,0.1)"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: "rgba(248,113,113,0.08)",
                color: "#f87171",
                border: "1px solid rgba(248,113,113,0.2)",
              }}
            >
              <Trash2Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div
        className="shrink-0"
        style={{
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: "rgba(255,255,255,0.01)",
        }}
      >
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: colors.textDim }}
            />
            <input
              placeholder="Search in this collection…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: colors.textDim }}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-medium shrink-0"
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
                  {docSort === key && (
                    <CheckIcon
                      className="w-3 h-3 mr-2"
                      style={{ color: colors.accentLight }}
                    />
                  )}
                  {DOC_SORT_LABELS[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View toggle */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl shrink-0"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${colors.border}`,
            }}
          >
            {[
              { v: "grid" as ViewMode, Icon: LayoutGridIcon },
              { v: "list" as ViewMode, Icon: ListIcon },
            ].map(({ v, Icon }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="p-1.5 rounded-lg transition-all"
                style={{
                  background: view === v ? `${accentColor}25` : "transparent",
                  color: view === v ? accentColor : colors.textDim,
                }}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={() => setAddDocOpen(true)}
            className="flex items-center gap-1.5 ml-auto text-[12px] sm:text-[13px] font-medium px-3 py-2 rounded-xl transition-all shrink-0"
            style={{
              background: `${accentColor}18`,
              color: accentColor,
              border: `1px solid ${accentColor}30`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = `${accentColor}28`)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = `${accentColor}18`)
            }
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add papers</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* Mobile sort row */}
        <div
          className="flex items-center gap-2 px-4 py-2 sm:hidden"
          style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
        >
          <span className="text-[11px]" style={{ color: colors.textDim }}>
            Sort:
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1 text-[11px] font-medium"
                style={{ color: colors.textMuted }}
              >
                {DOC_SORT_LABELS[docSort]}
                <ChevronDownIcon className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(Object.keys(DOC_SORT_LABELS) as DocSortKey[]).map((key) => (
                <DropdownMenuItem key={key} onClick={() => setDocSort(key)}>
                  {docSort === key && (
                    <CheckIcon
                      className="w-3 h-3 mr-2"
                      style={{ color: colors.accentLight }}
                    />
                  )}
                  {DOC_SORT_LABELS[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {filteredDocs.length > 0 && (
            <span
              className="ml-auto text-[11px]"
              style={{ color: colors.textDim }}
            >
              {filteredDocs.length} paper{filteredDocs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Search result count — desktop */}
      {search && !!(filteredDocs.length !== (documents?.length ?? 0)) && (
        <div
          className="hidden sm:block px-4 sm:px-6 py-2 shrink-0"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <p className="text-[11px]" style={{ color: colors.textMuted }}>
            {filteredDocs.length} result{filteredDocs.length !== 1 ? "s" : ""}{" "}
            for &ldquo;{search}&rdquo;
          </p>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {documents === undefined ? (
          view === "grid" ? (
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <DocGridSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <DocListSkeleton key={i} />
              ))}
            </div>
          )
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
              className="text-[14px] font-semibold mb-1.5"
              style={{ color: colors.textSecondary }}
            >
              {search ? "No papers found" : "No papers yet"}
            </p>
            <p
              className="text-[12px] mb-5 max-w-[220px] leading-relaxed"
              style={{ color: colors.textDim }}
            >
              {search
                ? `No results for "${search}".`
                : "Add your first paper to this collection."}
            </p>
            {!search && (
              <button
                onClick={() => setAddDocOpen(true)}
                className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-xl"
                style={{
                  background: `${accentColor}18`,
                  color: accentColor,
                  border: `1px solid ${accentColor}30`,
                }}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Add papers
              </button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch pb-[calc(1rem+env(safe-area-inset-bottom)+52px)] md:pb-6">
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
          <div className="pb-[calc(env(safe-area-inset-bottom)+52px)] md:pb-0">
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
                Papers inside will NOT be deleted.
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
