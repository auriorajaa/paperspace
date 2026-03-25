"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useUser, useOrganization, useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import {
  ChevronLeftIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  PencilIcon,
  WifiIcon,
  XIcon,
  BuildingIcon,
  LockIcon,
} from "lucide-react";
import { OnlyOfficeEditor } from "@/components/OnlyOfficeEditor";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { colors } from "@/lib/design-tokens";

// ── Inline Title ──────────────────────────────────────────────────────────────

function InlineTitle({
  initialValue,
  onSave,
}: {
  initialValue: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(initialValue);
      setEditing(false);
      return;
    }
    if (trimmed === initialValue) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      toast.error("Couldn't save title. Try again.");
      setValue(initialValue);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setValue(initialValue);
              setEditing(false);
            }
          }}
          onBlur={handleSave}
          disabled={saving}
          className="flex-1 max-w-[400px] text-sm font-medium rounded-lg px-2.5 py-1 outline-none"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: `1px solid ${colors.accentBorder}`,
            color: colors.text,
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
          style={{
            background: colors.accentBg,
            color: colors.accentLight,
            border: `1px solid ${colors.accentBorder}`,
          }}
        >
          {saving ? (
            <div
              className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: colors.accentLight }}
            />
          ) : (
            "Save"
          )}
        </button>
        <button
          onClick={() => {
            setValue(initialValue);
            setEditing(false);
          }}
          className="text-[11px] px-2 py-1 rounded-lg"
          style={{ color: colors.textMuted }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 px-2.5 py-1 rounded-lg transition-all max-w-[360px]"
      title="Click to rename"
      style={{ border: "1px solid transparent" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.border = `1px solid ${colors.border}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.border = "1px solid transparent";
      }}
    >
      <span
        className="text-sm font-medium truncate"
        style={{ color: colors.text }}
      >
        {value}
      </span>
      <PencilIcon
        className="w-3 h-3 shrink-0"
        style={{ color: colors.accentLight, opacity: 0.6 }}
      />
    </button>
  );
}

// ── Error States ──────────────────────────────────────────────────────────────

function ErrorState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center h-screen gap-5 p-8 text-center"
      style={{ background: colors.bg }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${colors.border}`,
        }}
      >
        {icon}
      </div>
      <div className="space-y-1.5 max-w-sm">
        <p className="text-sm font-semibold" style={{ color: colors.text }}>
          {title}
        </p>
        <div
          className="text-xs leading-relaxed"
          style={{ color: colors.textMuted }}
        >
          {description}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as Id<"documents">;
  const { isLoaded, isSignedIn } = useAuth();

  const { user } = useUser();
  const { organization } = useOrganization();

  const document = useQuery(
    api.documents.getById,
    isLoaded && isSignedIn ? { id: documentId } : "skip" // ← guard
  );
  const updateDocument = useMutation(api.documents.update);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  const [editorError, setEditorError] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!document) return;
    const resolve = async () => {
      if (document.fileUrl) {
        setFileUrl(document.fileUrl);
        return;
      }
      if (document.storageId) {
        const url = `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? ""}/getFile?storageId=${document.storageId}`;
        setFileUrl(url);
        try {
          await updateDocument({ id: documentId, fileUrl: url });
        } catch {}
        return;
      }
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
        const url = `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? ""}/getFile?storageId=${storageId}`;
        await updateDocument({ id: documentId, storageId, fileUrl: url });
        setFileUrl(url);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't initialize document. Please try again.");
      }
    };
    resolve();
  }, [document?.storageId, document?.fileUrl]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (document === undefined) {
    return (
      <div className="flex flex-col h-screen" style={{ background: colors.bg }}>
        <div
          className="flex items-center gap-3 px-4 h-11 shrink-0 animate-pulse"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div
            className="w-20 h-3.5 rounded"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />
          <div className="w-px h-4" style={{ background: colors.border }} />
          <div
            className="w-40 h-3.5 rounded"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: colors.accentLight }}
            />
            <p className="text-xs" style={{ color: colors.textMuted }}>
              Loading document…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Not found or no access ────────────────────────────────────────────────

  if (document === null) {
    // If user is in personal mode (no org), hint them to switch
    const hint = !organization
      ? "If this is a shared document, switch to your organization and try again."
      : "This document doesn't exist or has been deleted.";

    return (
      <ErrorState
        icon={
          <LockIcon className="w-6 h-6" style={{ color: colors.textDim }} />
        }
        title="Document not found or access denied"
        description={hint}
        action={
          <>
            <button
              onClick={() => router.push("/documents")}
              className="text-xs font-medium px-4 py-2 rounded-xl transition-colors"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
              }}
            >
              ← Back to Documents
            </button>
            {!organization && (
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: colors.textDim }}
              >
                <BuildingIcon className="w-3.5 h-3.5" />
                Switch org via the account menu
              </span>
            )}
          </>
        }
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: colors.bg }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 h-11 shrink-0"
        style={{
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: colors.bgSidebar,
        }}
      >
        <Link
          href="/documents"
          className="flex items-center gap-1 text-xs transition-colors shrink-0"
          style={{ color: colors.textMuted }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = colors.textSecondary)
          }
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Documents
        </Link>

        <span style={{ color: colors.textDim, fontSize: 11 }}>/</span>

        <InlineTitle
          initialValue={document.title}
          onSave={async (title) => {
            await updateDocument({ id: documentId, title });
          }}
        />

        {/* Org badge */}
        {document.organizationId && organization && (
          <span
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: colors.accentBg,
              color: colors.accentLight,
              border: `1px solid ${colors.accentBorder}`,
            }}
          >
            <BuildingIcon className="w-2.5 h-2.5" />
            {organization.name}
          </span>
        )}

        {/* Status */}
        <div className="ml-auto flex items-center gap-3">
          {editorReady && !editorError && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: colors.success }}
              />
              <span className="text-[11px]" style={{ color: colors.textMuted }}>
                Connected
              </span>
            </div>
          )}
          {editorError && (
            <span className="text-[11px]" style={{ color: colors.danger }}>
              Editor offline
            </span>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex overflow-hidden">
        {!fileUrl ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.accentLight }}
              />
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Preparing document…
              </p>
            </div>
          </div>
        ) : editorError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: colors.dangerBg }}
            >
              <AlertCircleIcon
                className="w-6 h-6"
                style={{ color: colors.danger }}
              />
            </div>
            <div className="space-y-1 max-w-xs">
              <p
                className="text-sm font-semibold"
                style={{ color: colors.text }}
              >
                Editor couldn&apos;t load
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: colors.textMuted }}
              >
                If you&apos;re using a browser extension like IDM, try disabling
                it.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditorError(false);
                  setEditorKey((k) => k + 1);
                }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <RefreshCwIcon className="w-3.5 h-3.5" />
                Retry
              </button>
              <a
                href="http://flowing-sharp-martin.ngrok-free.app/healthcheck"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ color: colors.textMuted }}
              >
                <WifiIcon className="w-3.5 h-3.5" />
                Check server
              </a>
            </div>
          </div>
        ) : (
          <OnlyOfficeEditor
            key={editorKey}
            fileUrl={fileUrl}
            fileName={document.title}
            fileKey={`doc-${documentId}-${document.storageId?.slice(-8) ?? document._creationTime}`}
            documentId={documentId}
            storageId={document.storageId}
            // ── Pass Clerk user info ──────────────────────────────────────────
            userId={user?.id}
            userName={user?.fullName ?? user?.firstName ?? undefined}
            userAvatar={user?.imageUrl}
            onReady={() => setEditorReady(true)}
            onError={() => {
              setEditorError(true);
              setEditorReady(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
