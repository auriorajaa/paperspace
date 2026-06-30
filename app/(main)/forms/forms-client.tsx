"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  PlusIcon,
  GlobeIcon,
  LockIcon,
  ArchiveIcon,
  Trash2Icon,
  EyeIcon,
  FileEditIcon,
  CopyIcon,
  SearchIcon,
  BuildingIcon,
  ClockIcon,
  ChevronDownIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
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

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title_asc", label: "A → Z" },
  { value: "title_desc", label: "Z → A" },
] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
] as const;

export default function FormsListPage({ orgId }: { orgId?: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const forms = useQuery(
    api.internalForms.getAll,
    isLoaded && isSignedIn ? { orgId } : "skip"
  );
  const publish = useMutation(api.internalForms.publish);
  const archive = useMutation(api.internalForms.archive);
  const remove = useMutation(api.internalForms.remove);

  const [removingId, setRemovingId] = useState<Id<"internalForms"> | null>(
    null
  );
  const [removing, setRemoving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isLoading = forms === undefined;
  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://paperspace.work";

  const filteredForms = useMemo(() => {
    if (!forms) return [];
    let result = [...forms];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f: any) =>
          f.title.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((f: any) => f.status === statusFilter);
    }

    switch (sortBy) {
      case "oldest":
        result.sort((a: any, b: any) => a._creationTime - b._creationTime);
        break;
      case "title_asc":
        result.sort((a: any, b: any) => a.title.localeCompare(b.title));
        break;
      case "title_desc":
        result.sort((a: any, b: any) => b.title.localeCompare(a.title));
        break;
      default:
        result.sort((a: any, b: any) => b._creationTime - a._creationTime);
    }

    return result;
  }, [forms, searchQuery, sortBy, statusFilter]);

  const handleCopyLink = (publicId: string) => {
    navigator.clipboard.writeText(`${siteUrl}/f/${publicId}`);
    toast.success("Public link copied");
  };

  const handleRemove = async () => {
    if (!removingId) return;
    setRemoving(true);
    try {
      await remove({ id: removingId });
      toast.success("Form deleted");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete form");
    } finally {
      setRemoving(false);
      setRemovingId(null);
    }
  };

  const handlePublish = async (id: Id<"internalForms">) => {
    try {
      await publish({ id });
      toast.success("Form published");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to publish form");
    }
  };

  const handleArchive = async (id: Id<"internalForms">) => {
    try {
      await archive({ id });
      toast.success("Form archived");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to archive form");
    }
  };

  const hasFilters = !!(searchQuery || statusFilter !== "all");

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* ── Page header ── */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div>
          <h1
            className="text-[15px] sm:text-base font-semibold"
            style={{ color: "var(--text)" }}
          >
            Forms
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {forms?.length ?? 0} form{(forms?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() =>
            router.push(`/forms/new${orgId ? `?orgId=${orgId}` : ""}`)
          }
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0"
          style={{
            background: "var(--accent-bg)",
            color: "var(--accent-pale)",
            border: "1px solid var(--accent-border)",
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
          <span className="hidden sm:inline">New form</span>
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
        {/* Row 1: search */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "var(--text-dim)" }}
            />
            <input
              placeholder="Search forms"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-dim)" }}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 h-9 px-4 py-2.5 rounded-xl text-[11px] font-medium shrink-0 whitespace-nowrap"
                style={{
                  background: "var(--bg-muted)",
                  border: `1px solid var(--border-subtle)`,
                  color: "var(--text-muted)",
                }}
              >
                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                <ChevronDownIcon className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                >
                  {sortBy === opt.value && (
                    <CheckIcon
                      className="w-3 h-3 mr-2"
                      style={{ color: "var(--accent-light)" }}
                    />
                  )}
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2: sort + status filter tabs */}
        <div
          className="flex items-center gap-2 px-4 sm:px-6 pb-2.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {/* Status filter pill-tabs — same pill style as scope tabs in templates */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl shrink-0"
            style={{
              background: "var(--bg-muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap"
                style={{
                  background:
                    statusFilter === f.value
                      ? "rgba(99,102,241,0.18)"
                      : "transparent",
                  color:
                    statusFilter === f.value
                      ? "var(--accent-light)"
                      : "var(--text-muted)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active-filter strip ── */}
      {hasFilters && !isLoading && (
        <div
          className="flex items-center gap-2 px-4 sm:px-6 py-2 shrink-0 flex-wrap"
          style={{
            borderBottom: `1px solid var(--border-subtle)`,
            background: "var(--bg-muted)",
          }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            {filteredForms.length} result
            {filteredForms.length !== 1 ? "s" : ""}
          </span>

          {searchQuery && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-muted)",
              }}
            >
              &ldquo;{searchQuery}&rdquo;
              <button onClick={() => setSearchQuery("")}>
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}

          {statusFilter !== "all" && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-light)",
              }}
            >
              {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}
              <button onClick={() => setStatusFilter("all")}>
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="text-[11px] ml-auto"
            style={{ color: "var(--text-dim)" }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-4 animate-pulse"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  height: 160,
                }}
              >
                <div
                  className="h-4 w-3/4 rounded mb-3"
                  style={{ background: "var(--bg-muted)" }}
                />
                <div
                  className="h-3 w-full rounded mb-2"
                  style={{ background: "var(--bg-muted)" }}
                />
                <div
                  className="h-3 w-1/2 rounded"
                  style={{ background: "var(--bg-muted)" }}
                />
              </div>
            ))}
          </div>
        ) : forms.length === 0 && !searchQuery && statusFilter === "all" ? (
          /* ── Empty state ── */
          <div
            className="flex flex-col items-center justify-center py-24 px-4 text-center rounded-xl"
            style={{ border: "1px dashed var(--border-subtle)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.15)",
              }}
            >
              <FileEditIcon
                className="w-6 h-6"
                style={{ color: "var(--accent-light)" }}
              />
            </div>
            <p
              className="text-[14px] font-semibold mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              No forms yet
            </p>
            <p
              className="text-[12px] mb-6 max-w-[260px] leading-relaxed"
              style={{ color: "var(--text-dim)" }}
            >
              Create a form to collect responses and generate documents
              automatically.
            </p>
            <button
              onClick={() =>
                router.push(`/forms/new${orgId ? `?orgId=${orgId}` : ""}`)
              }
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-xl"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-pale)",
                border: `1px solid var(--accent-border)`,
              }}
            >
              <PlusIcon className="w-3.5 h-3.5" /> New form
            </button>
          </div>
        ) : filteredForms.length === 0 ? (
          /* ── No-results state ── */
          <div
            className="flex flex-col items-center justify-center py-24 px-4 text-center rounded-xl"
            style={{ border: "1px dashed var(--border-subtle)" }}
          >
            <p
              className="text-[14px] font-semibold mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              No forms found
            </p>
            <p
              className="text-[12px] mb-6"
              style={{ color: "var(--text-dim)" }}
            >
              {searchQuery
                ? `No results for "${searchQuery}".`
                : `No ${statusFilter} forms yet.`}
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="text-[13px] font-medium px-4 py-2 rounded-xl"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* ── Forms grid ── */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredForms.map((form: any) => (
              <div
                key={form._id}
                className="rounded-2xl p-4 flex flex-col gap-3 transition-shadow"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {form.isOrgForm && (
                        <span title="Organization form">
                          <BuildingIcon
                            className="w-3 h-3 shrink-0"
                            style={{ color: "var(--accent-light)" }}
                          />
                        </span>
                      )}
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {form.title || "Untitled"}
                      </p>
                    </div>
                    {form.description && (
                      <p
                        className="text-xs mt-0.5 line-clamp-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {form.description}
                      </p>
                    )}
                  </div>
                  <span
                    className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      background:
                        form.status === "published"
                          ? "var(--success-bg)"
                          : form.status === "archived"
                            ? "var(--bg-input)"
                            : "var(--warning-bg)",
                      color:
                        form.status === "published"
                          ? "var(--success)"
                          : form.status === "archived"
                            ? "var(--text-dim)"
                            : "var(--warning)",
                    }}
                  >
                    {form.status === "published" ? (
                      <GlobeIcon className="w-2.5 h-2.5" />
                    ) : (
                      <LockIcon className="w-2.5 h-2.5" />
                    )}
                    {form.status}
                  </span>
                </div>

                <div
                  className="flex items-center gap-3 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span>
                    {form.responseCount ?? 0} response
                    {form.responseCount !== 1 ? "s" : ""}
                  </span>
                  <span style={{ color: "var(--text-dim)" }}>
                    {form.connectionCount ?? 0} template
                    {form.connectionCount !== 1 ? "s" : ""}
                  </span>
                </div>

                <div
                  className="flex items-center gap-2 text-[10px]"
                  style={{ color: "var(--text-dim)" }}
                >
                  <ClockIcon className="w-2.5 h-2.5" />
                  <span>
                    {formatDistanceToNow(new Date(form._creationTime), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                  <button
                    onClick={() =>
                      router.push(
                        `/forms/${form._id}/builder${orgId ? `?orgId=${orgId}` : ""}`
                      )
                    }
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
                    style={{
                      background: "var(--accent-bg)",
                      color: "var(--accent-light)",
                      border: "1px solid var(--accent-border)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--accent-bg-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "var(--accent-bg)")
                    }
                  >
                    <FileEditIcon className="w-3 h-3" />
                    Edit
                  </button>

                  <button
                    onClick={() => router.push(`/forms/${form._id}/responses`)}
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
                    style={{
                      background: "var(--bg-muted)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-input)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "var(--bg-muted)")
                    }
                  >
                    <EyeIcon className="w-3 h-3" />
                    Responses
                  </button>

                  {form.status === "published" && (
                    <button
                      onClick={() => handleCopyLink(form.publicId)}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
                      style={{
                        background: "var(--bg-muted)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-subtle)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg-input)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "var(--bg-muted)")
                      }
                    >
                      <CopyIcon className="w-3 h-3" />
                      Copy link
                    </button>
                  )}

                  {form.status === "draft" && (
                    <button
                      onClick={() => handlePublish(form._id)}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
                      style={{
                        background: "var(--success-bg)",
                        color: "var(--success)",
                        border:
                          "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
                      }}
                    >
                      <GlobeIcon className="w-3 h-3" />
                      Publish
                    </button>
                  )}

                  {form.status === "published" && (
                    <button
                      onClick={() => handleArchive(form._id)}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
                      style={{
                        background: "var(--warning-bg)",
                        color: "var(--warning)",
                        border:
                          "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
                      }}
                    >
                      <ArchiveIcon className="w-3 h-3" />
                      Archive
                    </button>
                  )}

                  <button
                    onClick={() =>
                      setRemovingId(form._id as Id<"internalForms">)
                    }
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
                    style={{
                      color: "var(--danger)",
                      border:
                        "1px solid color-mix(in srgb, var(--danger) 15%, transparent)",
                    }}
                  >
                    <Trash2Icon className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!removingId}
        onOpenChange={(open) => {
          if (!open) setRemovingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the form, all responses, and
              connected template mappings. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
