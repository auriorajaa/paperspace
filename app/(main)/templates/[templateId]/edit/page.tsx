"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnlyOfficeEditor } from "@/components/OnlyOfficeEditor";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { detectPlaceholders } from "@/lib/placeholder-detector";
import { colors } from "@/lib/design-tokens";
import { useAuth } from "@clerk/nextjs";

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

// ── Copy snippet button ────────────────────────────────────────────────────────

function Snippet({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="group flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left w-full"
      style={{
        background: copied ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${copied ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <code
        className="flex-1 text-[11px] font-mono"
        style={{ color: copied ? "#34d399" : "#a5b4fc" }}
      >
        {code}
      </code>
      <span className="shrink-0 transition-all">
        {copied ? (
          <CheckIcon className="w-3 h-3" style={{ color: "#34d399" }} />
        ) : (
          <CopyIcon
            className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity"
            style={{ color: colors.textMuted }}
          />
        )}
      </span>
      {label && (
        <span
          className="text-[10px] shrink-0"
          style={{ color: colors.textDim }}
        >
          {label}
        </span>
      )}
    </button>
  );
}

// ── Syntax Guide ──────────────────────────────────────────────────────────────

function SyntaxGuideBar() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "simple" | "loop" | "condition" | "rules"
  >("simple");

  return (
    <div
      className="shrink-0"
      style={{
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
        background: "#0e0e12",
      }}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-2.5 transition-colors"
        style={{ color: colors.textMuted }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <BookOpenIcon
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: "#818cf8" }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: colors.textSecondary }}
        >
          Placeholder syntax reference
        </span>
        <div className="flex items-center gap-1.5 ml-1">
          {[
            { code: "{{field}}", color: "#60a5fa" },
            { code: "{{#loop}}", color: "#818cf8" },
            { code: "{{#if}}", color: "#f472b6" },
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
          className="ml-auto flex items-center gap-1.5 text-[11px]"
          style={{ color: colors.textDim }}
        >
          {open ? "Hide" : "Show reference"}
          {open ? (
            <ChevronUpIcon className="w-3 h-3" />
          ) : (
            <ChevronDownIcon className="w-3 h-3" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Tabs */}
          <div
            className="flex border-b px-5"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            {[
              {
                id: "simple" as const,
                label: "Text fields",
                color: "#60a5fa",
                dot: "bg-blue-400",
              },
              {
                id: "loop" as const,
                label: "Repeating rows",
                color: "#818cf8",
                dot: "bg-indigo-400",
              },
              {
                id: "condition" as const,
                label: "Show / Hide",
                color: "#f472b6",
                dot: "bg-pink-400",
              },
              {
                id: "rules" as const,
                label: "Rules & mistakes",
                color: "#fbbf24",
                dot: "bg-amber-400",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap"
                style={{
                  borderColor: activeTab === tab.id ? tab.color : "transparent",
                  color: activeTab === tab.id ? tab.color : colors.textDim,
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-5 gap-5">
            {activeTab === "simple" && (
              <>
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <p
                      className="text-xs font-semibold mb-1"
                      style={{ color: "#60a5fa" }}
                    >
                      What it does
                    </p>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: colors.textMuted }}
                    >
                      Replaced with the value you enter when generating the
                      document. Works for text, numbers, dates, and email
                      addresses.
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
                        "Use letters, numbers, and underscores only.",
                        "Must start with a letter — not a number.",
                        "Case-sensitive: {{Name}} ≠ {{name}}.",
                        "No spaces — use {{customer_name}} not {{customer name}}.",
                      ].map((r) => (
                        <li
                          key={r}
                          className="flex items-start gap-1.5 text-[11px]"
                          style={{ color: colors.textMuted }}
                        >
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 opacity-60" />
                          {r}
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
                    {[
                      ["{{customer_name}}", "text"],
                      ["{{invoice_date}}", "date → auto-detected"],
                      ["{{total_amount}}", "number → auto-detected"],
                      ["{{email}}", "email → auto-detected"],
                    ].map(([code, label]) => (
                      <Snippet key={code} code={code} label={label} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "loop" && (
              <>
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <p
                      className="text-xs font-semibold mb-1"
                      style={{ color: "#818cf8" }}
                    >
                      What it does
                    </p>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: colors.textMuted }}
                    >
                      Repeats a table row for each item in a list. When filling
                      the form, you add rows one by one. When generating from
                      Excel, each column maps to a sub-field.
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
                        "Opening {{#name}} and closing {{/name}} must each be in their OWN table row.",
                        "Sub-fields go in the data row between open and close.",
                        "Use plural names: items, rows, products, employees.",
                        "Never put open and close in the same cell.",
                      ].map((r) => (
                        <li
                          key={r}
                          className="flex items-start gap-1.5 text-[11px]"
                          style={{ color: colors.textMuted }}
                        >
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 opacity-60" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div
                    className="rounded-xl p-3 space-y-0.5"
                    style={{
                      background: "rgba(251,191,36,0.06)",
                      border: "1px solid rgba(251,191,36,0.15)",
                    }}
                  >
                    <p
                      className="text-[10px] font-semibold mb-1"
                      style={{ color: "#fbbf24" }}
                    >
                      💡 Table structure
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: colors.textMuted }}
                    >
                      Row 1 → column headers
                      <br />
                      Row 2 → {"{{"}
                      <span style={{ color: "#818cf8" }}>#items</span>
                      {"}}"}
                      <br />
                      Row 3 → {"{{"}
                      <span style={{ color: "#818cf8" }}>product</span>
                      {"}} {{"}
                      <span style={{ color: "#818cf8" }}>qty</span>
                      {"}}"}
                      <br />
                      Row 4 → {"{{"}
                      <span style={{ color: "#818cf8" }}>/items</span>
                      {"}}"}
                    </p>
                  </div>
                </div>
                <div className="md:col-span-3 space-y-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: colors.textDim }}
                  >
                    Copy in order
                  </p>
                  <Snippet code="{{#items}}" label="① open — own row" />
                  <Snippet code="{{product_name}}" label="② sub-field" />
                  <Snippet code="{{qty}}" label="② sub-field" />
                  <Snippet code="{{unit_price}}" label="② sub-field" />
                  <Snippet code="{{/items}}" label="③ close — own row" />
                  <div
                    className="rounded-xl overflow-hidden mt-2"
                    style={{ border: "1px solid rgba(99,102,241,0.2)" }}
                  >
                    {[
                      {
                        label: "Headers",
                        content: "Product Name  |  Qty  |  Price",
                        bg: "rgba(255,255,255,0.04)",
                      },
                      {
                        label: "Loop open",
                        content: "{{#items}}",
                        bg: "rgba(99,102,241,0.1)",
                      },
                      {
                        label: "Data row",
                        content:
                          "{{product_name}}  |  {{qty}}  |  {{unit_price}}",
                        bg: "rgba(255,255,255,0.02)",
                      },
                      {
                        label: "Loop close",
                        content: "{{/items}}",
                        bg: "rgba(99,102,241,0.1)",
                      },
                    ].map(({ label, content, bg }) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 px-3 py-2"
                        style={{
                          background: bg,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <span
                          className="text-[10px] w-20 shrink-0"
                          style={{ color: colors.textDim }}
                        >
                          {label}
                        </span>
                        <code
                          className="text-[10px] font-mono flex-1"
                          style={{
                            color: content.includes("{{")
                              ? "#a5b4fc"
                              : colors.textMuted,
                          }}
                        >
                          {content}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "condition" && (
              <>
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <p
                      className="text-xs font-semibold mb-1"
                      style={{ color: "#f472b6" }}
                    >
                      What it does
                    </p>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: colors.textMuted }}
                    >
                      Shows or hides a block of content based on a true/false
                      value. Two variants: truthy (show when true) and falsy
                      (show when false or empty).
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                      style={{ color: colors.textDim }}
                    >
                      Variants
                    </p>
                    <div className="space-y-2">
                      {[
                        {
                          syntax: "{{#name}}",
                          desc: "Show block when value is true / non-empty",
                          color: "#f472b6",
                        },
                        {
                          syntax: "{{^name}}",
                          desc: "Show block when value is FALSE or empty (inverse)",
                          color: "#fb7185",
                        },
                      ].map(({ syntax, desc, color }) => (
                        <div
                          key={syntax}
                          className="rounded-lg p-2.5 space-y-1"
                          style={{
                            background: `${color}08`,
                            border: `1px solid ${color}20`,
                          }}
                        >
                          <code
                            className="text-[11px] font-mono"
                            style={{ color }}
                          >
                            {syntax}
                          </code>
                          <p
                            className="text-[11px]"
                            style={{ color: colors.textMuted }}
                          >
                            {desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="md:col-span-3 space-y-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: colors.textDim }}
                  >
                    Examples
                  </p>
                  <Snippet code="{{#show_discount}}" label="open (truthy)" />
                  <Snippet
                    code="Discount: {{discount_amount}}"
                    label="content inside"
                  />
                  <Snippet code="{{/show_discount}}" label="close" />
                  <div
                    className="h-px my-1"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  />
                  <Snippet
                    code="{{^items}}"
                    label="open (falsy — empty list)"
                  />
                  <Snippet
                    code="No items in this order."
                    label="content inside"
                  />
                  <Snippet code="{{/items}}" label="close" />
                </div>
              </>
            )}

            {activeTab === "rules" && (
              <div className="md:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    bad: "{{#items}} and {{/items}} in the same table cell",
                    good: "Each must be in its own separate table row",
                    type: "error",
                  },
                  {
                    bad: "{{customer name}} — space in field name",
                    good: "{{customer_name}} — use underscore",
                    type: "error",
                  },
                  {
                    bad: "{{#block}} with no {{/block}} closing tag",
                    good: "Every opening tag must have a matching close",
                    type: "error",
                  },
                  {
                    bad: "ONLYOFFICE splits {{field}} across text runs",
                    good: "Click Save — the preprocessor fixes this automatically",
                    type: "warn",
                  },
                  {
                    bad: "{{Item}} and {{item}} used for same field",
                    good: "Pick one casing and stick to it throughout",
                    type: "warn",
                  },
                  {
                    bad: "{{2name}} — starts with a number",
                    good: "{{item_2}} or {{product_name}} — start with letter",
                    type: "error",
                  },
                ].map(({ bad, good, type }) => (
                  <div
                    key={bad}
                    className="rounded-xl p-3 space-y-2"
                    style={{
                      background:
                        type === "error"
                          ? "rgba(248,113,113,0.05)"
                          : "rgba(251,191,36,0.05)",
                      border: `1px solid ${type === "error" ? "rgba(248,113,113,0.15)" : "rgba(251,191,36,0.15)"}`,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="text-[11px] font-bold shrink-0"
                        style={{
                          color: type === "error" ? "#f87171" : "#fbbf24",
                        }}
                      >
                        ✗
                      </span>
                      <code
                        className="text-[10px] font-mono"
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
                        className="text-[11px]"
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

  const template = useQuery(
    api.templates.getById,
    isLoaded && isSignedIn ? { id: templateId } : "skip" // ← guard
  );
  const updateTemplate = useMutation(api.templates.update);

  const [editorError, setEditorError] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);

  if (template === undefined) {
    return (
      <div className="flex flex-col h-screen" style={{ background: colors.bg }}>
        <div
          className="flex items-center gap-3 px-4 h-11 shrink-0 animate-pulse"
          style={{
            borderBottom: `1px solid ${colors.borderSubtle}`,
            background: "#0e0e12",
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
          <div
            className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: colors.accentLight }}
          />
        </div>
      </div>
    );
  }

  if (template === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-4"
        style={{ background: colors.bg }}
      >
        <AlertCircleIcon className="w-8 h-8" style={{ color: colors.danger }} />
        <p className="text-sm font-semibold" style={{ color: colors.text }}>
          Template not found
        </p>
        <button
          onClick={() => router.push("/templates")}
          className="text-xs font-medium px-4 py-2 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
          }}
        >
          Back to Templates
        </button>
      </div>
    );
  }

  const scanAndSave = async (redirectTo?: "fill") => {
    setSaving(true);
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

      const count = detected.length;
      toast.success(
        count > 0
          ? `Saved — ${count} field${count !== 1 ? "s" : ""} detected`
          : "Saved — no placeholders detected yet"
      );
      if (redirectTo === "fill") router.push(`/templates/${templateId}/fill`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

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
          background: "#0e0e12",
        }}
      >
        <Link
          href="/templates"
          className="flex items-center gap-1 text-xs transition-colors shrink-0"
          style={{ color: colors.textMuted }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = colors.accentLight)
          }
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Templates
        </Link>
        <span style={{ color: colors.textDim, fontSize: 11 }}>/</span>
        <span
          className="text-sm font-medium truncate max-w-[220px]"
          style={{ color: colors.text }}
        >
          {template.name}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => scanAndSave()}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
            }}
          >
            {saving ? (
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.textMuted }}
              />
            ) : (
              <CheckIcon className="w-3.5 h-3.5" />
            )}
            Save
          </button>
          <button
            onClick={() => scanAndSave("fill")}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
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
            Save & Use →
          </button>

          <Link
            href={`/templates/${templateId}/connect`}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
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

      {/* Syntax guide */}
      <SyntaxGuideBar />

      {/* Editor */}
      <div className="flex-1 flex overflow-hidden">
        {editorError ? (
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
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Trying to connect to{" "}
                <code
                  className="font-mono px-1 rounded text-[11px]"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: colors.accentLight,
                  }}
                >
                  server
                </code>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditorError(false);
                  setEditorKey((k) => k + 1);
                }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <RefreshCwIcon className="w-3.5 h-3.5" />
                Retry
              </button>
              {/* <a
                href="https://onlyoffice.safenetindo.site/healthcheck"
                target="_blank"
                rel="noopener"
                className="text-xs font-medium px-3 py-2 rounded-xl"
                style={{ color: colors.textMuted }}
              >
                Check server
              </a> */}
            </div>
          </div>
        ) : (
          <OnlyOfficeEditor
            key={editorKey}
            fileUrl={template.fileUrl}
            fileName={template.name}
            fileKey={`tmpl-${templateId}-${template.storageId?.slice(-8) ?? template._creationTime}`}
            templateId={templateId}
            storageId={template.storageId}
            onError={() => setEditorError(true)}
          />
        )}
      </div>
    </div>
  );
}
