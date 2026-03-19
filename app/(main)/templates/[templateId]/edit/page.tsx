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
  InfoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnlyOfficeEditor } from "@/components/OnlyOfficeEditor";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { detectPlaceholders } from "@/lib/placeholder-detector";

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
    // Strip XML tags, preserve text content
    const text = xml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    parts.push(text);
  }

  return parts.join("\n");
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
        copied
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
          : "border-border bg-background hover:bg-muted text-foreground"
      } ${className ?? ""}`}
      title="Copy"
    >
      {text}
      {copied ? (
        <CheckIcon className="w-2.5 h-2.5 shrink-0" />
      ) : (
        <CopyIcon className="w-2.5 h-2.5 shrink-0 opacity-50" />
      )}
    </button>
  );
}

// ── Syntax Guide Bar ──────────────────────────────────────────────────────────

const GUIDE_SECTIONS = [
  {
    id: "simple",
    label: "Simple field",
    color: "text-blue-600",
    dotColor: "bg-blue-500",
    description: "Replaced with a single value when generating.",
    rules: [
      "Use only letters, numbers, and underscores in the name.",
      "Name must start with a letter.",
      "Case sensitive — {{Name}} ≠ {{name}}.",
    ],
    examples: [
      { syntax: "{{customer_name}}", note: "text field" },
      { syntax: "{{invoice_date}}", note: "date field (auto-detected)" },
      { syntax: "{{total_amount}}", note: "number field (auto-detected)" },
      { syntax: "{{email}}", note: "email field (auto-detected)" },
    ],
  },
  {
    id: "loop",
    label: "Repeating rows",
    color: "text-indigo-600",
    dotColor: "bg-indigo-500",
    description:
      "Repeats a table row or paragraph for each item in an array. The data must be an array of objects.",
    rules: [
      "Opening tag {{#name}} and closing tag {{/name}} must be in separate table rows (with paragraphLoop: true).",
      "Sub-fields inside the loop reference properties of each array item.",
      "The array name should be plural: items, rows, products, employees.",
      "Do NOT put the open/close tags in the same paragraph.",
    ],
    examples: [
      {
        syntax: "{{#items}}",
        note: "open — put in its own table row",
      },
      { syntax: "{{product_name}}", note: "sub-field inside loop" },
      { syntax: "{{qty}}", note: "another sub-field" },
      { syntax: "{{unit_price}}", note: "another sub-field" },
      { syntax: "{{/items}}", note: "close — put in its own table row" },
    ],
    tip: "In your Word table: Row 1 = headers | Row 2 = {{#items}} | Row 3 = sub-fields | Row 4 = {{/items}}",
  },
  {
    id: "condition",
    label: "Show / Hide (condition)",
    color: "text-pink-600",
    dotColor: "bg-pink-500",
    description:
      "Shows a block only when the value is truthy (non-empty, non-zero, true).",
    rules: [
      "{{#name}} shows the block when value is true / non-empty.",
      "{{^name}} shows the block when value is false / empty (inverse).",
      "The block can contain any content including other placeholders.",
      "Opening and closing tags should be on their own paragraphs.",
    ],
    examples: [
      { syntax: "{{#show_discount}}", note: "shows block when true" },
      { syntax: "Discount: {{discount_amount}}", note: "content inside" },
      { syntax: "{{/show_discount}}", note: "end of block" },
      { syntax: "{{^items}}", note: "shows when items array is EMPTY" },
      { syntax: "No items found.", note: "content for empty state" },
      { syntax: "{{/items}}", note: "end of inverse block" },
    ],
  },
  {
    id: "rules",
    label: "Important rules",
    color: "text-amber-600",
    dotColor: "bg-amber-500",
    description: "Docxtemplater requirements you must follow.",
    rules: [
      "Every opening {{#tag}} MUST have a matching closing {{/tag}}.",
      "Tags cannot span across table cells — open and close in the same cell, OR use paragraphLoop for rows.",
      "Whitespace inside tags is ignored: {{ name }} = {{name}}.",
      "Nested loops are supported: {{#outer}}{{#inner}}…{{/inner}}{{/outer}}.",
      "If ONLYOFFICE splits your tag across runs, click Save — the preprocessor will fix it automatically.",
      "Do not use special characters < > & inside tag names.",
    ],
    examples: [],
  },
];

function SyntaxGuideBar() {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("simple");

  const section = GUIDE_SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="border-b border-border bg-background shrink-0">
      {/* Toggle row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/40 transition-colors"
      >
        <InfoIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span className="text-xs font-medium text-foreground">
          Placeholder syntax guide
        </span>
        <div className="flex items-center gap-1.5 ml-1">
          {GUIDE_SECTIONS.slice(0, 3).map((s) => (
            <span
              key={s.id}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground`}
            >
              {s.id === "simple"
                ? "{{field}}"
                : s.id === "loop"
                  ? "{{#loop}}"
                  : "{{#if}}"}
            </span>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
          {open ? "Hide" : "Show guide"}
          {open ? (
            <ChevronUpIcon className="w-3 h-3" />
          ) : (
            <ChevronDownIcon className="w-3 h-3" />
          )}
        </span>
      </button>

      {/* Expanded guide */}
      {open && (
        <div className="border-t border-border">
          {/* Section tabs */}
          <div className="flex items-center gap-0 border-b border-border px-4 overflow-x-auto">
            {GUIDE_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeSection === s.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${s.dotColor} shrink-0`}
                />
                {s.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Description + Rules */}
            <div className="space-y-2 md:col-span-1">
              <p className={`text-xs font-semibold ${section.color}`}>
                What it does
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {section.description}
              </p>

              {section.rules.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Rules
                  </p>
                  <ul className="space-y-1">
                    {section.rules.map((rule, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                      >
                        <span
                          className={`mt-1 w-1.5 h-1.5 rounded-full ${section.dotColor} shrink-0 opacity-60`}
                        />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {section.tip && (
                <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 p-2.5">
                  <p className="text-[11px] text-amber-700">💡 {section.tip}</p>
                </div>
              )}
            </div>

            {/* Examples */}
            {section.examples.length > 0 && (
              <div className="md:col-span-2 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Examples — click to copy
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {section.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-muted/20 group"
                    >
                      <CopyBtn text={ex.syntax} />
                      <span className="text-[10px] text-muted-foreground flex-1 text-right">
                        {ex.note}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Full template example for loop */}
                {section.id === "loop" && (
                  <div className="mt-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-1">
                    <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                      Table structure in Word
                    </p>
                    {[
                      ["Header row", "Product | Qty | Price", "bg-muted/50"],
                      ["Loop open row", "{{#items}}", "bg-indigo-500/10"],
                      [
                        "Data row",
                        "{{product_name}} | {{qty}} | {{unit_price}}",
                        "bg-background",
                      ],
                      ["Loop close row", "{{/items}}", "bg-indigo-500/10"],
                    ].map(([label, content, bg]) => (
                      <div
                        key={label}
                        className={`flex items-center gap-3 px-2 py-1.5 rounded ${bg}`}
                      >
                        <span className="text-[10px] text-muted-foreground w-28 shrink-0">
                          {label}
                        </span>
                        <code className="text-[10px] font-mono text-foreground flex-1">
                          {content}
                        </code>
                        {content.includes("{{") && <CopyBtn text={content} />}
                      </div>
                    ))}
                  </div>
                )}

                {/* Condition visual for condition section */}
                {section.id === "condition" && (
                  <div className="mt-2 rounded-lg border border-pink-500/20 bg-pink-500/5 p-3 space-y-1">
                    <p className="text-[10px] font-semibold text-pink-600 uppercase tracking-wide mb-2">
                      In your document
                    </p>
                    {[
                      ["Truthy open", "{{#show_discount}}", "bg-pink-500/10"],
                      [
                        "Content",
                        "Discount: {{discount_amount}}",
                        "bg-background",
                      ],
                      ["Close", "{{/show_discount}}", "bg-pink-500/10"],
                      ["", "", ""],
                      ["Falsy open", "{{^items}}", "bg-rose-500/10"],
                      ["Content", "No items in this order.", "bg-background"],
                      ["Close", "{{/items}}", "bg-rose-500/10"],
                    ].map(([label, content, bg], i) =>
                      label === "" ? (
                        <div key={i} className="h-1" />
                      ) : (
                        <div
                          key={i}
                          className={`flex items-center gap-3 px-2 py-1.5 rounded ${bg}`}
                        >
                          <span className="text-[10px] text-muted-foreground w-20 shrink-0">
                            {label}
                          </span>
                          <code className="text-[10px] font-mono text-foreground flex-1">
                            {content}
                          </code>
                          {content.includes("{{") && <CopyBtn text={content} />}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Rules-only section (no examples grid) */}
            {section.id === "rules" && (
              <div className="md:col-span-2 space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Common mistakes & how to fix them
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      bad: "{{#items}}...{{/items}} in same cell",
                      good: "Put open/close in separate rows with paragraphLoop",
                      color: "border-destructive/20 bg-destructive/5",
                    },
                    {
                      bad: "{{customer name}} — space in name",
                      good: "{{customer_name}} — use underscore",
                      color: "border-destructive/20 bg-destructive/5",
                    },
                    {
                      bad: "{{#block}} with no {{/block}}",
                      good: "Always close every opening tag",
                      color: "border-destructive/20 bg-destructive/5",
                    },
                    {
                      bad: "Tag split by Word formatting",
                      good: "Click Save — preprocessor fixes split tags",
                      color: "border-amber-500/20 bg-amber-500/5",
                    },
                  ].map(({ bad, good, color }) => (
                    <div
                      key={bad}
                      className={`rounded-lg border p-3 space-y-1.5 ${color}`}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="text-[10px] font-semibold text-destructive shrink-0 mt-0.5">
                          ✗
                        </span>
                        <code className="text-[10px] font-mono text-muted-foreground">
                          {bad}
                        </code>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-[10px] font-semibold text-emerald-600 shrink-0 mt-0.5">
                          ✓
                        </span>
                        <span className="text-[11px] text-foreground">
                          {good}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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

  const template = useQuery(api.templates.getById, { id: templateId });
  const updateTemplate = useMutation(api.templates.update);

  const [editorError, setEditorError] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);

  if (template === undefined) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border animate-pulse shrink-0">
          <div className="w-20 h-3.5 bg-muted rounded" />
          <div className="w-px h-4 bg-muted" />
          <div className="w-40 h-3.5 bg-muted rounded" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (template === null) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircleIcon className="w-8 h-8 text-destructive" />
        <p className="text-sm font-semibold">Template not found</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/templates")}
        >
          Back to Templates
        </Button>
      </div>
    );
  }

  const scanAndSave = async (redirectTo?: "fill") => {
    setSaving(true);
    try {
      // Fetch current file from ONLYOFFICE proxy → mammoth scan
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

      if (redirectTo === "fill") {
        router.push(`/templates/${templateId}/fill`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border shrink-0 bg-background">
        <Link
          href="/templates"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Templates
        </Link>
        <span className="text-muted-foreground/40 text-xs shrink-0">/</span>
        <span className="text-sm font-semibold truncate max-w-[220px]">
          {template.name}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => scanAndSave()}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <CheckIcon className="w-3.5 h-3.5" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            onClick={() => scanAndSave("fill")}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <FileTextIcon className="w-3.5 h-3.5" />
                Save & Use →
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Syntax guide bar — above editor */}
      <SyntaxGuideBar />

      {/* ONLYOFFICE — full remaining height, full width */}
      <div className="flex-1 flex overflow-hidden">
        {editorError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center bg-muted/10">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertCircleIcon className="w-6 h-6 text-destructive" />
            </div>
            <div className="space-y-1 max-w-xs">
              <p className="text-sm font-semibold">Editor couldn&apos;t load</p>
              <p className="text-xs text-muted-foreground">
                Make sure ONLYOFFICE is running at{" "}
                <code className="font-mono bg-muted px-1 rounded text-[11px]">
                  localhost:80
                </code>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditorError(false);
                  setEditorKey((k) => k + 1);
                }}
                className="gap-1.5"
              >
                <RefreshCwIcon className="w-3.5 h-3.5" />
                Retry
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a
                  href="http://localhost/healthcheck"
                  target="_blank"
                  rel="noopener"
                >
                  Check server
                </a>
              </Button>
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
