"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeftIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
  FileTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BookOpenIcon,
  LinkIcon,
  PencilIcon,
  XIcon,
  MonitorIcon,
  TabletIcon,
  SmartphoneIcon,
  ArrowRightIcon,
  ZapOffIcon,
  TypeIcon,
  LayoutIcon,
  ScanIcon,
  SparklesIcon,
  InfoIcon,
  HashIcon,
  TableIcon,
  ToggleLeftIcon,
  CircleAlertIcon,
  WandSparklesIcon,
  ChevronRightIcon,
} from "lucide-react";
import { OnlyOfficeEditor } from "@/components/OnlyOfficeEditor";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  detectPlaceholders,
  type DetectedField,
} from "@/lib/placeholder-detector";
import { colors, fieldTypeColors } from "@/lib/design-tokens";
import { useAuth } from "@clerk/nextjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function extractAllText(buffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const targets = [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/header3.xml",
    "word/footer1.xml",
    "word/footer2.xml",
    "word/footer3.xml",
  ];
  const parts: string[] = [];
  for (const path of targets) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");
    parts.push(
      xml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
  }
  return parts.join("\n");
}

// ── Mobile detection ──────────────────────────────────────────────────────────

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

// ── Mobile recommendation ─────────────────────────────────────────────────────

const MOBILE_LIMITATIONS = [
  {
    icon: <LayoutIcon className="w-3.5 h-3.5" />,
    text: "Toolbar buttons are cramped and hard to tap",
  },
  {
    icon: <TypeIcon className="w-3.5 h-3.5" />,
    text: "Typing placeholders like {{name}} is awkward on a phone keyboard",
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
      <div
        className="flex flex-col items-center justify-center px-6 py-10 gap-5 text-center"
        style={{
          background: `linear-gradient(180deg, ${colors.bgSidebar} 0%, ${colors.bg} 100%)`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}
      >
        {/* Device trio */}
        <div className="flex items-end justify-center gap-2.5">
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
        <div className="space-y-1.5 max-w-[280px]">
          <p
            className="text-[15px] font-semibold leading-snug"
            style={{ color: colors.text }}
          >
            Template editing works best on a larger screen
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: colors.textMuted }}
          >
            Writing placeholders like{" "}
            <code
              className="font-mono text-[11px] px-1 rounded"
              style={{
                background: "rgba(255,255,255,0.07)",
                color: colors.accentPale,
              }}
            >
              {"{{field_name}}"}
            </code>{" "}
            is much easier with a full keyboard and mouse.
          </p>
        </div>
      </div>

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

      <div className="px-5 pb-8 space-y-2.5">
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
              Link copied — open on desktop
            </>
          ) : (
            <>
              <LinkIcon className="w-4 h-4" />
              Copy link to open on desktop
            </>
          )}
        </button>
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
          href="/templates"
          className="flex items-center justify-center text-[11px] py-1"
          style={{ color: colors.textDim }}
        >
          ← Back to templates
        </Link>
      </div>
    </div>
  );
}

// ── Inline title ──────────────────────────────────────────────────────────────

function InlineTitle({
  initialValue,
  onSave,
}: {
  initialValue: string;
  onSave: (v: string) => Promise<void>;
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
      toast.error("Couldn't save name.");
      setValue(initialValue);
    } finally {
      setSaving(false);
    }
  };

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
          placeholder="Template name…"
          className="flex-1 min-w-0 text-[13px] font-medium rounded-lg px-2.5 py-1.5 outline-none"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: `1px solid ${colors.accentBorder}`,
            color: colors.text,
            maxWidth: 280,
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
          style={{
            background: colors.accentBg,
            border: `1px solid ${colors.accentBorder}`,
          }}
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
        >
          <XIcon className="w-3 h-3" style={{ color: colors.textDim }} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-0 max-w-[160px] sm:max-w-[300px]"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${colors.borderSubtle}`,
      }}
      title="Rename template"
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
          style={{ color: colors.accentLight, opacity: 0.55 }}
        />
      )}
    </button>
  );
}

// ── Copy snippet ──────────────────────────────────────────────────────────────

function Snippet({
  code,
  label,
  color = "#a5b4fc",
  description,
}: {
  code: string;
  label?: string;
  color?: string;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left w-full"
      style={{
        background: copied ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${copied ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <code
          className="text-[12px] font-mono block"
          style={{ color: copied ? "#34d399" : color }}
        >
          {code}
        </code>
        {description && (
          <p
            className="text-[11px] mt-0.5 leading-relaxed"
            style={{ color: colors.textDim }}
          >
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
        {label && (
          <span className="text-[10px]" style={{ color: colors.textDim }}>
            {label}
          </span>
        )}
        {copied ? (
          <CheckIcon className="w-3 h-3" style={{ color: "#34d399" }} />
        ) : (
          <CopyIcon
            className="w-3 h-3"
            style={{ color: colors.textDim, opacity: 0.5 }}
          />
        )}
      </div>
    </button>
  );
}

// ── Field scan result panel ───────────────────────────────────────────────────

function FieldScanResultBar({
  fields,
  onDismiss,
}: {
  fields: DetectedField[];
  onDismiss: () => void;
}) {
  const simpleFields = fields.filter(
    (f) =>
      f.type === "text" ||
      f.type === "date" ||
      f.type === "number" ||
      f.type === "email"
  );
  const loopFields = fields.filter((f) => f.type === "loop");
  const conditionFields = fields.filter(
    (f) => f.type === "condition" || f.type === "condition_inverse"
  );

  const typeLabel: Record<string, { label: string; color: string }> = {
    text: { label: "Text", color: "#60a5fa" },
    date: { label: "Date", color: "#34d399" },
    number: { label: "Number", color: "#fb923c" },
    email: { label: "Email", color: "#c084fc" },
    loop: { label: "Table", color: "#818cf8" },
    condition: { label: "Show/Hide", color: "#f472b6" },
    condition_inverse: { label: "Show/Hide", color: "#fb7185" },
  };

  return (
    <div
      className="shrink-0 px-4 py-3 flex flex-col gap-2.5"
      style={{
        background: "rgba(52,211,153,0.04)",
        borderBottom: `1px solid rgba(52,211,153,0.12)`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(52,211,153,0.12)" }}
          >
            <ScanIcon className="w-3 h-3" style={{ color: "#34d399" }} />
          </div>
          <span
            className="text-[12px] font-semibold"
            style={{ color: colors.textSecondary }}
          >
            {fields.length === 0
              ? "No placeholders detected"
              : `${fields.length} field${fields.length !== 1 ? "s" : ""} detected`}
          </span>
          {fields.length > 0 && (
            <span className="text-[11px]" style={{ color: colors.textDim }}>
              — ready to fill
            </span>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors shrink-0"
          style={{ color: colors.textDim }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {fields.length === 0 ? (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-xl"
          style={{
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.15)",
          }}
        >
          <InfoIcon
            className="w-3.5 h-3.5 mt-0.5 shrink-0"
            style={{ color: "#fbbf24" }}
          />
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: colors.textMuted }}
          >
            No{" "}
            <code className="font-mono" style={{ color: "#fbbf24" }}>
              {"{{placeholders}}"}
            </code>{" "}
            were found in this document. Add them in the editor above, then
            click <strong style={{ color: colors.textSecondary }}>Save</strong>{" "}
            again to scan.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f) => {
            const meta = typeLabel[f.type] ?? {
              label: f.type,
              color: colors.textMuted,
            };
            return (
              <div
                key={f.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                style={{
                  background: `${meta.color}10`,
                  border: `1px solid ${meta.color}25`,
                }}
              >
                <code
                  className="text-[11px] font-mono"
                  style={{ color: meta.color }}
                >
                  {f.type === "loop"
                    ? `{{#${f.name}}}`
                    : f.type.startsWith("condition")
                      ? `{{#${f.name}}}`
                      : `{{${f.name}}}`}
                </code>
                <span className="text-[10px]" style={{ color: colors.textDim }}>
                  {meta.label}
                </span>
                {f.subFields && f.subFields.length > 0 && (
                  <span
                    className="text-[10px]"
                    style={{ color: colors.textDim }}
                  >
                    · {f.subFields.length} sub-field
                    {f.subFields.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary counts */}
      {fields.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {simpleFields.length > 0 && (
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              <span className="font-medium" style={{ color: "#60a5fa" }}>
                {simpleFields.length}
              </span>{" "}
              text field{simpleFields.length !== 1 ? "s" : ""}
            </span>
          )}
          {loopFields.length > 0 && (
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              <span className="font-medium" style={{ color: "#818cf8" }}>
                {loopFields.length}
              </span>{" "}
              table loop{loopFields.length !== 1 ? "s" : ""}
            </span>
          )}
          {conditionFields.length > 0 && (
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              <span className="font-medium" style={{ color: "#f472b6" }}>
                {conditionFields.length}
              </span>{" "}
              condition{conditionFields.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Syntax Guide ──────────────────────────────────────────────────────────────

type GuideTab = "quickstart" | "text" | "table" | "condition" | "mistakes";

const GUIDE_TABS: {
  id: GuideTab;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: "quickstart",
    label: "Quick Start",
    icon: <WandSparklesIcon className="w-3.5 h-3.5" />,
    color: "#34d399",
  },
  {
    id: "text",
    label: "Text fields",
    icon: <HashIcon className="w-3.5 h-3.5" />,
    color: "#60a5fa",
  },
  {
    id: "table",
    label: "Tables",
    icon: <TableIcon className="w-3.5 h-3.5" />,
    color: "#818cf8",
  },
  {
    id: "condition",
    label: "Show / Hide",
    icon: <ToggleLeftIcon className="w-3.5 h-3.5" />,
    color: "#f472b6",
  },
  {
    id: "mistakes",
    label: "Common mistakes",
    icon: <CircleAlertIcon className="w-3.5 h-3.5" />,
    color: "#fbbf24",
  },
];

function SyntaxGuideBar() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GuideTab>("quickstart");

  return (
    <div
      className="shrink-0"
      style={{
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
        background: "#0c0c10",
      }}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 sm:px-5 py-2.5"
        style={{ color: colors.textMuted }}
      >
        <BookOpenIcon
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: "#818cf8" }}
        />
        <span
          className="text-[12px] font-medium"
          style={{ color: colors.textSecondary }}
        >
          Placeholder guide
        </span>
        {/* Inline previews — desktop only */}
        <div className="hidden sm:flex items-center gap-1.5 ml-1">
          {[
            { code: "{{name}}", color: "#60a5fa" },
            { code: "{{#items}}", color: "#818cf8" },
            { code: "{{#if_paid}}", color: "#f472b6" },
          ].map(({ code, color }) => (
            <code
              key={code}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color,
              }}
            >
              {code}
            </code>
          ))}
        </div>
        <div
          className="ml-auto flex items-center gap-1.5 text-[11px] shrink-0"
          style={{ color: colors.textDim }}
        >
          {open ? "Hide" : "Show guide"}
          {open ? (
            <ChevronUpIcon className="w-3 h-3" />
          ) : (
            <ChevronDownIcon className="w-3 h-3" />
          )}
        </div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Tabs — horizontally scrollable on mobile */}
          <div
            className="flex overflow-x-auto border-b px-4 sm:px-5 gap-0 hide-scrollbar"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            {GUIDE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-medium border-b-2 transition-all whitespace-nowrap shrink-0"
                style={{
                  borderColor: activeTab === tab.id ? tab.color : "transparent",
                  color: activeTab === tab.id ? tab.color : colors.textDim,
                }}
              >
                <span
                  style={{
                    color: activeTab === tab.id ? tab.color : colors.textDim,
                  }}
                >
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="px-4 sm:px-5 py-4">
            {/* ── Quick Start ── */}
            {activeTab === "quickstart" && (
              <div className="space-y-4">
                <div
                  className="flex items-start gap-2 p-3 rounded-xl"
                  style={{
                    background: "rgba(52,211,153,0.05)",
                    border: "1px solid rgba(52,211,153,0.12)",
                  }}
                >
                  <SparklesIcon
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: "#34d399" }}
                  />
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: colors.textMuted }}
                  >
                    A placeholder is a{" "}
                    <strong style={{ color: colors.textSecondary }}>
                      field name surrounded by double curly braces
                    </strong>{" "}
                    — for example{" "}
                    <code
                      className="font-mono text-[11px] px-1 rounded"
                      style={{
                        background: "rgba(255,255,255,0.07)",
                        color: "#60a5fa",
                      }}
                    >
                      {"{{customer_name}}"}
                    </code>
                    . When someone fills this template, each placeholder gets
                    replaced with the real value.
                  </p>
                </div>

                {/* Before/after example */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Template side */}
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="px-3 py-1.5 flex items-center gap-1.5"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400 opacity-70" />
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: colors.textDim }}
                      >
                        Template (what you write)
                      </span>
                    </div>
                    <div
                      className="px-4 py-3 space-y-1 text-[12px] leading-relaxed"
                      style={{ color: colors.textMuted }}
                    >
                      <p>
                        Dear{" "}
                        <code
                          className="font-mono text-[11px] px-0.5 rounded"
                          style={{
                            background: "rgba(96,165,250,0.12)",
                            color: "#60a5fa",
                          }}
                        >
                          {"{{customer_name}}"}
                        </code>
                        ,
                      </p>
                      <p>
                        Your invoice{" "}
                        <code
                          className="font-mono text-[11px] px-0.5 rounded"
                          style={{
                            background: "rgba(96,165,250,0.12)",
                            color: "#60a5fa",
                          }}
                        >
                          {"{{invoice_number}}"}
                        </code>{" "}
                        for
                      </p>
                      <p>
                        <code
                          className="font-mono text-[11px] px-0.5 rounded"
                          style={{
                            background: "rgba(96,165,250,0.12)",
                            color: "#60a5fa",
                          }}
                        >
                          {"{{total_amount}}"}
                        </code>{" "}
                        is due on
                      </p>
                      <p>
                        <code
                          className="font-mono text-[11px] px-0.5 rounded"
                          style={{
                            background: "rgba(96,165,250,0.12)",
                            color: "#60a5fa",
                          }}
                        >
                          {"{{due_date}}"}
                        </code>
                        .
                      </p>
                    </div>
                  </div>
                  {/* Output side */}
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="px-3 py-1.5 flex items-center gap-1.5"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 opacity-70" />
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: colors.textDim }}
                      >
                        Output (after filling)
                      </span>
                    </div>
                    <div
                      className="px-4 py-3 space-y-1 text-[12px] leading-relaxed"
                      style={{ color: colors.textSecondary }}
                    >
                      <p>
                        Dear <strong>Budi Santoso</strong>,
                      </p>
                      <p>
                        Your invoice <strong>INV-2025-001</strong> for
                      </p>
                      <p>
                        <strong>Rp 5.000.000</strong> is due on
                      </p>
                      <p>
                        <strong>31 January 2025</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3-step summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      step: "1",
                      title: "Write placeholders",
                      desc: "Add {{field_name}} wherever you want a value to appear in your document.",
                      color: "#60a5fa",
                    },
                    {
                      step: "2",
                      title: "Click Save",
                      desc: "We scan the document and detect all your fields automatically.",
                      color: "#818cf8",
                    },
                    {
                      step: "3",
                      title: "Fill & generate",
                      desc: 'Click "Save & Use →" to fill the fields and download the finished document.',
                      color: "#34d399",
                    },
                  ].map(({ step, title, desc, color }) => (
                    <div
                      key={step}
                      className="flex flex-col gap-1.5 px-3.5 py-3 rounded-xl"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: `1px solid rgba(255,255,255,0.06)`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: `${color}15`,
                            color,
                            border: `1px solid ${color}30`,
                          }}
                        >
                          {step}
                        </span>
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: colors.textSecondary }}
                        >
                          {title}
                        </span>
                      </div>
                      <p
                        className="text-[11px] leading-relaxed"
                        style={{ color: colors.textDim }}
                      >
                        {desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Text fields ── */}
            {activeTab === "text" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <p
                      className="text-[12px] font-semibold mb-1.5"
                      style={{ color: "#60a5fa" }}
                    >
                      What it is
                    </p>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: colors.textMuted }}
                    >
                      The most common type. Write{" "}
                      <code
                        className="font-mono text-[11px]"
                        style={{ color: "#60a5fa" }}
                      >
                        {"{{field_name}}"}
                      </code>{" "}
                      anywhere in your document and it will be replaced with the
                      value you enter when generating.
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                      style={{ color: colors.textDim }}
                    >
                      Rules
                    </p>
                    <ul className="space-y-1.5">
                      {[
                        ["Letters, numbers, underscores only", true],
                        [
                          "Must start with a letter — not 1_field, but field_1",
                          true,
                        ],
                        [
                          "No spaces — use customer_name not customer name",
                          true,
                        ],
                        ["Case-sensitive: {{Name}} ≠ {{name}}", false],
                      ].map(([rule, isError]) => (
                        <li
                          key={rule as string}
                          className="flex items-start gap-1.5 text-[11px]"
                          style={{ color: colors.textMuted }}
                        >
                          <span
                            className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 opacity-60"
                            style={{
                              background: isError ? "#f87171" : "#60a5fa",
                            }}
                          />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="md:col-span-3 space-y-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: colors.textDim }}
                  >
                    Click to copy
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Snippet
                      code="{{customer_name}}"
                      description="Replaced with a person or company name"
                      color="#60a5fa"
                    />
                    <Snippet
                      code="{{invoice_date}}"
                      description="Any date value"
                      color="#60a5fa"
                    />
                    <Snippet
                      code="{{total_amount}}"
                      description="A number or currency"
                      color="#60a5fa"
                    />
                    <Snippet
                      code="{{email}}"
                      description="An email address"
                      color="#60a5fa"
                    />
                    <Snippet
                      code="{{address}}"
                      description="Multi-line text is fine too"
                      color="#60a5fa"
                    />
                    <Snippet
                      code="{{notes}}"
                      description="Optional long-form text"
                      color="#60a5fa"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Table / Loop ── */}
            {activeTab === "table" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <p
                      className="text-[12px] font-semibold mb-1.5"
                      style={{ color: "#818cf8" }}
                    >
                      What it is
                    </p>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: colors.textMuted }}
                    >
                      Use a loop to repeat a row for every item in a list —
                      perfect for invoice line items, product tables, or
                      employee lists.
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                      style={{ color: colors.textDim }}
                    >
                      How to set it up
                    </p>
                    <ul className="space-y-1.5">
                      {[
                        "Create a table in your document.",
                        "In the row BEFORE the data row, put {{#items}} alone.",
                        "In the data row, put your sub-fields like {{product_name}} {{qty}}.",
                        "In the row AFTER the data row, put {{/items}} alone.",
                        "Each of the three rows must be its own separate table row.",
                      ].map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-[11px]"
                          style={{ color: colors.textMuted }}
                        >
                          <span
                            className="mt-0.5 text-[10px] w-4 h-4 rounded-full flex items-center justify-center shrink-0 font-bold"
                            style={{
                              background: "rgba(129,140,248,0.15)",
                              color: "#818cf8",
                            }}
                          >
                            {i + 1}
                          </span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div
                    className="rounded-xl p-3 space-y-1.5"
                    style={{
                      background: "rgba(251,191,36,0.05)",
                      border: "1px solid rgba(251,191,36,0.15)",
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold"
                      style={{ color: "#fbbf24" }}
                    >
                      ⚠ Critical rule
                    </p>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: colors.textMuted }}
                    >
                      The opening{" "}
                      <code className="font-mono" style={{ color: "#818cf8" }}>
                        {"{{#items}}"}
                      </code>{" "}
                      and closing{" "}
                      <code className="font-mono" style={{ color: "#818cf8" }}>
                        {"{{/items}}"}
                      </code>{" "}
                      must each be in their{" "}
                      <strong style={{ color: colors.textSecondary }}>
                        own separate table row
                      </strong>
                      . Putting both in one row will break the template.
                    </p>
                  </div>
                </div>
                <div className="md:col-span-3 space-y-3">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: colors.textDim }}
                  >
                    Copy in order
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Snippet
                      code="{{#items}}"
                      label="① open row"
                      color="#818cf8"
                      description="Paste this in its own table row"
                    />
                    <Snippet
                      code="{{product_name}}"
                      label="② data"
                      color="#a5b4fc"
                      description="Sub-field in the data row"
                    />
                    <Snippet
                      code="{{qty}}"
                      label="② data"
                      color="#a5b4fc"
                      description="Sub-field in the data row"
                    />
                    <Snippet
                      code="{{unit_price}}"
                      label="② data"
                      color="#a5b4fc"
                      description="Sub-field in the data row"
                    />
                    <Snippet
                      code="{{/items}}"
                      label="③ close row"
                      color="#818cf8"
                      description="Paste this in its own table row"
                    />
                  </div>

                  {/* Visual table diagram */}
                  <div
                    className="rounded-xl overflow-hidden mt-1"
                    style={{ border: "1px solid rgba(129,140,248,0.2)" }}
                  >
                    <div
                      className="px-3 py-1.5 flex items-center gap-2"
                      style={{
                        background: "rgba(129,140,248,0.08)",
                        borderBottom: "1px solid rgba(129,140,248,0.15)",
                      }}
                    >
                      <TableIcon
                        className="w-3 h-3"
                        style={{ color: "#818cf8" }}
                      />
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: "#818cf8" }}
                      >
                        How your table should look
                      </span>
                    </div>
                    {[
                      {
                        label: "Header row",
                        content: "Product Name  ·  Qty  ·  Price",
                        bg: "rgba(255,255,255,0.04)",
                        textColor: colors.textMuted,
                        note: "Normal header text",
                      },
                      {
                        label: "Open row",
                        content: "{{#items}}",
                        bg: "rgba(129,140,248,0.08)",
                        textColor: "#818cf8",
                        note: "Alone in this row",
                      },
                      {
                        label: "Data row",
                        content:
                          "{{product_name}}  ·  {{qty}}  ·  {{unit_price}}",
                        bg: "rgba(255,255,255,0.02)",
                        textColor: "#a5b4fc",
                        note: "Your sub-fields",
                      },
                      {
                        label: "Close row",
                        content: "{{/items}}",
                        bg: "rgba(129,140,248,0.08)",
                        textColor: "#818cf8",
                        note: "Alone in this row",
                      },
                    ].map(({ label, content, bg, textColor, note }) => (
                      <div
                        key={label}
                        className="flex items-start gap-2 sm:gap-3 px-3 py-2"
                        style={{
                          background: bg,
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <span
                          className="text-[10px] w-16 sm:w-20 shrink-0 mt-0.5"
                          style={{ color: colors.textDim }}
                        >
                          {label}
                        </span>
                        <code
                          className="text-[10px] font-mono flex-1 break-all"
                          style={{ color: textColor }}
                        >
                          {content}
                        </code>
                        <span
                          className="text-[10px] shrink-0 hidden sm:block"
                          style={{ color: colors.textDim }}
                        >
                          {note}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Show/Hide / Condition ── */}
            {activeTab === "condition" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <p
                      className="text-[12px] font-semibold mb-1.5"
                      style={{ color: "#f472b6" }}
                    >
                      What it is
                    </p>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: colors.textMuted }}
                    >
                      Wrap a block of content so it only appears when a
                      condition is true or false. Useful for showing a discount
                      section only when a discount is applied.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        operator: "#",
                        syntax: "{{#field_name}}",
                        color: "#f472b6",
                        title: "Show when TRUE",
                        desc: 'Renders the block when the value is "true", "yes", or non-empty.',
                      },
                      {
                        operator: "^",
                        syntax: "{{^field_name}}",
                        color: "#fb7185",
                        title: "Show when FALSE",
                        desc: 'Renders the block when the value is false, empty, or "no". Great for fallback messages.',
                      },
                    ].map(({ operator, syntax, color, title, desc }) => (
                      <div
                        key={operator}
                        className="rounded-xl p-3 space-y-1.5"
                        style={{
                          background: `${color}07`,
                          border: `1px solid ${color}20`,
                        }}
                      >
                        <code
                          className="text-[12px] font-mono font-semibold"
                          style={{ color }}
                        >
                          {syntax}…{"{{/" + "field_name}}"}
                        </code>
                        <p
                          className="text-[11px] font-medium"
                          style={{ color: colors.textSecondary }}
                        >
                          {title}
                        </p>
                        <p
                          className="text-[11px] leading-relaxed"
                          style={{ color: colors.textDim }}
                        >
                          {desc}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${colors.borderSubtle}`,
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1"
                      style={{ color: colors.textSecondary }}
                    >
                      When filling the form
                    </p>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: colors.textDim }}
                    >
                      Set the field to{" "}
                      <code className="font-mono" style={{ color: "#34d399" }}>
                        true
                      </code>{" "}
                      to show the block, or{" "}
                      <code className="font-mono" style={{ color: "#f87171" }}>
                        false
                      </code>{" "}
                      to hide it.
                    </p>
                  </div>
                </div>
                <div className="md:col-span-3 space-y-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: colors.textDim }}
                  >
                    Examples
                  </p>

                  {/* Truthy example */}
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid rgba(244,114,182,0.2)" }}
                  >
                    <div
                      className="px-3 py-1.5"
                      style={{
                        background: "rgba(244,114,182,0.07)",
                        borderBottom: "1px solid rgba(244,114,182,0.15)",
                      }}
                    >
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: "#f472b6" }}
                      >
                        Show a discount block (truthy)
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <Snippet
                        code="{{#show_discount}}"
                        color="#f472b6"
                        description="Opens the block — use at the start"
                      />
                      <Snippet
                        code="Discount: {{discount_amount}}"
                        color="#d8b4fe"
                        description="Content shown when true"
                      />
                      <Snippet
                        code="{{/show_discount}}"
                        color="#f472b6"
                        description="Closes the block — must match opening name"
                      />
                    </div>
                  </div>

                  {/* Falsy example */}
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid rgba(251,113,133,0.2)" }}
                  >
                    <div
                      className="px-3 py-1.5"
                      style={{
                        background: "rgba(251,113,133,0.07)",
                        borderBottom: "1px solid rgba(251,113,133,0.15)",
                      }}
                    >
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: "#fb7185" }}
                      >
                        Show fallback when list is empty (falsy)
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <Snippet
                        code="{{^items}}"
                        color="#fb7185"
                        description="Shows block when items is empty / false"
                      />
                      <Snippet
                        code="No items in this order."
                        color="#d8b4fe"
                        description="Fallback text"
                      />
                      <Snippet
                        code="{{/items}}"
                        color="#fb7185"
                        description="Closes the block"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Common mistakes ── */}
            {activeTab === "mistakes" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    title: "Open and close in the same table cell",
                    bad: "{{#items}} data {{/items}} in one cell",
                    good: "Put {{#items}}, data row, {{/items}} in three separate rows",
                    type: "error",
                  },
                  {
                    title: "Spaces in field names",
                    bad: "{{customer name}}",
                    good: "{{customer_name}} — use underscores",
                    type: "error",
                  },
                  {
                    title: "Opening tag with no closing tag",
                    bad: "{{#section}} with no {{/section}}",
                    good: "Every {{#name}} must have a matching {{/name}}",
                    type: "error",
                  },
                  {
                    title: "Field name starts with a number",
                    bad: "{{1name}} or {{2items}}",
                    good: "{{item_1}} or {{items}} — must start with a letter",
                    type: "error",
                  },
                  {
                    title: "Inconsistent casing for same field",
                    bad: "{{Item}} in one place, {{item}} in another",
                    good: "Pick one casing and use it consistently everywhere",
                    type: "warn",
                  },
                  {
                    title: "Editor splits placeholder across runs",
                    bad: "{{custo- (line break) -mer_name}} broken by ONLYOFFICE",
                    good: "Click Save — the preprocessor merges split placeholders automatically",
                    type: "info",
                  },
                ].map(({ title, bad, good, type }) => (
                  <div
                    key={title}
                    className="rounded-xl p-3 space-y-2"
                    style={{
                      background:
                        type === "error"
                          ? "rgba(248,113,113,0.05)"
                          : type === "warn"
                            ? "rgba(251,191,36,0.05)"
                            : "rgba(52,211,153,0.05)",
                      border: `1px solid ${type === "error" ? "rgba(248,113,113,0.15)" : type === "warn" ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.15)"}`,
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold"
                      style={{
                        color:
                          type === "error"
                            ? "#f87171"
                            : type === "warn"
                              ? "#fbbf24"
                              : "#34d399",
                      }}
                    >
                      {title}
                    </p>
                    <div className="flex items-start gap-2">
                      <span
                        className="text-[11px] font-bold shrink-0"
                        style={{ color: "#f87171" }}
                      >
                        ✗
                      </span>
                      <code
                        className="text-[10px] font-mono break-all"
                        style={{ color: colors.textMuted }}
                      >
                        {bad}
                      </code>
                    </div>
                    <div className="flex items-start gap-2">
                      <span
                        className="text-[11px] font-bold shrink-0"
                        style={{ color: "#34d399" }}
                      >
                        ✓
                      </span>
                      <span
                        className="text-[11px] leading-relaxed"
                        style={{ color: colors.textSecondary }}
                      >
                        {good}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplateEditPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as Id<"templates">;
  const { isLoaded, isSignedIn } = useAuth();

  const isMobile = useIsMobile(768);
  const [mobileWarningDismissed, setMobileWarningDismissed] = useState(false);

  const template = useQuery(
    api.templates.getById,
    isLoaded && isSignedIn ? { id: templateId } : "skip"
  );
  const updateTemplate = useMutation(api.templates.update);

  const [editorError, setEditorError] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<DetectedField[] | null>(
    null
  );
  const [showScanResult, setShowScanResult] = useState(false);

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!saving) scanAndSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saving]);

  const scanAndSave = useCallback(
    async (redirectTo?: "fill") => {
      if (saving || !template) return;
      setSaving(true);
      setShowScanResult(false);
      try {
        const res = await fetch(
          `/api/onlyoffice-file?url=${encodeURIComponent(template.fileUrl)}`
        );
        if (!res.ok) throw new Error("Failed to fetch template file");
        const buffer = await res.arrayBuffer();
        const fullText = await extractAllText(buffer);
        const detected = detectPlaceholders(fullText);

        await updateTemplate({
          id: templateId,
          previewText: fullText,
          fields: detected.map((f) => ({
            id: f.id,
            name: f.name,
            label: f.label,
            type: f.type,
            required: f.required,
            placeholder: f.placeholder,
            subFields: f.subFields?.map((sf) => ({
              id: sf.id,
              name: sf.name,
              label: sf.label,
              type: sf.type,
              required: sf.required,
              placeholder: sf.placeholder,
            })),
          })),
        });

        setLastScanResult(detected);
        setShowScanResult(true);

        const count = detected.length;
        toast.success(
          count > 0
            ? `Saved — ${count} field${count !== 1 ? "s" : ""} detected`
            : "Saved — no placeholders found yet"
        );
        if (redirectTo === "fill") router.push(`/templates/${templateId}/fill`);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't save. Check your connection and try again.");
      } finally {
        setSaving(false);
      }
    },
    [saving, template, templateId, updateTemplate, router]
  );

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (template === undefined) {
    return (
      <div className="flex flex-col h-dvh" style={{ background: colors.bg }}>
        <div className="h-12 sm:hidden shrink-0" />
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
            className="w-40 h-3 rounded"
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
              Loading template…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (template === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-dvh gap-5 p-8 text-center"
        style={{ background: colors.bg }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <AlertCircleIcon
            className="w-6 h-6"
            style={{ color: colors.textDim }}
          />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <p
            className="text-[14px] font-semibold"
            style={{ color: colors.text }}
          >
            Template not found
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: colors.textMuted }}
          >
            This template may have been deleted or you don't have access to it.
          </p>
        </div>
        <button
          onClick={() => router.push("/templates")}
          className="text-[12px] font-medium px-4 py-2 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
          }}
        >
          ← Back to Templates
        </button>
      </div>
    );
  }

  const currentFieldCount = template.fields?.length ?? 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col overflow-hidden h-dvh"
      style={{ background: colors.bg }}
    >
      {/* Mobile-only spacer */}
      <div className="h-12 sm:hidden shrink-0" />

      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-3 sm:px-4 h-11 shrink-0"
        style={{
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: colors.bgSidebar,
        }}
      >
        {/* Back */}
        <Link
          href="/templates"
          className="flex items-center gap-1 text-[12px] font-medium transition-colors shrink-0"
          style={{ color: colors.textMuted }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = colors.accentLight)
          }
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Templates</span>
        </Link>

        <span style={{ color: colors.textDim, fontSize: 12 }}>/</span>

        {/* Inline rename */}
        <InlineTitle
          initialValue={template.name}
          onSave={async (name) => {
            await updateTemplate({ id: templateId, name });
          }}
        />

        {/* Field count badge */}
        {currentFieldCount > 0 && (
          <div
            className="hidden sm:flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: "rgba(129,140,248,0.1)",
              color: "#818cf8",
              border: "1px solid rgba(129,140,248,0.2)",
            }}
          >
            <ScanIcon className="w-2.5 h-2.5" />
            {currentFieldCount} field{currentFieldCount !== 1 ? "s" : ""}
          </div>
        )}

        {/* Editor status dot — desktop */}
        {editorReady && !editorError && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: colors.success,
                boxShadow: `0 0 5px ${colors.success}`,
              }}
            />
            <span className="text-[11px]" style={{ color: colors.textDim }}>
              Live
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Save */}
          <button
            onClick={() => scanAndSave()}
            disabled={saving}
            className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
            }}
            title="Save (Ctrl+S)"
          >
            {saving ? (
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.textMuted }}
              />
            ) : (
              <CheckIcon className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {saving ? "Saving…" : "Save"}
            </span>
          </button>

          {/* Save & Use */}
          <button
            onClick={() => scanAndSave("fill")}
            disabled={saving}
            className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 sm:px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: "rgba(99,102,241,0.18)",
              color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.28)",
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.background = "rgba(99,102,241,0.28)";
                e.currentTarget.style.boxShadow =
                  "0 0 12px rgba(99,102,241,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(99,102,241,0.18)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {saving ? (
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.accentLight }}
              />
            ) : (
              <FileTextIcon className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Save & Use</span>
            <ChevronRightIcon className="w-3 h-3 hidden sm:block" />
          </button>

          {/* Connect Form */}
          <Link
            href={`/templates/${templateId}/connect`}
            className="hidden sm:flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34d399",
              border: "1px solid rgba(52,211,153,0.2)",
            }}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Connect Form
          </Link>
        </div>
      </div>

      {/* ── Keyboard shortcut hint — shows once until dismissed ── */}
      {/* (rendered only on sm+, non-intrusively) */}

      {/* ── Syntax guide ── */}
      <SyntaxGuideBar />

      {/* ── Field scan result ── */}
      {showScanResult && lastScanResult !== null && (
        <FieldScanResultBar
          fields={lastScanResult}
          onDismiss={() => setShowScanResult(false)}
        />
      )}

      {/* ── Editor area ── */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {isMobile && !mobileWarningDismissed ? (
          <MobileRecommendation
            onContinue={() => setMobileWarningDismissed(true)}
          />
        ) : editorError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: colors.dangerBg,
                border: `1px solid ${colors.danger}22`,
              }}
            >
              <AlertCircleIcon
                className="w-6 h-6"
                style={{ color: colors.danger }}
              />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <p
                className="text-[14px] font-semibold"
                style={{ color: colors.text }}
              >
                Editor couldn&apos;t load
              </p>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: colors.textMuted }}
              >
                {retryCount >= 2
                  ? "The editor is still having trouble. The OnlyOffice server may be temporarily unavailable."
                  : "If you have a browser extension like IDM or an ad blocker, try disabling it."}
              </p>
            </div>
            {retryCount >= 2 && (
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
                  You can still use the template by clicking{" "}
                  <strong style={{ color: colors.textSecondary }}>
                    Save & Use
                  </strong>{" "}
                  in the header — the editor is only for editing the template
                  document.
                </p>
              </div>
            )}
            <button
              onClick={() => {
                setEditorError(false);
                setEditorKey((k) => k + 1);
                setRetryCount((c) => c + 1);
              }}
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
        ) : (
          <div
            className="relative flex-1 w-full h-full"
            style={{ minHeight: 0 }}
          >
            {/* Loading overlay — visible until OnlyOffice fires onDocumentReady */}
            {!editorReady && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
                style={{ background: colors.bg }}
              >
                <div
                  className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: colors.accentLight }}
                />
                <p className="text-[12px]" style={{ color: colors.textMuted }}>
                  Loading editor…
                </p>
              </div>
            )}
            <OnlyOfficeEditor
              key={editorKey}
              fileUrl={template.fileUrl}
              fileName={template.name}
              fileKey={`tmpl-${templateId}-${template.storageId?.slice(-8) ?? (template as any)._creationTime}`}
              templateId={templateId}
              storageId={template.storageId}
              onReady={() => {
                setEditorReady(true);
                setEditorError(false);
              }}
              onError={() => {
                setEditorError(true);
                setEditorReady(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
