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
  XIcon,
  BuildingIcon,
  MonitorIcon,
  TabletIcon,
  SmartphoneIcon,
  FileXIcon,
  ShieldOffIcon,
  CheckIcon,
  InfoIcon,
  LinkIcon,
  ArrowRightIcon,
  ZapOffIcon,
  TypeIcon,
  LayoutIcon,
} from "lucide-react";
import { OnlyOfficeEditor } from "@/components/OnlyOfficeEditor";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { colors } from "@/lib/design-tokens";

// ── Mobile detection hook ─────────────────────────────────────────────────────

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

// ── Mobile recommendation screen ─────────────────────────────────────────────

const MOBILE_LIMITATIONS = [
  {
    icon: <LayoutIcon className="w-3.5 h-3.5" />,
    text: "Toolbar buttons are cramped and hard to tap",
  },
  {
    icon: <TypeIcon className="w-3.5 h-3.5" />,
    text: "Text selection and cursor placement is imprecise",
  },
  {
    icon: <ZapOffIcon className="w-3.5 h-3.5" />,
    text: "Some formatting features won't respond to touch",
  },
];

function MobileRecommendation({ onContinue }: { onContinue: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy link.");
    }
  };

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: colors.bg }}
    >
      {/* Visual banner */}
      <div
        className="relative flex flex-col items-center justify-center px-6 py-10 gap-5 text-center"
        style={{
          background: `linear-gradient(180deg, ${colors.bgSidebar} 0%, ${colors.bg} 100%)`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}
      >
        {/* Device trio */}
        <div className="flex items-end justify-center gap-2.5">
          {/* Desktop — recommended */}
          <div
            className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl"
            style={{
              background: colors.accentBg,
              border: `1px solid ${colors.accentBorder}`,
            }}
          >
            <MonitorIcon
              className="w-7 h-7"
              style={{ color: colors.accentLight }}
            />
            <div className="flex flex-col items-center gap-0.5">
              <span
                className="text-[11px] font-semibold"
                style={{ color: colors.accentLight }}
              >
                Desktop
              </span>
              <span
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: colors.accentBorder,
                  color: colors.accentLight,
                }}
              >
                Recommended
              </span>
            </div>
          </div>

          {/* Tablet — OK */}
          <div
            className="flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <TabletIcon
              className="w-6 h-6"
              style={{ color: colors.textSecondary }}
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: colors.textSecondary }}
            >
              Tablet
            </span>
          </div>

          {/* Phone — not great */}
          <div
            className="flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${colors.borderSubtle}`,
              opacity: 0.45,
            }}
          >
            <SmartphoneIcon
              className="w-5 h-5"
              style={{ color: colors.textDim }}
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: colors.textDim }}
            >
              Phone
            </span>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1.5 max-w-[280px]">
          <p
            className="text-[15px] font-semibold leading-snug"
            style={{ color: colors.text }}
          >
            This editor works best on a larger screen
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: colors.textMuted }}
          >
            The document editor uses a full-featured toolbar designed for mouse
            and keyboard — not a phone screen.
          </p>
        </div>
      </div>

      {/* Limitations list */}
      <div className="px-5 py-5 space-y-2">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider mb-3"
          style={{ color: colors.textDim }}
        >
          What you may experience on mobile
        </p>
        {MOBILE_LIMITATIONS.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <span className="shrink-0 mt-0.5" style={{ color: colors.textDim }}>
              {item.icon}
            </span>
            <p
              className="text-[12px] leading-relaxed"
              style={{ color: colors.textMuted }}
            >
              {item.text}
            </p>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="px-5 pb-8 space-y-2.5">
        {/* Copy link — primary CTA */}
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-center gap-2 text-[13px] font-medium px-4 py-3 rounded-xl transition-all"
          style={{
            background: copied ? "rgba(34,197,94,0.1)" : colors.accentBg,
            color: copied ? colors.success : colors.accentLight,
            border: `1px solid ${copied ? colors.success + "40" : colors.accentBorder}`,
          }}
        >
          {copied ? (
            <>
              <CheckIcon className="w-4 h-4" />
              Link copied — open it on your desktop
            </>
          ) : (
            <>
              <LinkIcon className="w-4 h-4" />
              Copy link to open on desktop
            </>
          )}
        </button>

        {/* Continue anyway — secondary */}
        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium px-4 py-2.5 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: colors.textMuted,
            border: `1px solid ${colors.borderSubtle}`,
          }}
        >
          Continue on mobile anyway
          <ArrowRightIcon className="w-3.5 h-3.5" />
        </button>

        <Link
          href="/documents"
          className="flex items-center justify-center text-[11px] py-1"
          style={{ color: colors.textDim }}
        >
          ← Back to documents
        </Link>
      </div>
    </div>
  );
}

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
  const [saved, setSaved] = useState(false);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Couldn't save title. Try again.");
      setValue(initialValue);
    } finally {
      setSaving(false);
    }
  };

  // ── Editing state ──────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
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
          placeholder="Document title…"
          className="flex-1 min-w-0 text-[13px] font-medium rounded-lg px-2.5 py-1.5 outline-none"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: `1px solid ${colors.accentBorder}`,
            color: colors.text,
            maxWidth: 280,
          }}
        />
        {/* Confirm */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
          style={{
            background: colors.accentBg,
            border: `1px solid ${colors.accentBorder}`,
          }}
          title="Save (Enter)"
        >
          {saving ? (
            <div
              className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent animate-spin"
              style={{ borderColor: colors.accentLight }}
            />
          ) : (
            <CheckIcon
              className="w-3 h-3"
              style={{ color: colors.accentLight }}
            />
          )}
        </button>
        {/* Cancel */}
        <button
          onClick={() => {
            setValue(initialValue);
            setEditing(false);
          }}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${colors.borderSubtle}`,
          }}
          title="Cancel (Esc)"
        >
          <XIcon className="w-3 h-3" style={{ color: colors.textDim }} />
        </button>
      </div>
    );
  }

  // ── Display state ──────────────────────────────────────────────────────────
  // The pencil icon is ALWAYS visible (not hidden behind hover) so touch users
  // understand this is an editable field.
  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-0 max-w-[180px] sm:max-w-[320px] transition-colors"
      style={{
        // Subtle but always-present border signals interactivity on touch
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${colors.borderSubtle}`,
      }}
      title="Rename document"
    >
      <span
        className="text-[13px] font-medium truncate"
        style={{ color: saved ? colors.success : colors.text }}
      >
        {value}
      </span>
      {saved ? (
        <CheckIcon
          className="w-3 h-3 shrink-0"
          style={{ color: colors.success }}
        />
      ) : (
        <PencilIcon
          className="w-3 h-3 shrink-0"
          // Always visible at 0.55 opacity — readable but not distracting
          style={{ color: colors.accentLight, opacity: 0.55 }}
        />
      )}
    </button>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ ready, error }: { ready: boolean; error: boolean }) {
  if (error) {
    return (
      <div className="flex items-center gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: colors.danger }}
        />
        <span
          className="text-[11px] font-medium hidden sm:inline"
          style={{ color: colors.danger }}
        >
          Editor offline
        </span>
      </div>
    );
  }
  if (ready) {
    return (
      <div className="flex items-center gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: colors.success,
            boxShadow: `0 0 5px ${colors.success}`,
          }}
        />
        <span
          className="text-[11px] font-medium hidden sm:inline"
          style={{ color: colors.textMuted }}
        >
          Live
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
        style={{ background: colors.textDim }}
      />
      <span
        className="text-[11px] hidden sm:inline"
        style={{ color: colors.textDim }}
      >
        Connecting…
      </span>
    </div>
  );
}

// ── Error States ──────────────────────────────────────────────────────────────

type ErrorVariant =
  | "not-found"
  | "no-access"
  | "network"
  | "storage"
  | "generic";

const ERROR_META: Record<
  ErrorVariant,
  { icon: React.ReactNode; title: string; hint: string }
> = {
  "not-found": {
    icon: <FileXIcon className="w-6 h-6" style={{ color: colors.textDim }} />,
    title: "Document not found",
    hint: "This document may have been deleted or moved.",
  },
  "no-access": {
    icon: (
      <ShieldOffIcon className="w-6 h-6" style={{ color: colors.textDim }} />
    ),
    title: "Access denied",
    hint: "You don't have permission to view this document.",
  },
  network: {
    icon: (
      <AlertCircleIcon className="w-6 h-6" style={{ color: colors.textDim }} />
    ),
    title: "Connection problem",
    hint: "Check your internet connection and try again.",
  },
  storage: {
    icon: (
      <AlertCircleIcon className="w-6 h-6" style={{ color: colors.textDim }} />
    ),
    title: "File unavailable",
    hint: "The document file couldn't be retrieved from storage.",
  },
  generic: {
    icon: (
      <AlertCircleIcon className="w-6 h-6" style={{ color: colors.textDim }} />
    ),
    title: "Something went wrong",
    hint: "An unexpected error occurred. Please try again.",
  },
};

function ErrorState({
  variant,
  extraHint,
  action,
}: {
  variant: ErrorVariant;
  extraHint?: string;
  action?: React.ReactNode;
}) {
  const meta = ERROR_META[variant];
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
        {meta.icon}
      </div>
      <div className="space-y-1.5 max-w-sm">
        <p className="text-[14px] font-semibold" style={{ color: colors.text }}>
          {meta.title}
        </p>
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: colors.textMuted }}
        >
          {meta.hint}
          {extraHint && (
            <>
              {" "}
              <span style={{ color: colors.textDim }}>{extraHint}</span>
            </>
          )}
        </p>
      </div>
      {action && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {action}
        </div>
      )}
    </div>
  );
}

// ── Editor error panel ────────────────────────────────────────────────────────

function EditorErrorPanel({
  onRetry,
  retryCount,
}: {
  onRetry: () => void;
  retryCount: number;
}) {
  const isRepeated = retryCount >= 2;
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{
          background: colors.dangerBg,
          border: `1px solid ${colors.danger}22`,
        }}
      >
        <AlertCircleIcon className="w-6 h-6" style={{ color: colors.danger }} />
      </div>

      <div className="space-y-1.5 max-w-xs">
        <p className="text-[14px] font-semibold" style={{ color: colors.text }}>
          Editor couldn&apos;t load
        </p>
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: colors.textMuted }}
        >
          {isRepeated
            ? "The editor is still having trouble. This might be a server issue."
            : "If you have a browser extension like IDM or an ad blocker, try disabling it."}
        </p>
      </div>

      {isRepeated && (
        <div
          className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl max-w-xs text-left"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <InfoIcon
            className="w-3.5 h-3.5 mt-0.5 shrink-0"
            style={{ color: colors.textDim }}
          />
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: colors.textDim }}
          >
            The OnlyOffice server may be temporarily unavailable. Try again in a
            few minutes.
          </p>
        </div>
      )}

      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 text-[12px] font-medium px-4 py-2 rounded-xl transition-colors"
        style={{
          background: "rgba(255,255,255,0.06)",
          color: colors.textSecondary,
          border: `1px solid ${colors.border}`,
        }}
      >
        <RefreshCwIcon className="w-3.5 h-3.5" />
        {retryCount > 0 ? `Retry again (${retryCount})` : "Retry"}
      </button>
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
  const isMobile = useIsMobile(768);
  const [mobileWarningDismissed, setMobileWarningDismissed] = useState(false);

  const document = useQuery(
    api.documents.getById,
    isLoaded && isSignedIn ? { id: documentId } : "skip"
  );
  const updateDocument = useMutation(api.documents.update);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  const [editorError, setEditorError] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    if (!document) return;
    const resolve = async () => {
      setStorageError(null);
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
        setStorageError("Couldn't initialize document file.");
        toast.error("Couldn't initialize document. Please try again.");
      }
    };
    resolve();
  }, [document?.storageId, document?.fileUrl]);

  const handleRetry = () => {
    setEditorError(false);
    setEditorKey((k) => k + 1);
    setRetryCount((c) => c + 1);
  };

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (document === undefined) {
    return (
      <div className="flex flex-col h-dvh" style={{ background: colors.bg }}>
        {/* Mobile-only spacer — only shows on screens < sm to clear the overlay top navbar */}
        <div className="h-12 sm:hidden shrink-0" />
        {/* Skeleton header — always 44px */}
        <div
          className="flex items-center gap-3 px-4 h-11 shrink-0 animate-pulse"
          style={{
            borderBottom: `1px solid ${colors.borderSubtle}`,
            background: colors.bgSidebar,
          }}
        >
          <div
            className="w-20 h-3 rounded"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />
          <div className="w-px h-4" style={{ background: colors.border }} />
          <div
            className="w-44 h-3 rounded"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: colors.accentLight }}
            />
            <p className="text-[12px]" style={{ color: colors.textMuted }}>
              Loading document…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Not found or no access ──────────────────────────────────────────────────

  if (document === null) {
    const variant: ErrorVariant = !organization ? "no-access" : "not-found";
    const extraHint = !organization
      ? "If this is a shared document, switch to your organization and try again."
      : undefined;

    return (
      <ErrorState
        variant={variant}
        extraHint={extraHint}
        action={
          <>
            <button
              onClick={() => router.push("/documents")}
              className="text-[12px] font-medium px-4 py-2 rounded-xl transition-colors"
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
                className="flex items-center gap-1.5 text-[11px]"
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col overflow-hidden h-dvh"
      style={{ background: colors.bg }}
    >
      {/*
       * ── Mobile-only spacer ──────────────────────────────────────────────────
       * On mobile (<sm), the app has an overlay top navbar (48px / h-12).
       * This invisible spacer pushes the entire editor layout below it.
       * On sm+ (tablet/desktop), the navbar is a sidebar — no spacer needed.
       */}
      <div className="h-12 sm:hidden shrink-0" />

      {/* ── Header ─────────────────────────────────────────────────────────────
       * Always 44px (h-11) on every breakpoint.
       * No padding-top — the spacer above handles the mobile offset.
       */}
      <div
        className="flex items-center gap-2 px-3 sm:px-4 h-11 shrink-0"
        style={{
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: colors.bgSidebar,
        }}
      >
        {/* Back */}
        <Link
          href="/documents"
          className="flex items-center gap-1 text-[12px] font-medium transition-colors shrink-0"
          style={{ color: colors.textMuted }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = colors.textSecondary)
          }
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Documents</span>
        </Link>

        <span style={{ color: colors.textDim, fontSize: 12 }}>/</span>

        {/* Inline rename — touch-friendly, pencil always visible */}
        <InlineTitle
          initialValue={document.title}
          onSave={async (title) => {
            await updateDocument({ id: documentId, title });
          }}
        />

        {/* Org badge — desktop/tablet only */}
        {document.organizationId && organization && (
          <span
            className="hidden sm:flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
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
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <StatusPill ready={editorReady} error={editorError} />
        </div>
      </div>

      {/* ── Editor area ── */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {isMobile && !mobileWarningDismissed ? (
          <MobileRecommendation
            onContinue={() => setMobileWarningDismissed(true)}
          />
        ) : storageError ? (
          <ErrorState
            variant="storage"
            extraHint={storageError}
            action={
              <button
                onClick={() => {
                  setStorageError(null);
                  setFileUrl(null);
                }}
                className="flex items-center gap-1.5 text-[12px] font-medium px-4 py-2 rounded-xl transition-colors"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <RefreshCwIcon className="w-3.5 h-3.5" />
                Try again
              </button>
            }
          />
        ) : !fileUrl ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.accentLight }}
              />
              <p className="text-[12px]" style={{ color: colors.textMuted }}>
                Preparing document…
              </p>
            </div>
          </div>
        ) : editorError ? (
          <EditorErrorPanel onRetry={handleRetry} retryCount={retryCount} />
        ) : (
          <OnlyOfficeEditor
            key={editorKey}
            fileUrl={fileUrl}
            fileName={document.title}
            fileKey={`doc-${documentId}-${document.storageId?.slice(-8) ?? document._creationTime}`}
            documentId={documentId}
            storageId={document.storageId}
            userId={user?.id}
            userName={user?.fullName ?? user?.firstName ?? undefined}
            userAvatar={user?.imageUrl}
            onReady={() => {
              setEditorReady(true);
              setEditorError(false);
            }}
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
