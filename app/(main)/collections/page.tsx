"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  PlusIcon,
  FolderIcon,
  StarIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  SearchIcon,
  XIcon,
  TagIcon,
  ChevronDownIcon,
  FileTextIcon,
  SortAscIcon,
  LayoutGridIcon,
  ListIcon,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { colors } from "@/lib/design-tokens";

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Slate", value: "#64748b" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Yellow", value: "#eab308" },
  { label: "Green", value: "#22c55e" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink", value: "#ec4899" },
];

const PRESET_EMOJIS = [
  "📁",
  "📂",
  "🗂️",
  "📋",
  "📌",
  "📍",
  "🗃️",
  "🗄️",
  "📊",
  "📈",
  "📉",
  "📝",
  "✏️",
  "🖊️",
  "📒",
  "📓",
  "📔",
  "📕",
  "📗",
  "📘",
  "📙",
  "📚",
  "🔖",
  "🏷️",
  "💼",
  "🗑️",
  "📦",
  "🎯",
  "🚀",
  "💡",
  "🔑",
  "⭐",
];

type SortKey =
  | "favorites"
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "most_docs";
type ViewMode = "grid" | "list";

// ── Collection Form Dialog ────────────────────────────────────────────────────

interface CollectionFormData {
  name: string;
  description: string;
  icon: string;
  color: string;
  tags: string[];
  isFavorite: boolean;
}

function CollectionFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<CollectionFormData>;
  onSubmit: (data: CollectionFormData) => Promise<void>;
  title: string;
}) {
  const [form, setForm] = useState<CollectionFormData>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    icon: initial?.icon ?? "📁",
    color: initial?.color ?? "#6366f1",
    tags: initial?.tags ?? [],
    isFavorite: initial?.isFavorite ?? false,
  });
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const addTag = (raw: string) => {
    const tags = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !form.tags.includes(t));
    if (tags.length) setForm((f) => ({ ...f, tags: [...f.tags, ...tags] }));
  };
  const removeTag = (tag: string) =>
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput && form.tags.length)
      removeTag(form.tags[form.tags.length - 1]);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Collection name is required.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Icon + Name */}
          <div className="flex gap-3 items-start">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-colors"
                style={{
                  background: `${form.color}20`,
                  border: `1px solid ${form.color}40`,
                }}
              >
                {form.icon}
              </button>
              {showEmojiPicker && (
                <div
                  className="absolute top-12 left-0 z-50 rounded-xl p-2 shadow-xl grid grid-cols-8 gap-1 w-[240px]"
                  style={{
                    background: "#18181d",
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {PRESET_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, icon: emoji }));
                        setShowEmojiPicker(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-base transition-colors hover:bg-white/10"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="col-name"
                className="text-xs"
                style={{ color: colors.textMuted }}
              >
                Name <span className="text-red-400">*</span>
              </Label>
              <input
                id="col-name"
                placeholder="My collection"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label
              htmlFor="col-desc"
              className="text-xs"
              style={{ color: colors.textMuted }}
            >
              Description
            </Label>
            <textarea
              id="col-desc"
              placeholder="What's this collection for?"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label className="text-xs" style={{ color: colors.textMuted }}>
              Color
            </Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                  className="w-6 h-6 rounded-full transition-all"
                  style={{
                    background: c.value,
                    outline:
                      form.color === c.value ? `2px solid ${c.value}` : "none",
                    outlineOffset: "2px",
                    transform:
                      form.color === c.value ? "scale(1.15)" : "scale(1)",
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: colors.textMuted }}>
              Tags
            </Label>
            <div
              className="flex flex-wrap gap-1.5 p-2 rounded-xl min-h-[40px]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${colors.border}`,
              }}
            >
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                  style={{ background: `${form.color}20`, color: form.color }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:opacity-60"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => {
                  if (tagInput.trim()) {
                    addTag(tagInput);
                    setTagInput("");
                  }
                }}
                placeholder={
                  form.tags.length ? "" : "Add tags… (Enter or comma)"
                }
                className="flex-1 min-w-[100px] text-xs bg-transparent outline-none"
                style={{ color: colors.text }}
              />
            </div>
          </div>

          {/* Favorite */}
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({ ...f, isFavorite: !f.isFavorite }))
            }
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all"
            style={{
              background: form.isFavorite
                ? "rgba(251,191,36,0.12)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${form.isFavorite ? "rgba(251,191,36,0.3)" : colors.border}`,
              color: form.isFavorite ? "#fbbf24" : colors.textMuted,
            }}
          >
            <StarIcon
              className={`w-3.5 h-3.5 ${form.isFavorite ? "fill-amber-400" : ""}`}
            />
            {form.isFavorite ? "Pinned to top" : "Pin to top"}
          </button>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: colors.accentBg,
              color: colors.accentLight,
              border: `1px solid ${colors.accentBorder}`,
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: colors.accentLight }}
                />
                Saving…
              </span>
            ) : (
              "Save"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Collection Card (Grid) ────────────────────────────────────────────────────

function CollectionCard({
  col,
  onEdit,
  onDelete,
}: {
  col: Doc<"collections"> & { documentCount: number };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toggleFavorite = useMutation(api.collections.toggleFavorite);
  const [hovered, setHovered] = useState(false);
  const accentColor = col.color ?? "#6366f1";

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggleFavorite({ id: col._id });
    } catch {
      toast.error("Couldn't update. Try again.");
    }
  };

  return (
    <Link href={`/collections/${col._id}`}>
      <div
        className="group rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all duration-200 relative overflow-hidden"
        style={{
          background: hovered
            ? "rgba(255,255,255,0.045)"
            : "rgba(255,255,255,0.025)",
          border: `1px solid ${hovered ? accentColor + "30" : colors.border}`,
          boxShadow: hovered
            ? `0 0 0 1px ${accentColor}15, 0 8px 32px rgba(0,0,0,0.3)`
            : "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Color accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{
            background: `linear-gradient(90deg, ${accentColor}, transparent)`,
          }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{
                background: `${accentColor}18`,
                border: `1px solid ${accentColor}25`,
              }}
            >
              {col.icon ?? "📁"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: colors.text }}
                >
                  {col.name}
                </p>
                {col.isFavorite && (
                  <StarIcon className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" />
                )}
              </div>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: colors.textMuted }}
              >
                {col.documentCount} doc{col.documentCount !== 1 ? "s" : ""} ·{" "}
                {formatDistanceToNow(new Date(col._creationTime), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={handleToggleFavorite}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: col.isFavorite ? "#fbbf24" : colors.textDim }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              title={col.isFavorite ? "Unpin" : "Pin to top"}
            >
              <StarIcon
                className={`w-3.5 h-3.5 ${col.isFavorite ? "fill-amber-400" : ""}`}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: colors.textDim }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <MoreHorizontalIcon className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <PencilIcon className="w-3.5 h-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2Icon className="w-3.5 h-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Description */}
        {col.description && (
          <p
            className="text-[11px] leading-relaxed line-clamp-2"
            style={{ color: colors.textMuted }}
          >
            {col.description}
          </p>
        )}

        {/* Tags */}
        {col.tags && col.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {col.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{
                  background: `${accentColor}15`,
                  color: accentColor + "CC",
                  border: `1px solid ${accentColor}25`,
                }}
              >
                {tag}
              </span>
            ))}
            {col.tags.length > 4 && (
              <span
                className="text-[10px] px-1.5 py-0.5"
                style={{ color: colors.textDim }}
              >
                +{col.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer — doc count bar */}
        <div className="flex items-center gap-2 pt-1">
          <div
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:
                  col.documentCount > 0
                    ? `${Math.min(100, col.documentCount * 10)}%`
                    : "0%",
                background: accentColor,
                opacity: 0.6,
              }}
            />
          </div>
          <span
            className="text-[10px] font-medium"
            style={{ color: accentColor + "99" }}
          >
            {col.documentCount}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Collection List Row ───────────────────────────────────────────────────────

function CollectionListRow({
  col,
  onEdit,
  onDelete,
}: {
  col: Doc<"collections"> & { documentCount: number };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toggleFavorite = useMutation(api.collections.toggleFavorite);
  const [hovered, setHovered] = useState(false);
  const accentColor = col.color ?? "#6366f1";

  return (
    <Link href={`/collections/${col._id}`}>
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer group transition-all duration-150"
        style={{
          borderBottom: `1px solid ${colors.border}`,
          background: hovered ? "rgba(255,255,255,0.02)" : "transparent",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="w-1 h-8 rounded-full shrink-0"
          style={{ background: accentColor, opacity: 0.7 }}
        />
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ background: `${accentColor}18` }}
        >
          {col.icon ?? "📁"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className="text-[13px] font-medium truncate"
              style={{ color: colors.text }}
            >
              {col.name}
            </p>
            {col.isFavorite && (
              <StarIcon className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              {col.documentCount} doc{col.documentCount !== 1 ? "s" : ""}
            </span>
            {col.description && (
              <>
                <span style={{ color: colors.textDim }}>·</span>
                <span
                  className="text-[11px] truncate max-w-[200px]"
                  style={{ color: colors.textDim }}
                >
                  {col.description}
                </span>
              </>
            )}
            {col.tags &&
              col.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-px rounded-md"
                  style={{
                    background: `${accentColor}15`,
                    color: `${accentColor}CC`,
                    border: `1px solid ${accentColor}25`,
                  }}
                >
                  {tag}
                </span>
              ))}
          </div>
        </div>
        <span
          className="text-[11px] shrink-0"
          style={{ color: colors.textDim }}
        >
          {formatDistanceToNow(new Date(col._creationTime), {
            addSuffix: true,
          })}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite({ id: col._id });
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: col.isFavorite ? "#fbbf24" : colors.textDim }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <StarIcon
              className={`w-3.5 h-3.5 ${col.isFavorite ? "fill-amber-400" : ""}`}
            />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: colors.textDim }}
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
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <PencilIcon className="w-3.5 h-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2Icon className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CollectionSkeleton({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div
        className="flex items-center gap-3 px-5 py-3.5 animate-pulse"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <div className="w-1 h-8 rounded-full bg-white/10" />
        <div className="w-8 h-8 rounded-lg bg-white/07 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 rounded w-1/3 bg-white/08" />
          <div className="h-2.5 rounded w-1/5 bg-white/05" />
        </div>
        <div className="h-3 rounded w-20 bg-white/05" />
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl p-4 space-y-3 animate-pulse"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-white/07 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 rounded w-2/3 bg-white/08" />
          <div className="h-2.5 rounded w-1/3 bg-white/05" />
        </div>
      </div>
      <div className="h-3 rounded w-full bg-white/04" />
      <div className="flex gap-1">
        <div className="h-5 rounded-md w-14 bg-white/06" />
        <div className="h-5 rounded-md w-12 bg-white/06" />
      </div>
      <div className="h-1 rounded-full bg-white/06" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CollectionsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const collections = useQuery(
    api.collections.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const createCollection = useMutation(api.collections.create);
  const updateCollection = useMutation(api.collections.update);
  const removeCollection = useMutation(api.collections.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<
    (Doc<"collections"> & { documentCount: number }) | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<
    (Doc<"collections"> & { documentCount: number }) | null
  >(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("favorites");
  const [view, setView] = useState<ViewMode>("grid");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Aggregate all unique tags
  const allTags = useMemo(() => {
    if (!collections) return [];
    const set = new Set<string>();
    collections.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [collections]);

  // Stats
  const totalDocs =
    collections?.reduce((sum, c) => sum + (c as any).documentCount, 0) ?? 0;
  const pinnedCount = collections?.filter((c) => c.isFavorite).length ?? 0;

  const displayCollections = useMemo(() => {
    if (!collections) return [];
    let filtered = [...collections] as (Doc<"collections"> & {
      documentCount: number;
    })[];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.includes(q))
      );
    }

    // Tag filter
    if (activeTag) {
      filtered = filtered.filter((c) => c.tags?.includes(activeTag));
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sort) {
        case "favorites":
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return b._creationTime - a._creationTime;
        case "newest":
          return b._creationTime - a._creationTime;
        case "oldest":
          return a._creationTime - b._creationTime;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "most_docs":
          return b.documentCount - a.documentCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [collections, search, activeTag, sort]);

  const handleCreate = async (data: CollectionFormData) => {
    await createCollection({
      name: data.name,
      description: data.description || undefined,
      icon: data.icon,
      color: data.color,
      tags: data.tags,
      isFavorite: data.isFavorite,
      organizationId: organization?.id,
    });
    toast.success("Collection created");
  };

  const handleEdit = async (data: CollectionFormData) => {
    if (!editTarget) return;
    await updateCollection({
      id: editTarget._id,
      name: data.name,
      description: data.description || undefined,
      icon: data.icon,
      color: data.color,
      tags: data.tags,
      isFavorite: data.isFavorite,
    });
    toast.success("Collection updated");
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeCollection({ id: deleteTarget._id });
      toast.success("Collection deleted");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't delete. Try again.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const isLoading = collections === undefined;

  const SORT_LABELS: Record<SortKey, string> = {
    favorites: "Pinned first",
    newest: "Newest",
    oldest: "Oldest",
    name_asc: "Name A–Z",
    name_desc: "Name Z–A",
    most_docs: "Most docs",
  };

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
            Collections
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5"
              style={{ color: colors.textMuted }}
            >
              {collections?.length ?? 0} collection
              {(collections?.length ?? 0) !== 1 ? "s" : ""}
              {totalDocs > 0 && ` · ${totalDocs} documents total`}
              {pinnedCount > 0 && ` · ${pinnedCount} pinned`}
            </p>
          )}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150"
          style={{
            background: colors.accentBg,
            color: colors.accentPale,
            border: `1px solid ${colors.accentBorder}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.accentBgHover;
            e.currentTarget.style.boxShadow = "0 0 20px rgba(99,102,241,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.accentBg;
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          New collection
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
            placeholder="Search collections…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg outline-none"
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
              <SortAscIcon className="w-3 h-3" />
              {SORT_LABELS[sort]}
              <ChevronDownIcon className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <DropdownMenuItem key={key} onClick={() => setSort(key)}>
                {SORT_LABELS[key]}
                {sort === key && (
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
                background:
                  view === mode ? "rgba(99,102,241,0.2)" : "transparent",
                color: view === mode ? colors.accentLight : colors.textDim,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        {/* Results count */}
        {search && (
          <span className="text-[11px]" style={{ color: colors.textMuted }}>
            {displayCollections.length} result
            {displayCollections.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div
          className="flex items-center gap-1.5 px-6 py-2 overflow-x-auto shrink-0"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-wide shrink-0"
            style={{ color: colors.textDim }}
          >
            Tags
          </span>
          <button
            onClick={() => setActiveTag(null)}
            className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md transition-all"
            style={{
              background:
                activeTag === null
                  ? "rgba(99,102,241,0.2)"
                  : "rgba(255,255,255,0.06)",
              color: activeTag === null ? colors.accentLight : colors.textDim,
              border: `1px solid ${activeTag === null ? colors.accentBorder : "transparent"}`,
            }}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className="shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md transition-all whitespace-nowrap"
              style={{
                background:
                  activeTag === tag
                    ? "rgba(99,102,241,0.2)"
                    : "rgba(255,255,255,0.06)",
                color: activeTag === tag ? colors.accentLight : colors.textDim,
                border: `1px solid ${activeTag === tag ? colors.accentBorder : "transparent"}`,
              }}
            >
              <TagIcon className="w-2.5 h-2.5" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          view === "grid" ? (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CollectionSkeleton key={i} view="grid" />
              ))}
            </div>
          ) : (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <CollectionSkeleton key={i} view="list" />
              ))}
            </div>
          )
        ) : displayCollections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <FolderIcon
                className="w-6 h-6"
                style={{ color: colors.textDim }}
              />
            </div>
            <p
              className="text-sm font-semibold mb-1"
              style={{ color: colors.textSecondary }}
            >
              {search || activeTag
                ? "No collections found"
                : "No collections yet"}
            </p>
            <p
              className="text-[11px] mb-5 max-w-xs"
              style={{ color: colors.textDim }}
            >
              {search
                ? `No results for "${search}".`
                : activeTag
                  ? `No collections tagged "${activeTag}".`
                  : "Organize your documents into collections for easier access."}
            </p>
            {!search && !activeTag && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl"
                style={{
                  background: colors.accentBg,
                  color: colors.accentPale,
                  border: `1px solid ${colors.accentBorder}`,
                }}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                New collection
              </button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="p-6 space-y-6">
            {/* Pinned section */}
            {sort === "favorites" &&
              displayCollections.some((c) => c.isFavorite) && (
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5"
                    style={{ color: "rgba(251,191,36,0.7)" }}
                  >
                    <StarIcon className="w-3 h-3 fill-amber-400 text-amber-400" />
                    Pinned
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayCollections
                      .filter((c) => c.isFavorite)
                      .map((col) => (
                        <CollectionCard
                          key={col._id}
                          col={col}
                          onEdit={() => setEditTarget(col)}
                          onDelete={() => setDeleteTarget(col)}
                        />
                      ))}
                  </div>
                </div>
              )}

            {/* Regular / all */}
            {(sort !== "favorites" ||
              displayCollections.some((c) => !c.isFavorite)) && (
              <div>
                {sort === "favorites" &&
                  displayCollections.some((c) => c.isFavorite) &&
                  displayCollections.some((c) => !c.isFavorite) && (
                    <p
                      className="text-[11px] font-semibold uppercase tracking-widest mb-3"
                      style={{ color: colors.textDim }}
                    >
                      All collections
                    </p>
                  )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(sort === "favorites"
                    ? displayCollections.filter((c) => !c.isFavorite)
                    : displayCollections
                  ).map((col) => (
                    <CollectionCard
                      key={col._id}
                      col={col}
                      onEdit={() => setEditTarget(col)}
                      onDelete={() => setDeleteTarget(col)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {displayCollections.map((col) => (
              <CollectionListRow
                key={col._id}
                col={col}
                onEdit={() => setEditTarget(col)}
                onDelete={() => setDeleteTarget(col)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CollectionFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New collection"
        onSubmit={handleCreate}
      />

      {/* Edit dialog */}
      {editTarget && (
        <CollectionFormDialog
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          title="Edit collection"
          initial={{
            name: editTarget.name,
            description: editTarget.description,
            icon: editTarget.icon,
            color: editTarget.color,
            tags: editTarget.tags,
            isFavorite: editTarget.isFavorite,
          }}
          onSubmit={handleEdit}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete collection?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be permanently deleted.
              <strong className="block mt-1">
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
