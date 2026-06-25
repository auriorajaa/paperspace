"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  ExternalLinkIcon,
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

export default function FormsListPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const forms = useQuery(
    api.internalForms.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const publish = useMutation(api.internalForms.publish);
  const archive = useMutation(api.internalForms.archive);
  const remove = useMutation(api.internalForms.remove);

  const [removingId, setRemovingId] = useState<Id<"internalForms"> | null>(
    null
  );
  const [removing, setRemoving] = useState(false);

  const isLoading = forms === undefined;
  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://paperspace.work";

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
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Create and manage internal web forms
          </p>
        </div>
        <button
          onClick={() => router.push("/forms/new")}
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0 min-h-[44px]"
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
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent-light)" }}
            />
          </div>
        ) : forms.length === 0 ? (
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
              onClick={() => router.push("/forms/new")}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl">
            {forms.map((form: any) => (
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
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {form.title || "Untitled"}
                    </p>
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

                <div className="flex items-center gap-3 text-xs">
                  <span style={{ color: "var(--text-muted)" }}>
                    {form.responseCount ?? 0} response
                    {form.responseCount !== 1 ? "s" : ""}
                  </span>
                  <span style={{ color: "var(--text-dim)" }}>
                    {form.connectionCount ?? 0} template
                    {form.connectionCount !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                  <button
                    onClick={() =>
                      router.push(`/forms/${form._id}/builder`)
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
                      onClick={async () => {
                        try {
                          await publish({ id: form._id });
                          toast.success("Form published");
                        } catch (err: any) {
                          toast.error(err?.message);
                        }
                      }}
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
                      onClick={async () => {
                        try {
                          await archive({ id: form._id });
                          toast.success("Form archived");
                        } catch (err: any) {
                          toast.error(err?.message);
                        }
                      }}
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
