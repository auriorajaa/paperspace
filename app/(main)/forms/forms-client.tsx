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
  SlidersHorizontalIcon,
  BuildingIcon,
  ClockIcon,
  ChevronDownIcon,
  CheckIcon,
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
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title_asc", label: "Title A-Z" },
  { value: "title_desc", label: "Title Z-A" },
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

  const [removingId, setRemovingId] = useState<Id<"internalForms"> | null>(null);
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

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
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
          {/* <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Create and manage internal web forms
          </p> */}
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
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--accent-bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--accent-bg)")
          }
        >
          <PlusIcon className="w-3.5 h-3.5" />
          New form
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="grid gap-1.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    width: 320,
                    height: 140,
                  }}
                >
                  <div
                    className="h-4 w-3/4 rounded animate-pulse mb-3"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div
                    className="h-3 w-full rounded animate-pulse mb-2"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div
                    className="h-3 w-1/2 rounded animate-pulse"
                    style={{ background: "var(--bg-muted)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : forms.length === 0 && !searchQuery ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            style={{ border: "1px dashed var(--border-subtle)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <FileEditIcon
                className="w-6 h-6"
                style={{ color: "var(--text-dim)" }}
              />
            </div>
            <p
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              No forms yet
            </p>
            <p
              className="text-xs mb-5 max-w-xs"
              style={{ color: "var(--text-dim)" }}
            >
              Create a form to collect responses and generate documents
              automatically.
            </p>
            <button
              onClick={() =>
                router.push(`/forms/new${orgId ? `?orgId=${orgId}` : ""}`)
              }
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Create form
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-6 max-w-6xl">
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 min-w-0"
                style={{
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <SearchIcon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "var(--text-dim)" }}
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search forms..."
                  className="flex-1 bg-transparent text-sm outline-none min-w-0"
                  style={{ color: "var(--text)" }}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <div
                  className="flex rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border-subtle)" }}
                >
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setStatusFilter(f.value)}
                      className="text-[11px] font-medium px-3 py-2 transition-all min-h-[36px]"
                      style={{
                        background:
                          statusFilter === f.value
                            ? "var(--accent-bg)"
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-1 px-3 py-2 min-h-[36px] rounded-xl text-[11px] font-medium shrink-0 whitespace-nowrap"
                      style={{
                        background: "var(--bg-muted)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <SlidersHorizontalIcon className="w-3 h-3" />
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
            </div>

            {filteredForms.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 text-center rounded-xl"
                style={{ border: "1px dashed var(--border-subtle)" }}
              >
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  No forms match your search
                </p>
                <p
                  className="text-xs mb-4"
                  style={{ color: "var(--text-dim)" }}
                >
                  Try adjusting your search or filters.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px]"
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-8xl">
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
                      >
                        <FileEditIcon className="w-3 h-3" />
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          router.push(`/forms/${form._id}/responses`)
                        }
                        className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
                        style={{
                          background: "var(--bg-muted)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border-subtle)",
                        }}
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
          </>
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
              {removing ? "Deleting\u2026" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
