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

// ── Skeletons ─────────────────────────────────────────────────────────────────

function DocCardSkeleton() {
  return (
    <div
      className="rounded-2xl p-4 space-y-3 animate-pulse"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
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
    </div>
  );
}

function SmallSkeleton() {
  return (
    <div
      className="rounded-xl p-3.5 flex items-center gap-3 animate-pulse"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg shrink-0"
        style={{ background: "rgba(255,255,255,0.07)" }}
      />
      <div className="flex-1 space-y-1.5">
        <div
          className="h-3 rounded w-2/3"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <div
          className="h-2.5 rounded w-1/3"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />
      </div>
    </div>
  );
}

// ── Document Card ─────────────────────────────────────────────────────────────

function DocumentCard({ document }: { document: Doc<"documents"> }) {
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
      toast.success("Document duplicated");
      router.push(`/documents/${newId}`);
    } catch {
      toast.error("Couldn't duplicate. Try again.");
    }
  };

  const handleArchive = async () => {
    try {
      await archive({ id: document._id });
      toast.success("Document archived");
    } catch {
      toast.error("Couldn't archive. Try again.");
    }
  };

  const handleDelete = async () => {
    try {
      await remove({ id: document._id });
      toast.success("Document deleted");
    } catch {
      toast.error("Couldn't delete. Try again.");
    }
  };

  return (
    <>
      <div
        className="rounded-2xl p-4 flex flex-col gap-3.5 cursor-pointer group transition-all duration-200"
        style={{
          background: hovered
            ? "rgba(255,255,255,0.045)"
            : "rgba(255,255,255,0.025)",
          border: `1px solid ${hovered ? "rgba(255,255,255,0.11)" : "rgba(255,255,255,0.06)"}`,
          boxShadow: hovered
            ? "0 0 0 1px rgba(99,102,241,0.08), 0 8px 32px rgba(0,0,0,0.35)"
            : "none",
        }}
        onClick={() => router.push(`/documents/${document._id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Header */}
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
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              {document.title}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ClockIcon
                className="w-2.5 h-2.5"
                style={{ color: "rgba(255,255,255,0.28)" }}
              />
              <p
                className="text-[11px]"
                style={{ color: "rgba(255,255,255,0.38)" }}
              >
                {formatDistanceToNow(new Date(document._creationTime), {
                  addSuffix: true,
                })}
              </p>
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
                  style={{ color: "rgba(255,255,255,0.5)" }}
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive();
                }}
              >
                <ArchiveIcon className="w-3.5 h-3.5 mr-2" />
                Archive
              </DropdownMenuItem>
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

        {/* AI Summary */}
        <div
          className="rounded-xl px-3 py-2.5 flex items-start gap-2 min-h-[44px]"
          style={{
            background: "rgba(99,102,241,0.07)",
            border: "1px solid rgba(99,102,241,0.12)",
          }}
        >
          <SparklesIcon
            className="w-3 h-3 shrink-0 mt-0.5"
            style={{ color: "#818cf8" }}
          />
          {document.aiSummaryStatus === "done" && document.aiSummary ? (
            <p
              className="text-[11px] leading-relaxed line-clamp-2"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              {document.aiSummary}
            </p>
          ) : document.aiSummaryStatus === "pending" ? (
            <div className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin"
                style={{ color: "#818cf8" }}
              />
              <p
                className="text-[11px]"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Generating summary…
              </p>
            </div>
          ) : (
            <p
              className="text-[11px] italic"
              style={{ color: "rgba(255,255,255,0.28)" }}
            >
              AI summary not yet generated
            </p>
          )}
        </div>

        {/* Collection badges */}
        {collections && collections.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap -mt-0.5">
            {(collections as Doc<"collections">[]).slice(0, 2).map((col) => (
              <span
                key={col._id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                style={{
                  background: col.color
                    ? `${col.color}22`
                    : "rgba(255,255,255,0.07)",
                  color: col.color ? `${col.color}` : "rgba(255,255,255,0.55)",
                  border: `1px solid ${col.color ? `${col.color}35` : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <span>{col.icon}</span>
                <span>{col.name}</span>
              </span>
            ))}
            {collections.length > 2 && (
              <span
                className="text-[10px]"
                style={{ color: "rgba(255,255,255,0.28)" }}
              >
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

// ── Collection Card ───────────────────────────────────────────────────────────

function CollectionCard({
  col,
}: {
  col: Doc<"collections"> & { documentCount?: number };
}) {
  const [hovered, setHovered] = useState(false);
  const accentColor = col.color ?? "#6366f1";

  return (
    <Link href={`/collections/${col._id}`}>
      <div
        className="rounded-xl p-3.5 my-2 flex items-center gap-3 transition-all duration-150 cursor-pointer"
        style={{
          background: hovered
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.02)",
          border: `1px solid ${hovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Color strip */}
        <div
          className="w-0.5 h-8 rounded-full shrink-0"
          style={{ background: accentColor, opacity: 0.7 }}
        />

        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
          style={{ background: `${accentColor}18` }}
        >
          {col.icon ?? "📁"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className="text-[13px] font-medium truncate"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {col.name}
            </p>
            {col.isFavorite && (
              <StarIcon className="w-2.5 h-2.5 shrink-0 fill-amber-400 text-amber-400" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p
              className="text-[11px]"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {col.documentCount ?? 0} doc
              {(col.documentCount ?? 0) !== 1 ? "s" : ""}
            </p>
            {col.tags && col.tags.length > 0 && (
              <>
                <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
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
                      style={{ color: "rgba(255,255,255,0.25)" }}
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
            color: "rgba(255,255,255,0.2)",
            transform: hovered ? "translateX(2px)" : "none",
          }}
        />
      </div>
    </Link>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: Doc<"templates"> }) {
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
    <Link href={`/templates/${template._id}/fill`}>
      <div
        className="rounded-xl p-3.5 my-2 flex items-center gap-3 transition-all duration-150 cursor-pointer"
        style={{
          background: hovered
            ? "rgba(99,102,241,0.08)"
            : "rgba(99,102,241,0.04)",
          border: `1px solid ${hovered ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)"}`,
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
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {template.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p
              className="text-[11px]"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {template.fields.length} field
              {template.fields.length !== 1 ? "s" : ""}
            </p>
            {fieldTypes.length > 0 && (
              <div className="flex items-center gap-1">
                {fieldTypes.slice(0, 4).map((type) => (
                  <span
                    key={type}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: typeColors[type] ?? "#6b7280" }}
                    title={type}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <span
          className="text-[10px] font-medium px-2 py-1 rounded-lg shrink-0 transition-all duration-150"
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
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2
          className="text-[13px] font-semibold tracking-wide uppercase"
          style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}
        >
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            {count}
          </span>
        )}
      </div>
      <Link
        href={href}
        className="flex items-center gap-1 text-[11px] font-medium transition-colors"
        style={{ color: hovered ? "#818cf8" : "rgba(255,255,255,0.3)" }}
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
      className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl"
      style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <Icon className="w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />
      </div>
      <p
        className="text-xs font-medium mb-1"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {title}
      </p>
      <p
        className="text-[11px] mb-4 max-w-[180px] leading-relaxed"
        style={{ color: "rgba(255,255,255,0.25)" }}
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

// ── Stat Chip ─────────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center px-5 py-3 rounded-xl"
      style={{
        background: `${color}0d`,
        border: `1px solid ${color}20`,
      }}
    >
      <span className="text-xl font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span
        className="text-[10px] mt-0.5 font-medium"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        {label}
      </span>
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

  const recentDocs = useQuery(
    api.documents.getRecent,
    isLoaded && isSignedIn ? { limit: 6 } : "skip"
  );
  const orgDocs = useQuery(
    api.documents.getByOrg,
    isLoaded && isSignedIn && organization
      ? { organizationId: organization.id }
      : "skip"
  );
  const collections = useQuery(
    api.collections.getRecent,
    isLoaded && isSignedIn ? { limit: 4 } : "skip"
  );
  const templates = useQuery(
    api.templates.getRecent,
    isLoaded && isSignedIn ? { limit: 4 } : "skip"
  );
  const allDocs = useQuery(
    api.documents.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const allCollections = useQuery(
    api.collections.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const allTemplates = useQuery(
    api.templates.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );

  const [isCreating, setIsCreating] = useState(false);

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
      toast.error("Couldn't create document. Check your connection.");
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

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-7 py-5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div>
          <h1
            className="text-[15px] font-semibold"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            {user ? `${greeting}, ${user.firstName ?? "there"}` : "Home"}
            <span style={{ color: "#6366f1" }}> ✦</span>
          </h1>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: "rgba(255,255,255,0.32)" }}
          >
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <button
          onClick={handleNewDocument}
          disabled={isCreating}
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150"
          style={{
            background: "rgba(99,102,241,0.18)",
            color: "#a5b4fc",
            border: "1px solid rgba(99,102,241,0.28)",
          }}
          onMouseEnter={(e) => {
            if (!isCreating) {
              e.currentTarget.style.background = "rgba(99,102,241,0.28)";
              e.currentTarget.style.boxShadow =
                "0 0 20px rgba(99,102,241,0.25)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(99,102,241,0.18)";
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

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-7 py-6 space-y-8">
        {/* Stats row */}
        {(docCount > 0 || colCount > 0 || tmplCount > 0) && (
          <div className="flex items-center gap-3">
            <StatChip label="Documents" value={docCount} color="#818cf8" />
            <StatChip label="Collections" value={colCount} color="#34d399" />
            <StatChip label="Templates" value={tmplCount} color="#f472b6" />
            {organization && (
              <div
                className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {organization.imageUrl ? (
                  <img
                    src={organization.imageUrl}
                    alt=""
                    className="w-5 h-5 rounded-md"
                  />
                ) : (
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: "rgba(99,102,241,0.2)",
                      color: "#818cf8",
                    }}
                  >
                    {organization.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p
                    className="text-[11px] font-medium"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    {organization.name}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    Organization workspace
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            {
              label: "New document",
              icon: FileTextIcon,
              color: "#818cf8",
              bg: "rgba(99,102,241,0.1)",
              onClick: handleNewDocument,
            },
            {
              label: "New collection",
              icon: FolderIcon,
              color: "#34d399",
              bg: "rgba(52,211,153,0.08)",
              onClick: () => router.push("/collections"),
            },
            {
              label: "New template",
              icon: LayoutTemplateIcon,
              color: "#f472b6",
              bg: "rgba(244,114,182,0.08)",
              onClick: () => router.push("/templates/new"),
            },
            {
              label: "Browse documents",
              icon: ZapIcon,
              color: "#fb923c",
              bg: "rgba(251,146,60,0.08)",
              onClick: () => router.push("/documents"),
            },
          ].map(({ label, icon: Icon, color, bg, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left transition-all duration-150 group"
              style={{
                background: bg,
                border: `1px solid ${color}20`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = `1px solid ${color}35`;
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = `1px solid ${color}20`;
                e.currentTarget.style.transform = "none";
              }}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color }} />
              <span
                className="text-[12px] font-medium"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Recent documents ── */}
        <section>
          <SectionHeader
            title="Recent"
            count={recentDocs?.length}
            href="/documents"
          />
          {recentDocs === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <DocCardSkeleton key={i} />
              ))}
            </div>
          ) : recentDocs.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title="No documents yet"
              description="Create your first document to get started."
              action={{ label: "New document", onClick: handleNewDocument }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentDocs.map((doc) => (
                <DocumentCard key={doc._id} document={doc} />
              ))}
            </div>
          )}
        </section>

        {/* ── Org shared ── */}
        {organization && orgDocs !== undefined && orgDocs.length > 0 && (
          <section>
            <SectionHeader
              title="Shared in org"
              count={orgDocs.length}
              href="/documents"
              hrefLabel="View all"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {orgDocs.map((doc) => (
                <DocumentCard key={doc._id} document={doc} />
              ))}
            </div>
          </section>
        )}

        {/* ── Collections + Templates ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <SectionHeader
              title="Collections"
              count={collections?.length}
              href="/collections"
            />
            {collections === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SmallSkeleton key={i} />
                ))}
              </div>
            ) : collections.length === 0 ? (
              <EmptyState
                icon={FolderIcon}
                title="No collections yet"
                description="Organize your documents into collections."
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
                  <CollectionCard key={col._id} col={col} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="Templates"
              count={templates?.length}
              href="/templates"
            />
            {templates === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SmallSkeleton key={i} />
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
                  <TemplateCard key={tmpl._id} template={tmpl} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
