// app\(main)\collections\collection-client.tsx
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
  CheckIcon,
  LayoutGridIcon,
  ListIcon,
} from "lucide-react";
import { differenceInHours, format, formatDistanceToNow } from "date-fns";
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
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { COLLECTION_ICONS, getIconComponent } from "@/lib/collection-icons";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function smartDate(ts: number): string {
  if (differenceInHours(Date.now(), ts) < 24)
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  return format(new Date(ts), "MMM d, yyyy");
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Green", value: "#22c55e" },
  { label: "Yellow", value: "#eab308" },
  { label: "Orange", value: "#f97316" },
  { label: "Red", value: "#ef4444" },
  { label: "Pink", value: "#ec4899" },
  { label: "Purple", value: "#a855f7" },
  { label: "Slate", value: "#64748b" },
];

type SortKey =
  | "favorites"
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "most_docs";
type ViewMode = "grid" | "list";

// ─────────────────────────────────────────────────────────────────────────────
// Collection form dialog
// ─────────────────────────────────────────────────────────────────────────────

interface CollectionFormData {
  name: string;
  description: string;
  iconKey: string;
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
    iconKey: initial?.iconKey ?? "folder",
    color: initial?.color ?? "#6366f1",
    tags: initial?.tags ?? [],
    isFavorite: initial?.isFavorite ?? false,
  });
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

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

  const CurrentIcon = getIconComponent(form.iconKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Icon + Name row */}
          <div className="flex gap-3 items-start">
            {/* Icon button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowIconPicker((v) => !v)}
                className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                style={{
                  background: `${form.color}20`,
                  border: `2px solid ${form.color}40`,
                }}
                title="Choose icon"
              >
                <CurrentIcon
                  className="w-6 h-6"
                  style={{ color: form.color }}
                />
              </button>
              {showIconPicker && (
                <div
                  className="absolute top-14 left-0 z-50 rounded-2xl p-3 shadow-2xl"
                  style={{
                    background: "var(--bg-card)",
                    border: `1px solid var(--border-subtle)`,
                    width: 280,
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Choose icon
                  </p>
                  <div className="grid grid-cols-7 gap-1">
                    {COLLECTION_ICONS.map(({ Icon, key, label }) => (
                      <button
                        key={key}
                        type="button"
                        title={label}
                        onClick={() => {
                          setForm((f) => ({ ...f, iconKey: key }));
                          setShowIconPicker(false);
                        }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                        style={{
                          background:
                            form.iconKey === key
                              ? `${form.color}25`
                              : "transparent",
                          border: `1px solid ${form.iconKey === key ? form.color + "60" : "transparent"}`,
                        }}
                        onMouseEnter={(e) => {
                          if (form.iconKey !== key)
                            e.currentTarget.style.background =
                              "var(--bg-input)";
                        }}
                        onMouseLeave={(e) => {
                          if (form.iconKey !== key)
                            e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{
                            color:
                              form.iconKey === key
                                ? form.color
                                : "var(--text-muted)",
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1.5">
              <Label
                className="text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                Name <span className="text-red-400">*</span>
              </Label>
              <input
                placeholder="My collection"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none"
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
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              Description
            </Label>
            <textarea
              placeholder="What's this collection for?"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none resize-none"
              style={{
                background: "var(--bg-muted)",
                border: `1px solid var(--border-subtle)`,
                color: "var(--text)",
              }}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              Accent color
            </Label>
            <div className="flex gap-2.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    background: c.value,
                    outline:
                      form.color === c.value
                        ? `2.5px solid ${c.value}`
                        : "none",
                    outlineOffset: "3px",
                    transform:
                      form.color === c.value ? "scale(1.2)" : "scale(1)",
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              Tags
            </Label>
            <div
              className="flex flex-wrap gap-1.5 p-2.5 rounded-xl min-h-[44px] cursor-text"
              style={{
                background: "var(--bg-muted)",
                border: `1px solid var(--border-subtle)`,
              }}
              onClick={(e) => {
                (
                  e.currentTarget.querySelector("input") as HTMLInputElement
                )?.focus();
              }}
            >
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                  style={{ background: `${form.color}20`, color: form.color }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:opacity-60 leading-none"
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
                className="flex-1 min-w-[100px] text-[12px] bg-transparent outline-none"
                style={{ color: "var(--text)" }}
              />
            </div>
          </div>

          {/* Pin to top */}
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({ ...f, isFavorite: !f.isFavorite }))
            }
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
            style={{
              background: form.isFavorite
                ? "rgba(251,191,36,0.1)"
                : "var(--bg-muted)",
              border: `1px solid ${form.isFavorite ? "rgba(251,191,36,0.3)" : "var(--border-subtle)"}`,
              color: form.isFavorite ? "#fbbf24" : "var(--text-muted)",
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
            className="px-4 py-2 rounded-xl text-[13px] font-medium"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-[13px] font-medium transition-all"
            style={{
              background: "var(--accent-bg)",
              color: "var(--accent-light)",
              border: `1px solid var(--accent-border)`,
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--accent-light)" }}
                />
                Saving…
              </span>
            ) : (
              "Save collection"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection grid card
// ─────────────────────────────────────────────────────────────────────────────

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
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const accent = col.color ?? "#6366f1";
  const ColIcon = getIconComponent(col.icon ?? "folder");
  const tags = col.tags ?? [];
  const visibleTags = tagsExpanded ? tags : tags.slice(0, 3);
  const overflowCount = tags.length - 3;

  return (
    <Link href={`/collections/${col._id}`} className="block h-full">
      <div
        className="rounded-2xl flex flex-col overflow-hidden h-full transition-all duration-200 cursor-pointer"
        style={{
          background: hovered ? "var(--bg-card-hover)" : "var(--bg-card)",
          border: `1px solid ${hovered ? "var(--border-hover)" : "var(--border-subtle)"}`,
          boxShadow: hovered ? "var(--shadow-elevated)" : "none",
          transform: "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Accent top bar */}
        {/* <div className="h-1 w-full shrink-0" style={{ background: accent }} /> */}

        <div className="flex flex-col gap-3 p-4 flex-1">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `${accent}18`,
                border: `1px solid ${accent}28`,
              }}
            >
              <ColIcon className="w-5 h-5" style={{ color: accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p
                  className="text-[13px] font-semibold truncate"
                  style={{ color: "var(--text)" }}
                >
                  {col.name}
                </p>
                {col.isFavorite && (
                  <StarIcon className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" />
                )}
              </div>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {col.documentCount} paper{col.documentCount !== 1 ? "s" : ""} ·{" "}
                {smartDate(col._creationTime)}
              </p>
            </div>
            {/* Actions — always visible on mobile, hover on desktop */}
            <div
              className="flex items-center gap-0.5 shrink-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavorite({ id: col._id });
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  color: col.isFavorite ? "#fbbf24" : "var(--text-dim)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-input)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
                title={col.isFavorite ? "Unpin" : "Pin"}
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
                    style={{
                      background: "var(--bg-input)",
                      border: `1px solid var(--border-subtle)`,
                      color: "var(--text-dim)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--border-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "var(--bg-input)")
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
              style={{ color: "var(--text-muted)" }}
            >
              {col.description}
            </p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div
              className="flex flex-wrap gap-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{
                    background: `${accent}15`,
                    color: accent + "CC",
                    border: `1px solid ${accent}25`,
                  }}
                >
                  {tag}
                </span>
              ))}
              {!tagsExpanded && overflowCount > 0 && (
                <button
                  onClick={() => setTagsExpanded(true)}
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-colors"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-dim)",
                    border: `1px solid var(--border-subtle)`,
                  }}
                >
                  +{overflowCount}
                </button>
              )}
            </div>
          )}

          {/* Footer: capacity bar */}
          <div className="mt-auto pt-1 flex items-center gap-2">
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ background: "var(--bg-input)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width:
                    col.documentCount > 0
                      ? `${Math.min(100, col.documentCount * 8)}%`
                      : "0%",
                  background: accent,
                  opacity: 0.65,
                }}
              />
            </div>
            <span
              className="text-[10px] font-medium tabular-nums shrink-0"
              style={{ color: accent + "99" }}
            >
              {col.documentCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection list row
// ─────────────────────────────────────────────────────────────────────────────

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
  const accent = col.color ?? "#6366f1";
  const ColIcon = getIconComponent(col.icon ?? "folder");
  const tags = col.tags ?? [];

  return (
    <Link href={`/collections/${col._id}`} className="block">
      <div
        className="flex items-center gap-3 px-4 sm:px-5 cursor-pointer transition-all duration-150"
        style={{
          borderBottom: `1px solid var(--border-subtle)`,
          background: hovered ? "var(--bg-card-hover)" : "transparent",
          minHeight: 60,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="w-1 h-8 rounded-full shrink-0"
          style={{ background: accent, opacity: 0.7 }}
        />
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}18` }}
        >
          <ColIcon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className="text-[13px] font-semibold truncate"
              style={{ color: "var(--text)" }}
            >
              {col.name}
            </p>
            {col.isFavorite && (
              <StarIcon className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {col.documentCount} paper{col.documentCount !== 1 ? "s" : ""}
            </span>
            {col.description && (
              <>
                <span style={{ color: "var(--text-dim)" }}>·</span>
                <span
                  className="text-[11px] truncate max-w-[160px] sm:max-w-[220px]"
                  style={{ color: "var(--text-dim)" }}
                >
                  {col.description}
                </span>
              </>
            )}
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-px rounded-md hidden sm:inline-block"
                style={{
                  background: `${accent}15`,
                  color: `${accent}CC`,
                  border: `1px solid ${accent}25`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <span
          className="hidden sm:block text-[11px] tabular-nums shrink-0"
          style={{ color: "var(--text-dim)" }}
        >
          {smartDate(col._creationTime)}
        </span>
        {/* Always-visible actions */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            onClick={() => toggleFavorite({ id: col._id })}
            className="hidden sm:flex w-7 h-7 rounded-lg items-center justify-center transition-colors"
            style={{ color: col.isFavorite ? "#fbbf24" : "var(--text-dim)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-input)")
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
                style={{
                  background: "var(--bg-input)",
                  border: `1px solid var(--border-subtle)`,
                  color: "var(--text-dim)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-input)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "var(--bg-input)")
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
      <div className="h-1 w-full" style={{ background: "var(--bg-input)" }} />
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl shrink-0"
            style={{ background: "var(--bg-input)" }}
          />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3.5 rounded w-2/3"
              style={{ background: "var(--bg-input)" }}
            />
            <div
              className="h-2.5 rounded w-1/3"
              style={{ background: "var(--bg-muted)" }}
            />
          </div>
        </div>
        <div
          className="h-2.5 rounded w-full"
          style={{ background: "var(--bg-muted)" }}
        />
        <div className="flex gap-1">
          <div
            className="h-4 rounded-md w-14"
            style={{ background: "var(--bg-input)" }}
          />
          <div
            className="h-4 rounded-md w-10"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
        <div
          className="h-1 rounded-full"
          style={{ background: "var(--bg-input)" }}
        />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div
      className="flex items-center gap-3 px-4 sm:px-5 py-3 animate-pulse"
      style={{ borderBottom: `1px solid var(--border-subtle)`, minHeight: 60 }}
    >
      <div
        className="w-1 h-8 rounded-full shrink-0"
        style={{ background: "var(--bg-input)" }}
      />
      <div
        className="w-9 h-9 rounded-xl shrink-0"
        style={{ background: "var(--bg-input)" }}
      />
      <div className="flex-1 space-y-1.5">
        <div
          className="h-3.5 rounded w-1/3"
          style={{ background: "var(--bg-input)" }}
        />
        <div
          className="h-2.5 rounded w-1/5"
          style={{ background: "var(--bg-muted)" }}
        />
      </div>
      <div
        className="hidden sm:block h-3 rounded w-20"
        style={{ background: "var(--bg-muted)" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

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

  const allTags = useMemo(() => {
    if (!collections) return [];
    const set = new Set<string>();
    collections.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [collections]);

  const totalPapers =
    (collections as any[])?.reduce(
      (sum: number, c: any) => sum + (c.documentCount ?? 0),
      0
    ) ?? 0;
  const pinnedCount = collections?.filter((c) => c.isFavorite).length ?? 0;

  const displayCollections = useMemo(() => {
    if (!collections) return [];
    let filtered = [
      ...(collections as (Doc<"collections"> & { documentCount: number })[]),
    ];

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.includes(q))
      );
    }
    if (activeTag)
      filtered = filtered.filter((c) => c.tags?.includes(activeTag));

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
      icon: data.iconKey,
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
      icon: data.iconKey,
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

  const SORT_LABELS: Record<SortKey, string> = {
    favorites: "Pinned first",
    newest: "Newest",
    oldest: "Oldest",
    name_asc: "A → Z",
    name_desc: "Z → A",
    most_docs: "Most papers",
  };

  const isLoading = collections === undefined;
  const pinnedCols = displayCollections.filter((c) => c.isFavorite);
  const regularCols = displayCollections.filter((c) => !c.isFavorite);
  const showSections =
    sort === "favorites" && pinnedCols.length > 0 && regularCols.length > 0;

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
            Collections
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap"
              style={{ color: "var(--text-muted)" }}
            >
              <span>
                {collections?.length ?? 0} collection
                {(collections?.length ?? 0) !== 1 ? "s" : ""}
              </span>
              {totalPapers > 0 && (
                <>
                  <span style={{ color: "var(--text-dim)" }}>·</span>
                  <span>{totalPapers} papers total</span>
                </>
              )}
              {pinnedCount > 0 && (
                <>
                  <span style={{ color: "var(--text-dim)" }}>·</span>
                  <span style={{ color: "#fbbf24" }}>{pinnedCount} pinned</span>
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0"
          style={{
            background: "var(--accent-bg)",
            color: "var(--accent-pale)",
            border: `1px solid var(--accent-border)`,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent-bg-hover)";
            e.currentTarget.style.boxShadow = "0 0 20px rgba(99,102,241,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--accent-bg)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New collection</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div
        className="shrink-0"
        style={{
          borderBottom: `1px solid var(--border-subtle)`,
          background: "var(--bg-muted)",
        }}
      >
        {/* Row 1: search + view */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "var(--text-dim)" }}
            />
            <input
              placeholder="Search collections…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl outline-none"
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
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl shrink-0"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
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
                  background:
                    view === v ? "rgba(99,102,241,0.2)" : "transparent",
                  color: view === v ? "var(--accent-light)" : "var(--text-dim)",
                }}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
        {/* Row 2: sort + tag filters — scrollable */}
        <div
          className="flex items-center gap-2 px-4 sm:px-6 pb-2.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
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

          {allTags.length > 0 && (
            <>
              <div
                className="w-px h-4 shrink-0"
                style={{ background: "var(--bg-input)" }}
              />
              <button
                onClick={() => setActiveTag(null)}
                className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-xl transition-all whitespace-nowrap"
                style={{
                  background:
                    activeTag === null
                      ? "rgba(99,102,241,0.2)"
                      : "var(--bg-muted)",
                  color:
                    activeTag === null
                      ? "var(--accent-light)"
                      : "var(--text-dim)",
                  border: `1px solid ${activeTag === null ? "var(--accent-border)" : "transparent"}`,
                }}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-xl transition-all whitespace-nowrap"
                  style={{
                    background:
                      activeTag === tag
                        ? "rgba(99,102,241,0.2)"
                        : "var(--bg-muted)",
                    color:
                      activeTag === tag
                        ? "var(--accent-light)"
                        : "var(--text-dim)",
                    border: `1px solid ${activeTag === tag ? "var(--accent-border)" : "transparent"}`,
                  }}
                >
                  <TagIcon className="w-2.5 h-2.5" />
                  {tag}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          view === "grid" ? (
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <GridSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <ListSkeleton key={i} />
              ))}
            </div>
          )
        ) : displayCollections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--bg-muted)" }}
            >
              <FolderIcon
                className="w-6 h-6"
                style={{ color: "var(--text-dim)" }}
              />
            </div>
            <p
              className="text-[14px] font-semibold mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {search || activeTag
                ? "No collections found"
                : "No collections yet"}
            </p>
            <p
              className="text-[12px] mb-6 max-w-[240px] leading-relaxed"
              style={{ color: "var(--text-dim)" }}
            >
              {search
                ? `No results for "${search}".`
                : activeTag
                  ? `No collections tagged "${activeTag}".`
                  : "Organise your papers into collections for easier access."}
            </p>
            {!search && !activeTag && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-xl"
                style={{
                  background: "var(--accent-bg)",
                  color: "var(--accent-pale)",
                  border: `1px solid var(--accent-border)`,
                }}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                New collection
              </button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="p-4 sm:p-6 space-y-6 pb-[calc(1rem+env(safe-area-inset-bottom)+52px)] md:pb-6">
            {showSections ? (
              <>
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5"
                    style={{ color: "rgba(251,191,36,0.7)" }}
                  >
                    <StarIcon className="w-3 h-3 fill-amber-400 text-amber-400" />
                    Pinned
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                    {pinnedCols.map((col) => (
                      <CollectionCard
                        key={col._id}
                        col={col}
                        onEdit={() => setEditTarget(col)}
                        onDelete={() => setDeleteTarget(col)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                    style={{ color: "var(--text-dim)" }}
                  >
                    All collections
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                    {regularCols.map((col) => (
                      <CollectionCard
                        key={col._id}
                        col={col}
                        onEdit={() => setEditTarget(col)}
                        onDelete={() => setDeleteTarget(col)}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                {displayCollections.map((col) => (
                  <CollectionCard
                    key={col._id}
                    col={col}
                    onEdit={() => setEditTarget(col)}
                    onDelete={() => setDeleteTarget(col)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="pb-[calc(env(safe-area-inset-bottom)+52px)] md:pb-0">
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

      {/* Dialogs */}
      <CollectionFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New collection"
        onSubmit={handleCreate}
      />
      {editTarget && (
        <CollectionFormDialog
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          title="Edit collection"
          initial={{
            name: editTarget.name,
            description: editTarget.description,
            iconKey: editTarget.icon ?? "folder",
            color: editTarget.color,
            tags: editTarget.tags,
            isFavorite: editTarget.isFavorite,
          }}
          onSubmit={handleEdit}
        />
      )}
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
