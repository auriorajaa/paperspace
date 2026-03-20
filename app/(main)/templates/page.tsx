"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  PlusIcon,
  LayoutTemplateIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  PlayIcon,
  SearchIcon,
  XIcon,
  TagIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  ListIcon,
  FileTextIcon,
  CopyIcon,
  LinkIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Doc } from "@/convex/_generated/dataModel";
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
import Link from "next/link";
import { colors, fieldTypeColors } from "@/lib/design-tokens";

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc" | "most_fields";
type ViewMode = "grid" | "list";

// ── Helpers ───────────────────────────────────────────────────────────────────

function FieldTypeDots({ fields }: { fields: { type: string }[] }) {
  const types = [...new Set(fields.map((f) => f.type))].slice(0, 5);
  return (
    <div className="flex items-center gap-1">
      {types.map((type) => (
        <span
          key={type}
          className="w-2 h-2 rounded-full"
          style={{ background: fieldTypeColors[type] ?? "#6b7280" }}
          title={type}
        />
      ))}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TemplateSkeleton({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div
        className="flex items-center gap-3 px-5 py-3.5 animate-pulse"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <div
          className="w-8 h-8 rounded-lg shrink-0"
          style={{ background: "rgba(99,102,241,0.12)" }}
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
          className="h-6 rounded-lg w-16"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl p-4 space-y-3 animate-pulse"
      style={{
        background: "rgba(99,102,241,0.04)",
        border: "1px solid rgba(99,102,241,0.1)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl shrink-0"
          style={{ background: "rgba(99,102,241,0.12)" }}
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
        className="h-3 rounded w-full"
        style={{ background: "rgba(255,255,255,0.04)" }}
      />
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-5 rounded-md w-14"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <div
          className="h-8 rounded-xl flex-1"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />
        <div
          className="h-8 rounded-xl flex-1"
          style={{ background: "rgba(99,102,241,0.1)" }}
        />
      </div>
    </div>
  );
}

// ── Template Grid Card ────────────────────────────────────────────────────────

function TemplateGridCard({
  template,
  onDelete,
}: {
  template: Doc<"templates"> & { tags?: string[] };
  onDelete: () => void;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  const fieldTypeBreakdown = template.fields.reduce<Record<string, number>>(
    (acc, f) => {
      acc[f.type] = (acc[f.type] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 group transition-all duration-200"
      style={{
        background: hovered ? "rgba(99,102,241,0.07)" : "rgba(99,102,241,0.03)",
        border: `1px solid ${hovered ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.12)"}`,
        boxShadow: hovered
          ? "0 0 0 1px rgba(99,102,241,0.1), 0 8px 24px rgba(0,0,0,0.25)"
          : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.25)",
          }}
        >
          <LayoutTemplateIcon
            className="w-4.5 h-4.5"
            style={{ color: "#818cf8" }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: colors.text }}
          >
            {template.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              {template.fields.length} field
              {template.fields.length !== 1 ? "s" : ""}
            </span>
            <span style={{ color: colors.textDim }}>·</span>
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              {formatDistanceToNow(new Date(template._creationTime), {
                addSuffix: true,
              })}
            </span>
            <FieldTypeDots fields={template.fields} />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ color: colors.textMuted }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
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
              onClick={() => router.push(`/templates/${template._id}/edit`)}
            >
              <PencilIcon className="w-3.5 h-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/templates/${template._id}/fill`)}
            >
              <PlayIcon className="w-3.5 h-3.5 mr-2" />
              Use
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2Icon className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      {template.description && (
        <p
          className="text-[11px] leading-relaxed line-clamp-2"
          style={{ color: colors.textMuted }}
        >
          {template.description}
        </p>
      )}

      {/* Field type breakdown */}
      {template.fields.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(fieldTypeBreakdown).map(([type, count]) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
              style={{
                background: `${fieldTypeColors[type] ?? "#6b7280"}18`,
                color: fieldTypeColors[type] ?? "#6b7280",
                border: `1px solid ${fieldTypeColors[type] ?? "#6b7280"}25`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: fieldTypeColors[type] ?? "#6b7280" }}
              />
              {count} {type}
            </span>
          ))}
        </div>
      )}

      {/* Tags */}
      {template.tags && template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-px rounded-md font-medium"
              style={{
                background: "rgba(129,140,248,0.12)",
                color: "#818cf8",
                border: "1px solid rgba(129,140,248,0.2)",
              }}
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span
              className="text-[10px] px-1"
              style={{ color: colors.textDim }}
            >
              +{template.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => router.push(`/templates/${template._id}/edit`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
          }
        >
          <PencilIcon className="w-3 h-3" />
          Edit
        </button>
        <button
          onClick={() => router.push(`/templates/${template._id}/fill`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "rgba(99,102,241,0.18)",
            color: "#a5b4fc",
            border: "1px solid rgba(99,102,241,0.28)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(99,102,241,0.28)";
            e.currentTarget.style.boxShadow = "0 0 12px rgba(99,102,241,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(99,102,241,0.18)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <PlayIcon className="w-3 h-3" />
          Use
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/templates/${template._id}/connect-form`);
          }}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "rgba(52,211,153,0.07)",
            color: "#34d399",
            border: "1px solid rgba(52,211,153,0.15)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(52,211,153,0.14)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(52,211,153,0.07)")
          }
        >
          <LinkIcon className="w-3 h-3" />
          Connect
        </button>
      </div>
    </div>
  );
}

// ── Template List Row ─────────────────────────────────────────────────────────

function TemplateListRow({
  template,
  onDelete,
}: {
  template: Doc<"templates"> & { tags?: string[] };
  onDelete: () => void;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-3 px-5 py-3.5 cursor-pointer group transition-all duration-150"
      style={{
        borderBottom: `1px solid ${colors.border}`,
        background: hovered ? "rgba(99,102,241,0.04)" : "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: "rgba(99,102,241,0.15)",
          border: "1px solid rgba(99,102,241,0.2)",
        }}
      >
        <LayoutTemplateIcon
          className="w-3.5 h-3.5"
          style={{ color: "#818cf8" }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium truncate"
          style={{ color: colors.text }}
        >
          {template.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px]" style={{ color: colors.textMuted }}>
            {template.fields.length} field
            {template.fields.length !== 1 ? "s" : ""}
          </span>
          <span style={{ color: colors.textDim }}>·</span>
          <FieldTypeDots fields={template.fields} />
          {template.description && (
            <>
              <span style={{ color: colors.textDim }}>·</span>
              <span
                className="text-[11px] truncate max-w-[180px]"
                style={{ color: colors.textDim }}
              >
                {template.description}
              </span>
            </>
          )}
          {template.tags &&
            template.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-px rounded-md"
                style={{
                  background: "rgba(129,140,248,0.12)",
                  color: "#818cf8",
                  border: "1px solid rgba(129,140,248,0.2)",
                }}
              >
                {tag}
              </span>
            ))}
        </div>
      </div>

      <span className="text-[11px] shrink-0" style={{ color: colors.textDim }}>
        {formatDistanceToNow(new Date(template._creationTime), {
          addSuffix: true,
        })}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => router.push(`/templates/${template._id}/fill`)}
          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
          style={{
            background: "rgba(99,102,241,0.15)",
            color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <PlayIcon className="w-3 h-3" />
          Use
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
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
              onClick={() => router.push(`/templates/${template._id}/edit`)}
            >
              <PencilIcon className="w-3.5 h-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2Icon className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const templates = useQuery(
    api.templates.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const removeTemplate = useMutation(api.templates.remove);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"templates"> | null>(
    null
  );

  const allTags = useMemo(() => {
    if (!templates) return [];
    const set = new Set<string>();
    templates.forEach((t) =>
      (t as any).tags?.forEach((tag: string) => set.add(tag))
    );
    return [...set].sort();
  }, [templates]);

  const displayTemplates = useMemo(() => {
    if (!templates) return [];
    let filtered = [...templates] as (Doc<"templates"> & { tags?: string[] })[];

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          (t as any).tags?.some((tag: string) => tag.includes(q))
      );
    }

    if (activeTag) {
      filtered = filtered.filter((t) => (t as any).tags?.includes(activeTag));
    }

    filtered.sort((a, b) => {
      switch (sort) {
        case "newest":
          return b._creationTime - a._creationTime;
        case "oldest":
          return a._creationTime - b._creationTime;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "most_fields":
          return b.fields.length - a.fields.length;
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, search, activeTag, sort]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeTemplate({ id: deleteTarget._id });
      toast.success("Template deleted");
    } catch {
      toast.error("Couldn't delete. Try again.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const SORT_LABELS: Record<SortKey, string> = {
    newest: "Newest",
    oldest: "Oldest",
    name_asc: "Name A–Z",
    name_desc: "Name Z–A",
    most_fields: "Most fields",
  };

  const isLoading = templates === undefined;
  const totalFields =
    templates?.reduce((sum, t) => sum + t.fields.length, 0) ?? 0;

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
            Templates
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5"
              style={{ color: colors.textMuted }}
            >
              {templates?.length ?? 0} template
              {(templates?.length ?? 0) !== 1 ? "s" : ""}
              {totalFields > 0 && ` · ${totalFields} fields total`}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push("/templates/new")}
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
          New template
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
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <SearchIcon
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: colors.textDim }}
          />
          <input
            placeholder="Search templates…"
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

        {search && (
          <span className="text-[11px]" style={{ color: colors.textMuted }}>
            {displayTemplates.length} result
            {displayTemplates.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tag filter */}
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
                <TemplateSkeleton key={i} view="grid" />
              ))}
            </div>
          ) : (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <TemplateSkeleton key={i} view="list" />
              ))}
            </div>
          )
        ) : displayTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.15)",
              }}
            >
              <LayoutTemplateIcon
                className="w-6 h-6"
                style={{ color: "#818cf8" }}
              />
            </div>
            <p
              className="text-sm font-semibold mb-1"
              style={{ color: colors.textSecondary }}
            >
              {search || activeTag ? "No templates found" : "No templates yet"}
            </p>
            <p
              className="text-[11px] mb-5 max-w-xs leading-relaxed"
              style={{ color: colors.textDim }}
            >
              {search
                ? `No results for "${search}".`
                : activeTag
                  ? `No templates tagged "${activeTag}".`
                  : "Upload a .docx file with {{placeholders}} to create your first template."}
            </p>
            {!search && !activeTag && (
              <button
                onClick={() => router.push("/templates/new")}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl"
                style={{
                  background: colors.accentBg,
                  color: colors.accentPale,
                  border: `1px solid ${colors.accentBorder}`,
                }}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                New template
              </button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayTemplates.map((t) => (
              <TemplateGridCard
                key={t._id}
                template={t}
                onDelete={() => setDeleteTarget(t)}
              />
            ))}
          </div>
        ) : (
          <div>
            {displayTemplates.map((t) => (
              <TemplateListRow
                key={t._id}
                template={t}
                onDelete={() => setDeleteTarget(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be permanently deleted.
              This cannot be undone.
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
