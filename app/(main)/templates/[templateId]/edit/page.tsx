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
import { fieldTypeColors } from "@/lib/design-tokens";
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
      style={{ background: "var(--bg)" }}
    >
      <div
        className="flex flex-col items-center justify-center px-6 py-10 gap-5 text-center"
        style={{
          background: `linear-gradient(180deg, var(--bg-sidebar) 0%, var(--bg) 100%)`,
          borderBottom: `1px solid var(--border-subtle)`,
        }}
      >
        {/* Device trio */}
        <div className="flex items-end justify-center gap-2.5">
          <div
            className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl"
            style={{
              background: "var(--accent-bg)",
              border: `1px solid var(--accent-border)`,
            }}
          >
            <MonitorIcon
              className="w-7 h-7"
              style={{ color: "var(--accent-light)" }}
            />
            <div className="flex flex-col items-center gap-0.5">
              <span
                className="text-[11px] font-semibold"
                style={{ color: "var(--accent-light)" }}
              >
                Desktop
              </span>
              <span
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-border)",
                  color: "var(--accent-light)",
                }}
              >
                Recommended
              </span>
            </div>
          </div>
          <div
            className="flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            <TabletIcon
              className="w-6 h-6"
              style={{ color: "var(--text-secondary)" }}
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Tablet
            </span>
          </div>
          <div
            className="flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
              opacity: 0.45,
            }}
          >
            <SmartphoneIcon
              className="w-5 h-5"
              style={{ color: "var(--text-dim)" }}
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--text-dim)" }}
            >
              Phone
            </span>
          </div>
        </div>
        <div className="space-y-1.5 max-w-[280px]">
          <p
            className="text-[15px] font-semibold leading-snug"
            style={{ color: "var(--text)" }}
          >
            Template editing works best on a larger screen
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Writing placeholders like{" "}
            <code
              className="font-mono text-[11px] px-1 rounded"
              style={{
                background: "var(--bg-input)",
                color: "var(--accent-pale)",
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
          style={{ color: "var(--text-dim)" }}
        >
          What you may experience on mobile
        </p>
        {MOBILE_LIMITATIONS.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            <span
              className="shrink-0 mt-0.5"
              style={{ color: "var(--text-dim)" }}
            >
              {item.icon}
            </span>
            <p
              className="text-[12px] leading-relaxed"
              style={{ color: "var(--text-muted)" }}
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
            background: copied ? "var(--success-bg)" : "var(--accent-bg)",
            color: copied ? "var(--success)" : "var(--accent-light)",
            border: `1px solid ${copied ? "color-mix(in srgb, var(--success) 40%, transparent)" : "var(--accent-border)"}`,
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
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          Continue on mobile anyway
          <ArrowRightIcon className="w-3.5 h-3.5" />
        </button>
        <Link
          href="/templates"
          className="flex items-center justify-center text-[11px] py-1"
          style={{ color: "var(--text-dim)" }}
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
            background: "var(--bg-input)",
            border: `1px solid var(--accent-border)`,
            color: "var(--text)",
            maxWidth: 280,
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
          style={{
            background: "var(--accent-bg)",
            border: `1px solid var(--accent-border)`,
          }}
        >
          {saving ? (
            <div
              className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent-light)" }}
            />
          ) : (
            <CheckIcon
              className="w-3 h-3"
              style={{ color: "var(--accent-light)" }}
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
            background: "var(--bg-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          <XIcon className="w-3 h-3" style={{ color: "var(--text-dim)" }} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-0 max-w-[160px] sm:max-w-[300px]"
      style={{
        background: "var(--bg-muted)",
        border: `1px solid var(--border-subtle)`,
      }}
      title="Rename template"
    >
      <span
        className="text-[13px] font-medium truncate"
        style={{ color: saved ? "var(--success)" : "var(--text)" }}
      >
        {value}
      </span>
      {saved ? (
        <CheckIcon
          className="w-3 h-3 shrink-0"
          style={{ color: "var(--success)" }}
        />
      ) : (
        <PencilIcon
          className="w-3 h-3 shrink-0"
          style={{ color: "var(--accent-light)", opacity: 0.55 }}
        />
      )}
    </button>
  );
}

// ── Copy snippet ──────────────────────────────────────────────────────────────

function Snippet({
  code,
  label,
  color = "var(--accent-pale)",
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
        background: copied ? "var(--success-bg)" : "var(--bg-muted)",
        border: `1px solid ${copied ? "color-mix(in srgb, var(--success) 25%, transparent)" : "var(--border-subtle)"}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <code
          className="text-[12px] font-mono block"
          style={{ color: copied ? "var(--success)" : color }}
        >
          {code}
        </code>
        {description && (
          <p
            className="text-[11px] mt-0.5 leading-relaxed"
            style={{ color: "var(--text-dim)" }}
          >
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
        {label && (
          <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
            {label}
          </span>
        )}
        {copied ? (
          <CheckIcon className="w-3 h-3" style={{ color: "var(--success)" }} />
        ) : (
          <CopyIcon
            className="w-3 h-3"
            style={{ color: "var(--text-dim)", opacity: 0.5 }}
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

  // Uses CSS variables for theme-correct colors
  const typeLabel: Record<string, { label: string; color: string }> = {
    text: { label: "Text", color: "var(--field-text)" },
    date: { label: "Date", color: "var(--field-date)" },
    number: { label: "Number", color: "var(--field-number)" },
    email: { label: "Email", color: "var(--field-email)" },
    loop: { label: "Table", color: "var(--field-loop)" },
    condition: { label: "Show/Hide", color: "var(--field-condition)" },
    condition_inverse: {
      label: "Show/Hide",
      color: "var(--field-condition-inverse)",
    },
  };

  return (
    <div
      className="shrink-0 px-4 py-3 flex flex-col gap-2.5"
      style={{
        background: "var(--success-bg)",
        borderBottom: `1px solid color-mix(in srgb, var(--success) 15%, transparent)`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-lg flex items-center justify-center"
            style={{
              background: "color-mix(in srgb, var(--success) 15%, transparent)",
            }}
          >
            <ScanIcon className="w-3 h-3" style={{ color: "var(--success)" }} />
          </div>
          <span
            className="text-[12px] font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            {fields.length === 0
              ? "No placeholders detected"
              : `${fields.length} field${fields.length !== 1 ? "s" : ""} detected`}
          </span>
          {fields.length > 0 && (
            <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
              — ready to fill
            </span>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors shrink-0"
          style={{ color: "var(--text-dim)" }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {fields.length === 0 ? (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-xl"
          style={{
            background: "var(--warning-bg)",
            border:
              "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
          }}
        >
          <InfoIcon
            className="w-3.5 h-3.5 mt-0.5 shrink-0"
            style={{ color: "var(--warning)" }}
          />
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            No{" "}
            <code className="font-mono" style={{ color: "var(--warning)" }}>
              {"{{placeholders}}"}
            </code>{" "}
            were found in this document. Add them in the editor above, then
            click{" "}
            <strong style={{ color: "var(--text-secondary)" }}>Save</strong>{" "}
            again to scan.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f) => {
            const meta = typeLabel[f.type] ?? {
              label: f.type,
              color: "var(--text-muted)",
            };
            return (
              <div
                key={f.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${meta.color} 20%, transparent)`,
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
                <span
                  className="text-[10px]"
                  style={{ color: "var(--text-dim)" }}
                >
                  {meta.label}
                </span>
                {f.subFields && f.subFields.length > 0 && (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-dim)" }}
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
            <span
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              <span
                className="font-medium"
                style={{ color: "var(--field-text)" }}
              >
                {simpleFields.length}
              </span>{" "}
              text field{simpleFields.length !== 1 ? "s" : ""}
            </span>
          )}
          {loopFields.length > 0 && (
            <span
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              <span
                className="font-medium"
                style={{ color: "var(--field-loop)" }}
              >
                {loopFields.length}
              </span>{" "}
              table loop{loopFields.length !== 1 ? "s" : ""}
            </span>
          )}
          {conditionFields.length > 0 && (
            <span
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              <span
                className="font-medium"
                style={{ color: "var(--field-condition)" }}
              >
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
    color: "var(--success)",
  },
  {
    id: "text",
    label: "Text fields",
    icon: <HashIcon className="w-3.5 h-3.5" />,
    color: "var(--field-text)",
  },
  {
    id: "table",
    label: "Tables",
    icon: <TableIcon className="w-3.5 h-3.5" />,
    color: "var(--field-loop)",
  },
  {
    id: "condition",
    label: "Show / Hide",
    icon: <ToggleLeftIcon className="w-3.5 h-3.5" />,
    color: "var(--field-condition)",
  },
  {
    id: "mistakes",
    label: "Common mistakes",
    icon: <CircleAlertIcon className="w-3.5 h-3.5" />,
    color: "var(--warning)",
  },
];

function SyntaxGuideBar() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GuideTab>("quickstart");

  return (
    <div
      className="shrink-0"
      style={{
        borderBottom: `1px solid var(--border-subtle)`,
        background: "var(--bg-sidebar)",
      }}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 sm:px-5 py-2.5"
        style={{ color: "var(--text-muted)" }}
      >
        <BookOpenIcon
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: "var(--field-loop)" }}
        />
        <span
          className="text-[12px] font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Placeholder guide
        </span>
        {/* Inline previews — desktop only */}
        <div className="hidden sm:flex items-center gap-1.5 ml-1">
          {[
            { code: "{{name}}", color: "var(--field-text)" },
            { code: "{{#items}}", color: "var(--field-loop)" },
            { code: "{{#if_paid}}", color: "var(--field-condition)" },
          ].map(({ code, color }) => (
            <code
              key={code}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border-hover)",
                color,
              }}
            >
              {code}
            </code>
          ))}
        </div>
        <div
          className="ml-auto flex items-center gap-1.5 text-[11px] shrink-0"
          style={{ color: "var(--text-dim)" }}
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
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {/* Tabs — horizontally scrollable on mobile */}
          <div
            className="flex overflow-x-auto border-b px-4 sm:px-5 gap-0 hide-scrollbar"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {GUIDE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-medium border-b-2 transition-all whitespace-nowrap shrink-0"
                style={{
                  borderColor: activeTab === tab.id ? tab.color : "transparent",
                  color: activeTab === tab.id ? tab.color : "var(--text-dim)",
                }}
              >
                <span
                  style={{
                    color: activeTab === tab.id ? tab.color : "var(--text-dim)",
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
                    background: "var(--success-bg)",
                    border:
                      "1px solid color-mix(in srgb, var(--success) 15%, transparent)",
                  }}
                >
                  <SparklesIcon
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: "var(--success)" }}
                  />
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    A placeholder is a{" "}
                    <strong style={{ color: "var(--text-secondary)" }}>
                      field name surrounded by double curly braces
                    </strong>{" "}
                    — for example{" "}
                    <code
                      className="font-mono text-[11px] px-1 rounded"
                      style={{
                        background: "var(--bg-input)",
                        color: "var(--field-text)",
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
                    style={{ border: "1px solid var(--border-hover)" }}
                  >
                    <div
                      className="px-3 py-1.5 flex items-center gap-1.5"
                      style={{
                        background: "var(--bg-muted)",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400 opacity-70" />
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-dim)" }}
                      >
                        Template (what you write)
                      </span>
                    </div>
                    <div
                      className="px-4 py-3 space-y-1 text-[12px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <p>
                        Dear{" "}
                        <code
                          className="font-mono text-[11px] px-0.5 rounded"
                          style={{
                            background:
                              "color-mix(in srgb, var(--field-text) 12%, transparent)",
                            color: "var(--field-text)",
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
                            background:
                              "color-mix(in srgb, var(--field-text) 12%, transparent)",
                            color: "var(--field-text)",
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
                            background:
                              "color-mix(in srgb, var(--field-text) 12%, transparent)",
                            color: "var(--field-text)",
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
                            background:
                              "color-mix(in srgb, var(--field-text) 12%, transparent)",
                            color: "var(--field-text)",
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
                    style={{ border: "1px solid var(--border-hover)" }}
                  >
                    <div
                      className="px-3 py-1.5 flex items-center gap-1.5"
                      style={{
                        background: "var(--bg-muted)",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 opacity-70" />
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-dim)" }}
                      >
                        Output (after filling)
                      </span>
                    </div>
                    <div
                      className="px-4 py-3 space-y-1 text-[12px] leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
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
                      color: "var(--field-text)",
                    },
                    {
                      step: "2",
                      title: "Click Save",
                      desc: "We scan the document and detect all your fields automatically.",
                      color: "var(--field-loop)",
                    },
                    {
                      step: "3",
                      title: "Fill & generate",
                      desc: 'Click "Save & Use →" to fill the fields and download the finished document.',
                      color: "var(--success)",
                    },
                  ].map(({ step, title, desc, color }) => (
                    <div
                      key={step}
                      className="flex flex-col gap-1.5 px-3.5 py-3 rounded-xl"
                      style={{
                        background: "var(--bg-card)",
                        border: `1px solid var(--border-subtle)`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: `color-mix(in srgb, ${color} 15%, transparent)`,
                            color,
                            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                          }}
                        >
                          {step}
                        </span>
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {title}
                        </span>
                      </div>
                      <p
                        className="text-[11px] leading-relaxed"
                        style={{ color: "var(--text-dim)" }}
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
                      style={{ color: "var(--field-text)" }}
                    >
                      What it is
                    </p>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      The most common type. Write{" "}
                      <code
                        className="font-mono text-[11px]"
                        style={{ color: "var(--field-text)" }}
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
                      style={{ color: "var(--text-dim)" }}
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
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span
                            className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 opacity-60"
                            style={{
                              background: isError
                                ? "var(--danger)"
                                : "var(--field-text)",
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
                    style={{ color: "var(--text-dim)" }}
                  >
                    Click to copy
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Snippet
                      code="{{customer_name}}"
                      description="Replaced with a person or company name"
                      color="var(--field-text)"
                    />
                    <Snippet
                      code="{{invoice_date}}"
                      description="Any date value"
                      color="var(--field-text)"
                    />
                    <Snippet
                      code="{{total_amount}}"
                      description="A number or currency"
                      color="var(--field-text)"
                    />
                    <Snippet
                      code="{{email}}"
                      description="An email address"
                      color="var(--field-text)"
                    />
                    <Snippet
                      code="{{address}}"
                      description="Multi-line text is fine too"
                      color="var(--field-text)"
                    />
                    <Snippet
                      code="{{notes}}"
                      description="Optional long-form text"
                      color="var(--field-text)"
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
                      style={{ color: "var(--field-loop)" }}
                    >
                      What it is
                    </p>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Use a loop to repeat a row for every item in a list —
                      perfect for invoice line items, product tables, or
                      employee lists.
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                      style={{ color: "var(--text-dim)" }}
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
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span
                            className="mt-0.5 text-[10px] w-4 h-4 rounded-full flex items-center justify-center shrink-0 font-bold"
                            style={{
                              background:
                                "color-mix(in srgb, var(--field-loop) 15%, transparent)",
                              color: "var(--field-loop)",
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
                      background: "var(--warning-bg)",
                      border:
                        "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold"
                      style={{ color: "var(--warning)" }}
                    >
                      ⚠ Critical rule
                    </p>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      The opening{" "}
                      <code
                        className="font-mono"
                        style={{ color: "var(--field-loop)" }}
                      >
                        {"{{#items}}"}
                      </code>{" "}
                      and closing{" "}
                      <code
                        className="font-mono"
                        style={{ color: "var(--field-loop)" }}
                      >
                        {"{{/items}}"}
                      </code>{" "}
                      must each be in their{" "}
                      <strong style={{ color: "var(--text-secondary)" }}>
                        own separate table row
                      </strong>
                      . Putting both in one row will break the template.
                    </p>
                  </div>
                </div>
                <div className="md:col-span-3 space-y-3">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Copy in order
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Snippet
                      code="{{#items}}"
                      label="① open row"
                      color="var(--field-loop)"
                      description="Paste this in its own table row"
                    />
                    <Snippet
                      code="{{product_name}}"
                      label="② data"
                      color="var(--accent-pale)"
                      description="Sub-field in the data row"
                    />
                    <Snippet
                      code="{{qty}}"
                      label="② data"
                      color="var(--accent-pale)"
                      description="Sub-field in the data row"
                    />
                    <Snippet
                      code="{{unit_price}}"
                      label="② data"
                      color="var(--accent-pale)"
                      description="Sub-field in the data row"
                    />
                    <Snippet
                      code="{{/items}}"
                      label="③ close row"
                      color="var(--field-loop)"
                      description="Paste this in its own table row"
                    />
                  </div>

                  {/* Visual table diagram */}
                  <div
                    className="rounded-xl overflow-hidden mt-1"
                    style={{
                      border:
                        "1px solid color-mix(in srgb, var(--field-loop) 25%, transparent)",
                    }}
                  >
                    <div
                      className="px-3 py-1.5 flex items-center gap-2"
                      style={{
                        background:
                          "color-mix(in srgb, var(--field-loop) 8%, transparent)",
                        borderBottom:
                          "1px solid color-mix(in srgb, var(--field-loop) 18%, transparent)",
                      }}
                    >
                      <TableIcon
                        className="w-3 h-3"
                        style={{ color: "var(--field-loop)" }}
                      />
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: "var(--field-loop)" }}
                      >
                        How your table should look
                      </span>
                    </div>
                    {[
                      {
                        label: "Header row",
                        content: "Product Name  ·  Qty  ·  Price",
                        bg: "var(--bg-muted)",
                        textColor: "var(--text-muted)",
                        note: "Normal header text",
                      },
                      {
                        label: "Open row",
                        content: "{{#items}}",
                        bg: "color-mix(in srgb, var(--field-loop) 8%, transparent)",
                        textColor: "var(--field-loop)",
                        note: "Alone in this row",
                      },
                      {
                        label: "Data row",
                        content:
                          "{{product_name}}  ·  {{qty}}  ·  {{unit_price}}",
                        bg: "var(--bg-muted)",
                        textColor: "var(--accent-pale)",
                        note: "Your sub-fields",
                      },
                      {
                        label: "Close row",
                        content: "{{/items}}",
                        bg: "color-mix(in srgb, var(--field-loop) 8%, transparent)",
                        textColor: "var(--field-loop)",
                        note: "Alone in this row",
                      },
                    ].map(({ label, content, bg, textColor, note }) => (
                      <div
                        key={label}
                        className="flex items-start gap-2 sm:gap-3 px-3 py-2"
                        style={{
                          background: bg,
                          borderBottom: "1px solid var(--border-subtle)",
                        }}
                      >
                        <span
                          className="text-[10px] w-16 sm:w-20 shrink-0 mt-0.5"
                          style={{ color: "var(--text-dim)" }}
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
                          style={{ color: "var(--text-dim)" }}
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
                      style={{ color: "var(--field-condition)" }}
                    >
                      What it is
                    </p>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
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
                        color: "var(--field-condition)",
                        title: "Show when TRUE",
                        desc: 'Renders the block when the value is "true", "yes", or non-empty.',
                      },
                      {
                        operator: "^",
                        syntax: "{{^field_name}}",
                        color: "var(--field-condition-inverse)",
                        title: "Show when FALSE",
                        desc: 'Renders the block when the value is false, empty, or "no". Great for fallback messages.',
                      },
                    ].map(({ operator, syntax, color, title, desc }) => (
                      <div
                        key={operator}
                        className="rounded-xl p-3 space-y-1.5"
                        style={{
                          background: `color-mix(in srgb, ${color} 7%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
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
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {title}
                        </p>
                        <p
                          className="text-[11px] leading-relaxed"
                          style={{ color: "var(--text-dim)" }}
                        >
                          {desc}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: "var(--bg-muted)",
                      border: `1px solid var(--border-subtle)`,
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      When filling the form
                    </p>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: "var(--text-dim)" }}
                    >
                      Set the field to{" "}
                      <code
                        className="font-mono"
                        style={{ color: "var(--success)" }}
                      >
                        true
                      </code>{" "}
                      to show the block, or{" "}
                      <code
                        className="font-mono"
                        style={{ color: "var(--danger)" }}
                      >
                        false
                      </code>{" "}
                      to hide it.
                    </p>
                  </div>
                </div>
                <div className="md:col-span-3 space-y-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Examples
                  </p>

                  {/* Truthy example */}
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      border:
                        "1px solid color-mix(in srgb, var(--field-condition) 25%, transparent)",
                    }}
                  >
                    <div
                      className="px-3 py-1.5"
                      style={{
                        background:
                          "color-mix(in srgb, var(--field-condition) 7%, transparent)",
                        borderBottom:
                          "1px solid color-mix(in srgb, var(--field-condition) 18%, transparent)",
                      }}
                    >
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: "var(--field-condition)" }}
                      >
                        Show a discount block (truthy)
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <Snippet
                        code="{{#show_discount}}"
                        color="var(--field-condition)"
                        description="Opens the block — use at the start"
                      />
                      <Snippet
                        code="Discount: {{discount_amount}}"
                        color="var(--accent-pale)"
                        description="Content shown when true"
                      />
                      <Snippet
                        code="{{/show_discount}}"
                        color="var(--field-condition)"
                        description="Closes the block — must match opening name"
                      />
                    </div>
                  </div>

                  {/* Falsy example */}
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      border:
                        "1px solid color-mix(in srgb, var(--field-condition-inverse) 25%, transparent)",
                    }}
                  >
                    <div
                      className="px-3 py-1.5"
                      style={{
                        background:
                          "color-mix(in srgb, var(--field-condition-inverse) 7%, transparent)",
                        borderBottom:
                          "1px solid color-mix(in srgb, var(--field-condition-inverse) 18%, transparent)",
                      }}
                    >
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: "var(--field-condition-inverse)" }}
                      >
                        Show fallback when list is empty (falsy)
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <Snippet
                        code="{{^items}}"
                        color="var(--field-condition-inverse)"
                        description="Shows block when items is empty / false"
                      />
                      <Snippet
                        code="No items in this order."
                        color="var(--accent-pale)"
                        description="Fallback text"
                      />
                      <Snippet
                        code="{{/items}}"
                        color="var(--field-condition-inverse)"
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
                          ? "var(--danger-bg)"
                          : type === "warn"
                            ? "var(--warning-bg)"
                            : "var(--success-bg)",
                      border: `1px solid ${
                        type === "error"
                          ? "color-mix(in srgb, var(--danger) 20%, transparent)"
                          : type === "warn"
                            ? "color-mix(in srgb, var(--warning) 20%, transparent)"
                            : "color-mix(in srgb, var(--success) 20%, transparent)"
                      }`,
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold"
                      style={{
                        color:
                          type === "error"
                            ? "var(--danger)"
                            : type === "warn"
                              ? "var(--warning)"
                              : "var(--success)",
                      }}
                    >
                      {title}
                    </p>
                    <div className="flex items-start gap-2">
                      <span
                        className="text-[11px] font-bold shrink-0"
                        style={{ color: "var(--danger)" }}
                      >
                        ✗
                      </span>
                      <code
                        className="text-[10px] font-mono break-all"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {bad}
                      </code>
                    </div>
                    <div className="flex items-start gap-2">
                      <span
                        className="text-[11px] font-bold shrink-0"
                        style={{ color: "var(--success)" }}
                      >
                        ✓
                      </span>
                      <span
                        className="text-[11px] leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
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
      <div className="flex flex-col h-dvh" style={{ background: "var(--bg)" }}>
        <div className="h-12 sm:hidden shrink-0" />
        <div
          className="flex items-center gap-3 px-4 h-11 shrink-0 animate-pulse"
          style={{
            borderBottom: `1px solid var(--border-subtle)`,
            background: "var(--bg-sidebar)",
          }}
        >
          <div
            className="w-20 h-3 rounded"
            style={{ background: "var(--bg-input)" }}
          />
          <div
            className="w-px h-4"
            style={{ background: "var(--border-subtle)" }}
          />
          <div
            className="w-40 h-3 rounded"
            style={{ background: "var(--bg-input)" }}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent-light)" }}
            />
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
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
        style={{ background: "var(--bg)" }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "var(--bg-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          <AlertCircleIcon
            className="w-6 h-6"
            style={{ color: "var(--text-dim)" }}
          />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <p
            className="text-[14px] font-semibold"
            style={{ color: "var(--text)" }}
          >
            Template not found
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            This template may have been deleted or you don't have access to it.
          </p>
        </div>
        <button
          onClick={() => router.push("/templates")}
          className="text-[12px] font-medium px-4 py-2 rounded-xl"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-secondary)",
            border: `1px solid var(--border-subtle)`,
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
      style={{ background: "var(--bg)" }}
    >
      {/* Mobile-only spacer */}
      <div className="h-12 sm:hidden shrink-0" />

      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-3 sm:px-4 h-11 shrink-0"
        style={{
          borderBottom: `1px solid var(--border-subtle)`,
          background: "var(--bg-sidebar)",
        }}
      >
        {/* Back */}
        <Link
          href="/templates"
          className="flex items-center gap-1 text-[12px] font-medium transition-colors shrink-0"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--accent-light)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Templates</span>
        </Link>

        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>/</span>

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
              background: "var(--accent-soft)",
              color: "var(--accent-light)",
              border: "1px solid var(--accent-border)",
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
                background: "var(--success)",
                boxShadow: `0 0 5px var(--success)`,
              }}
            />
            <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
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
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              border: `1px solid var(--border-subtle)`,
            }}
            title="Save (Ctrl+S)"
          >
            {saving ? (
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--text-muted)" }}
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
              background: "var(--accent-strong-bg)",
              color: "var(--accent-pale)",
              border: "1px solid var(--accent-border)",
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.background = "var(--accent-highlight-bg)";
                e.currentTarget.style.boxShadow = "var(--shadow-logo-glow)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent-strong-bg)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {saving ? (
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--accent-light)" }}
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
              background: "var(--success-bg)",
              color: "var(--success)",
              border:
                "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
            }}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Connect Form
          </Link>
        </div>
      </div>

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
                background: "var(--danger-bg)",
                border: `1px solid color-mix(in srgb, var(--danger) 22%, transparent)`,
              }}
            >
              <AlertCircleIcon
                className="w-6 h-6"
                style={{ color: "var(--danger)" }}
              />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <p
                className="text-[14px] font-semibold"
                style={{ color: "var(--text)" }}
              >
                Editor couldn&apos;t load
              </p>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
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
                  background: "var(--bg-muted)",
                  border: `1px solid var(--border-subtle)`,
                }}
              >
                <InfoIcon
                  className="w-3.5 h-3.5 mt-0.5 shrink-0"
                  style={{ color: "var(--text-dim)" }}
                />
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--text-dim)" }}
                >
                  You can still use the template by clicking{" "}
                  <strong style={{ color: "var(--text-secondary)" }}>
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
                background: "var(--bg-input)",
                color: "var(--text-secondary)",
                border: `1px solid var(--border-subtle)`,
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
                style={{ background: "var(--bg)" }}
              >
                <div
                  className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--accent-light)" }}
                />
                <p
                  className="text-[12px]"
                  style={{ color: "var(--text-muted)" }}
                >
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
