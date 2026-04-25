// app\(main)\home\page.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useOrganization, useUser, useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState } from "react";
import {
  PlusIcon,
  FileTextIcon,
  FolderIcon,
  LayoutTemplateIcon,
  SparklesIcon,
  MoreHorizontalIcon,
  CopyIcon,
  ArchiveIcon,
  Trash2Icon,
  ArrowRightIcon,
  StarIcon,
  ClockIcon,
  ZapIcon,
  BuildingIcon,
  UsersIcon,
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
import { COLLECTION_ICONS, getIconComponent } from "@/lib/collection-icons";
import { shadows } from "@/lib/design-tokens";

// ── Skeletons ─────────────────────────────────────────────────────────────────

function PaperCardSkeleton() {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 animate-pulse"
      style={{
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        minHeight: 172,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl shrink-0"
          style={{ background: "var(--bg-input)" }}
        />
        <div className="flex-1 space-y-2">
          <div
            className="h-3.5 rounded-md w-3/4"
            style={{ background: "var(--bg-input)" }}
          />
          <div
            className="h-2.5 rounded-md w-1/3"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
        <div
          className="w-7 h-7 rounded-lg shrink-0"
          style={{ background: "var(--bg-muted)" }}
        />
      </div>
      <div
        className="rounded-xl h-14"
        style={{ background: "var(--bg-muted)" }}
      />
      <div
        className="h-4 rounded-md w-1/2"
        style={{ background: "var(--bg-muted)" }}
      />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div
      className="rounded-xl p-3.5 flex items-center gap-3 animate-pulse"
      style={{
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        minHeight: 60,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg shrink-0"
        style={{ background: "var(--bg-input)" }}
      />
      <div className="flex-1 space-y-1.5">
        <div
          className="h-3 rounded w-2/3"
          style={{ background: "var(--bg-input)" }}
        />
        <div
          className="h-2.5 rounded w-1/3"
          style={{ background: "var(--bg-muted)" }}
        />
      </div>
    </div>
  );
}

// ── Paper Card ────────────────────────────────────────────────────────────────

function PaperCard({ document }: { document: Doc<"documents"> }) {
  const router = useRouter();
  const duplicate = useMutation(api.documents.duplicate);
  const archive = useMutation(api.documents.archive);
  const remove = useMutation(api.documents.remove);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  const collections = useQuery(api.documents.getCollectionsForDocument, {
    documentId: document._id,
  });

  const handleDuplicate = async () => {
    try {
      const newId = await duplicate({ id: document._id });
      toast.success("Paper duplicated");
      router.push(`/documents/${newId}`);
    } catch {
      toast.error("Couldn't duplicate. Try again.");
    }
  };

  const handleArchive = async () => {
    try {
      await archive({ id: document._id });
      toast.success("Paper archived");
    } catch {
      toast.error("Couldn't archive. Try again.");
    }
  };

  const handleDelete = async () => {
    try {
      await remove({ id: document._id });
      toast.success("Paper deleted");
    } catch {
      toast.error("Couldn't delete. Try again.");
    }
  };

  return (
    <>
      <div
        className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all duration-200 h-full"
        style={{
          background: hovered ? "var(--bg-card-hover)" : "var(--bg-card)",
          border: `1px solid ${hovered ? "var(--border-hover)" : "var(--border-subtle)"}`,
          boxShadow: hovered ? "var(--shadow-elevated)" : "none",
        }}
        onClick={() => router.push(`/documents/${document._id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Header row — icon + title + always-visible menu */}
        <div className="flex items-start gap-3">
          <div
            className="text-lg shrink-0 w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: "var(--bg-input)" }}
          >
            
              <FileTextIcon
                className="w-4 h-4"
                style={{ color: "var(--text-muted)" }}
              />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium leading-snug line-clamp-2"
              style={{ color: "var(--text)" }}
            >
              {document.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <ClockIcon
                className="w-2.5 h-2.5 shrink-0"
                style={{ color: "var(--text-dim)" }}
              />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {formatDistanceToNow(new Date(document._creationTime), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>

          {/* Always-visible 3-dot menu (no hover dependency) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-hover)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-input)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "var(--bg-input)")
                }
              >
                <MoreHorizontalIcon
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--text-muted)" }}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/documents/${document._id}`);
                }}
              >
                <FileTextIcon className="w-3.5 h-3.5 mr-2" /> Open
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate();
                }}
              >
                <CopyIcon className="w-3.5 h-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive();
                }}
              >
                <ArchiveIcon className="w-3.5 h-3.5 mr-2" /> Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
              >
                <Trash2Icon className="w-3.5 h-3.5 mr-2 text-destructive hover:text-destructive" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* AI Summary — fixed height so cards stay uniform */}
        <div
          className="rounded-xl px-3 py-2.5 flex items-start gap-2 flex-1"
          style={{
            background: "rgba(99,102,241,0.07)",
            border: "1px solid rgba(99,102,241,0.12)",
            minHeight: 56,
          }}
        >
          <SparklesIcon
            className="w-3 h-3 shrink-0 mt-0.5"
            style={{ color: "#818cf8" }}
          />
          {document.aiSummaryStatus === "done" && document.aiSummary ? (
            <p
              className="text-[11px] leading-relaxed line-clamp-3"
              style={{ color: "var(--text-secondary)" }}
            >
              {document.aiSummary}
            </p>
          ) : document.aiSummaryStatus === "pending" ? (
            <div className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin shrink-0"
                style={{ color: "#818cf8" }}
              />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Generating summary…
              </p>
            </div>
          ) : (
            <p
              className="text-[11px] italic"
              style={{ color: "var(--text-dim)" }}
            >
              No AI summary yet
            </p>
          )}
        </div>

        {/* Collection badges — fixed min-height so bottom of every card aligns */}
        <div className="flex items-center gap-1.5 flex-wrap min-h-[18px]">
          {collections && collections.length > 0
            ? (collections as Doc<"collections">[]).slice(0, 2).map((col) => (
                <span
                  key={col._id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                  style={{
                    background: col.color
                      ? `${col.color}22`
                      : "var(--bg-input)",
                    color: col.color ?? "var(--text-muted)",
                    border: `1px solid ${col.color ? `${col.color}35` : "var(--border-hover)"}`,
                  }}
                >
                  <span>
                    {(() => {
                      const Icon = getIconComponent(col.icon ?? "folder");
                      return (
                        <Icon
                          className="w-3 h-3"
                          style={{ color: col.color ?? "#6366f1" }}
                        />
                      );
                    })()}
                  </span>
                  <span>{col.name}</span>
                </span>
              ))
            : null}
          {collections && collections.length > 2 && (
            <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
              +{collections.length - 2}
            </span>
          )}
          {/* org indicator */}
          {document.organizationId && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ml-auto"
              style={{
                background: "rgba(99,102,241,0.1)",
                color: "#818cf8",
                border: "1px solid rgba(99,102,241,0.18)",
              }}
            >
              <UsersIcon className="w-2.5 h-2.5" />
              Shared
            </span>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete paper?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{document.title}&rdquo; will be permanently deleted. This
              cannot be undone.
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

// ── Collection Row ────────────────────────────────────────────────────────────

function CollectionRow({
  col,
}: {
  col: Doc<"collections"> & { documentCount?: number };
}) {
  const [hovered, setHovered] = useState(false);
  const accentColor = col.color ?? "#6366f1";

  return (
    <Link href={`/collections/${col._id}`} className="block">
      <div
        className="rounded-xl px-3.5 py-3 flex items-center gap-3 transition-all duration-150 cursor-pointer"
        style={{
          background: hovered ? "var(--bg-muted)" : "var(--bg-muted)",
          border: `1px solid ${hovered ? "var(--border-hover)" : "var(--border-subtle)"}`,
          minHeight: 60,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="w-0.5 h-7 rounded-full shrink-0"
          style={{ background: accentColor, opacity: 0.65 }}
        />
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
          style={{ background: `${accentColor}18` }}
        >
          {/* {col.icon ?? "📁"} */}
          {(() => {
            const Icon = getIconComponent(col.icon ?? "folder");
            return (
              <Icon
                className="w-4 h-4"
                style={{ color: col.color ?? "#6366f1" }}
              />
            );
          })()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className="text-[13px] font-medium truncate"
              style={{ color: "var(--text)" }}
            >
              {col.name}
            </p>
            {col.isFavorite && (
              <StarIcon className="w-2.5 h-2.5 shrink-0 fill-amber-400 text-amber-400" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {col.documentCount ?? 0} paper
              {(col.documentCount ?? 0) !== 1 ? "s" : ""}
            </p>
            {col.tags && col.tags.length > 0 && (
              <>
                <span style={{ color: "var(--text-placeholder)" }}>·</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {col.tags.slice(0, 2).map((tag) => (
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
                  {col.tags.length > 2 && (
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-dim)" }}
                    >
                      +{col.tags.length - 2}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <ArrowRightIcon
          className="w-3.5 h-3.5 shrink-0 transition-transform duration-150"
          style={{
            color: "var(--text-dim)",
            transform: hovered ? "translateX(2px)" : "none",
          }}
        />
      </div>
    </Link>
  );
}

// ── Template Row ──────────────────────────────────────────────────────────────

function TemplateRow({ template }: { template: Doc<"templates"> }) {
  const [hovered, setHovered] = useState(false);

  const fieldTypes = [...new Set(template.fields.map((f) => f.type))];
  const typeColors: Record<string, string> = {
    text: "#60a5fa",
    date: "#34d399",
    number: "#fb923c",
    email: "#c084fc",
    loop: "#818cf8",
    condition: "#f472b6",
    condition_inverse: "#fb7185",
  };

  return (
    <Link href={`/templates/${template._id}/fill`} className="block">
      <div
        className="rounded-xl px-3.5 py-3 flex items-center gap-3 transition-all duration-150 cursor-pointer"
        style={{
          background: hovered
            ? "rgba(99,102,241,0.08)"
            : "rgba(99,102,241,0.04)",
          border: `1px solid ${hovered ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)"}`,
          minHeight: 60,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.25)",
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
            style={{ color: "var(--text)" }}
          >
            {template.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {template.fields.length} field
              {template.fields.length !== 1 ? "s" : ""}
            </p>
            {/* {fieldTypes.length > 0 && (
              <div className="flex items-center gap-1">
                {fieldTypes.slice(0, 5).map((type) => (
                  <span
                    key={type}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: typeColors[type] ?? "#6b7280" }}
                    title={type}
                  />
                ))}
              </div>
            )} */}
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-1 rounded-lg shrink-0 transition-all duration-150"
          style={{
            background: hovered
              ? "rgba(99,102,241,0.25)"
              : "rgba(99,102,241,0.12)",
            color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          Use →
        </span>
      </div>
    </Link>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  href,
  hrefLabel = "View all",
}: {
  title: string;
  count?: number;
  href: string;
  hrefLabel?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2
          className="text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: "var(--text-muted)", letterSpacing: "0.07em" }}
        >
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-muted)",
            }}
          >
            {count}
          </span>
        )}
      </div>
      <Link
        href={href}
        className="flex items-center gap-1 text-[11px] font-medium transition-colors"
        style={{ color: hovered ? "#818cf8" : "var(--text-dim)" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hrefLabel}
        <ArrowRightIcon className="w-2.5 h-2.5" />
      </Link>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-7 px-4 text-center rounded-xl"
      style={{ border: "1px dashed var(--border-subtle)", minHeight: 120 }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center mb-2.5"
        style={{ background: "var(--bg-muted)" }}
      >
        <Icon className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
      </div>
      <p
        className="text-[12px] font-medium mb-1"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </p>
      <p
        className="text-[11px] mb-4 max-w-[180px] leading-relaxed"
        style={{ color: "var(--text-dim)" }}
      >
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: "rgba(99,102,241,0.12)",
            color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <PlusIcon className="w-3 h-3" />
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { isLoaded, isSignedIn } = useAuth();

  const createDocument = useMutation(api.documents.create);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const updateDocument = useMutation(api.documents.update);

  const skip = !(isLoaded && isSignedIn);

  const recentDocs = useQuery(
    api.documents.getRecent,
    skip ? "skip" : { limit: 6 }
  );
  const orgDocs = useQuery(
    api.documents.getByOrg,
    skip || !organization ? "skip" : { organizationId: organization.id }
  );
  const collections = useQuery(
    api.collections.getRecent,
    skip ? "skip" : { limit: 4 }
  );
  const templates = useQuery(
    api.templates.getRecent,
    skip ? "skip" : { limit: 4 }
  );
  const allDocs = useQuery(api.documents.getAll, skip ? "skip" : {});
  const allCollections = useQuery(api.collections.getAll, skip ? "skip" : {});
  const allTemplates = useQuery(api.templates.getAll, skip ? "skip" : {});

  const [isCreating, setIsCreating] = useState(false);

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
      const fileUrl = `${convexSiteUrl}/getFile?storageId=${storageId}`;
      const docId = await createDocument({
        title: "Untitled paper",
        organizationId: organization?.id,
        storageId,
      });
      await updateDocument({ id: docId, fileUrl });
      router.push(`/documents/${docId}`);
      toast.success("Paper created");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create paper. Check your connection.");
    } finally {
      setIsCreating(false);
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const docCount = allDocs?.length ?? 0;
  const colCount = allCollections?.length ?? 0;
  const tmplCount = allTemplates?.length ?? 0;
  const hasStats = docCount > 0 || colCount > 0 || tmplCount > 0;

  const quickActions = [
    {
      label: "New paper",
      icon: FileTextIcon,
      color: "#818cf8",
      bg: "rgba(99,102,241,0.10)",
      border: "rgba(99,102,241,0.18)",
      onClick: handleNewPaper,
    },
    {
      label: "New collection",
      icon: FolderIcon,
      color: "#34d399",
      bg: "rgba(52,211,153,0.08)",
      border: "rgba(52,211,153,0.18)",
      onClick: () => router.push("/collections"),
    },
    {
      label: "New template",
      icon: LayoutTemplateIcon,
      color: "#f472b6",
      bg: "rgba(244,114,182,0.08)",
      border: "rgba(244,114,182,0.18)",
      onClick: () => router.push("/templates/new"),
    },
    {
      label: "All papers",
      icon: ZapIcon,
      color: "#fb923c",
      bg: "rgba(251,146,60,0.08)",
      border: "rgba(251,146,60,0.18)",
      onClick: () => router.push("/documents"),
    },
  ];

  return (
    <div
      className="flex flex-col h-full min-h-0"
      style={{ background: "var(--bg)" }}
    >
      {/* ── Page header ── */}
      <div
        className="shrink-0 px-4 sm:px-6 lg:px-7 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        {/* Greeting + button — stack on very small screens, row on sm+ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-[15px] sm:text-base font-semibold leading-tight truncate"
              style={{ color: "var(--text)" }}
            >
              {user ? `${greeting}, ${user.firstName ?? "there"}` : "Home"}
              <span style={{ color: "#6366f1" }}> ✦</span>
            </h1>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-dim)" }}
            >
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <button
            onClick={handleNewPaper}
            disabled={isCreating}
            className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0 self-start sm:self-auto"
            style={{
              background: "var(--accent-bg)",
              color: "var(--accent-pale)",
              border: `1px solid var(--accent-border)`,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isCreating) {
                e.currentTarget.style.background = "var(--accent-bg-hover)";
                e.currentTarget.style.boxShadow = shadows.glow;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent-bg)";
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
      </div>

      {/* ── Scrollable content ── */}
      <div
        className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 lg:px-7 py-5 space-y-7
        pb-[calc(1.25rem+env(safe-area-inset-bottom)+52px)] md:pb-5"
      >
        {/* ── Stats + org banner ── */}
        {hasStats && (
          <div className="space-y-2.5">
            {/* Stat pills row */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                {
                  label: "Papers",
                  value: docCount,
                  color: "#818cf8",
                  bg: "rgba(99,102,241,0.08)",
                  border: "rgba(99,102,241,0.15)",
                },
                {
                  label: "Collections",
                  value: colCount,
                  color: "#34d399",
                  bg: "rgba(52,211,153,0.07)",
                  border: "rgba(52,211,153,0.15)",
                },
                {
                  label: "Templates",
                  value: tmplCount,
                  color: "#f472b6",
                  bg: "rgba(244,114,182,0.07)",
                  border: "rgba(244,114,182,0.15)",
                },
              ].map(({ label, value, color, bg, border }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <span
                    className="text-[15px] md:text-[18px] font-bold tabular-nums leading-none"
                    style={{ color }}
                  >
                    {value}
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Org banner — only if in an org */}
            {organization && (
              <div
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                style={{
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.12)",
                }}
              >
                <BuildingIcon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "#818cf8" }}
                />
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {organization.imageUrl ? (
                    <img
                      src={organization.imageUrl}
                      alt=""
                      className="w-5 h-5 rounded-md shrink-0"
                    />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: "rgba(99,102,241,0.2)",
                        color: "#818cf8",
                      }}
                    >
                      {organization.name.charAt(0)}
                    </div>
                  )}
                  <p
                    className="text-[12px] font-medium truncate"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {organization.name}
                  </p>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: "rgba(99,102,241,0.2)",
                      color: "#818cf8",
                    }}
                  >
                    ORG
                  </span>
                </div>
                {orgDocs !== undefined && orgDocs.length > 0 && (
                  <p
                    className="text-[11px] shrink-0"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {orgDocs.length} shared
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {quickActions.map(
            ({ label, icon: Icon, color, bg, border, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="flex flex-col sm:flex-row items-center sm:items-center gap-2 px-3 py-3 rounded-xl text-left transition-all duration-150"
                style={{ background: bg, border: `1px solid ${border}` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = "brightness(1.15)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = "none";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}18` }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span
                  className="text-[12px] font-medium text-center sm:text-left leading-tight"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {label}
                </span>
              </button>
            )
          )}
        </div>

        {/* ── Recent papers ── */}
        <section>
          <SectionHeader
            title="Recent papers"
            count={recentDocs?.length}
            href="/documents"
          />
          {recentDocs === undefined ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <PaperCardSkeleton key={i} />
              ))}
            </div>
          ) : recentDocs.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title="No papers yet"
              description="Create your first paper to get started."
              action={{ label: "New paper", onClick: handleNewPaper }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
              {recentDocs.map((doc) => (
                <PaperCard key={doc._id} document={doc} />
              ))}
            </div>
          )}
        </section>

        {/* ── Shared in org ── */}
        {organization && orgDocs !== undefined && orgDocs.length > 0 && (
          <section>
            <SectionHeader
              title="Shared in org"
              count={orgDocs.length}
              href="/documents"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
              {orgDocs.map((doc) => (
                <PaperCard key={doc._id} document={doc} />
              ))}
            </div>
          </section>
        )}

        {/* ── Collections + Templates two-column ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Collections */}
          <section>
            <SectionHeader
              title="Collections"
              count={collections?.length}
              href="/collections"
            />
            {collections === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <RowSkeleton key={i} />
                ))}
              </div>
            ) : collections.length === 0 ? (
              <EmptyState
                icon={FolderIcon}
                title="No collections yet"
                description="Organise your papers into collections."
                action={{
                  label: "New collection",
                  onClick: () => router.push("/collections"),
                }}
              />
            ) : (
              <div className="space-y-2">
                {(
                  collections as (Doc<"collections"> & {
                    documentCount?: number;
                  })[]
                ).map((col) => (
                  <CollectionRow key={col._id} col={col} />
                ))}
              </div>
            )}
          </section>

          {/* Templates */}
          <section>
            <SectionHeader
              title="Templates"
              count={templates?.length}
              href="/templates"
            />
            {templates === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <RowSkeleton key={i} />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <EmptyState
                icon={LayoutTemplateIcon}
                title="No templates yet"
                description="Upload a .docx with placeholders to get started."
                action={{
                  label: "New template",
                  onClick: () => router.push("/templates/new"),
                }}
              />
            ) : (
              <div className="space-y-2">
                {templates.map((tmpl) => (
                  <TemplateRow key={tmpl._id} template={tmpl} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
