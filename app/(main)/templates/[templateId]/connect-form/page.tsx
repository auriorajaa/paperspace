"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState } from "react";
import {
  ChevronLeftIcon,
  PlusIcon,
  Trash2Icon,
  CopyIcon,
  CheckIcon,
  LinkIcon,
  PlayIcon,
  PauseIcon,
  AlertCircleIcon,
  ZapIcon,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { colors, fieldTypeColors } from "@/lib/design-tokens";
import { formatDistanceToNow } from "date-fns";

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
      style={{
        background: copied ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.06)",
        color: copied ? "#34d399" : colors.textMuted,
        border: `1px solid ${copied ? "rgba(52,211,153,0.2)" : colors.border}`,
      }}
    >
      {copied ? (
        <CheckIcon className="w-3 h-3" />
      ) : (
        <CopyIcon className="w-3 h-3" />
      )}
      {label ?? "Copy"}
    </button>
  );
}

// ── Setup Wizard ──────────────────────────────────────────────────────────────

function SetupWizard({
  templateId,
  templateFields,
  onDone,
}: {
  templateId: Id<"templates">;
  templateFields: { name: string; label: string; type: string }[];
  onDone: () => void;
}) {
  const createConnection = useMutation(api.formConnections.create);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formId, setFormId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [filenamePattern, setFilenamePattern] = useState("");
  const [saving, setSaving] = useState(false);

  const addQuestion = () => setQuestions((prev) => [...prev, ""]);
  const updateQuestion = (i: number, val: string) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[i] = val;
      return n;
    });
  const removeQuestion = (i: number) =>
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    const validMappings = Object.entries(mappings)
      .filter(([q, f]) => q.trim() && f)
      .map(([formQuestionTitle, templateFieldName]) => ({
        formQuestionTitle,
        templateFieldName,
      }));

    if (validMappings.length === 0) {
      toast.error("Map at least one field.");
      return;
    }
    setSaving(true);
    try {
      await createConnection({
        templateId,
        formId: formId.trim() || "manual",
        formTitle: formTitle.trim() || "My Google Form",
        spreadsheetId: spreadsheetId.trim() || undefined,
        fieldMappings: validMappings,
        filenamePattern: filenamePattern.trim() || `document_{{row_number}}`,
      });
      toast.success("Connection created");
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't create. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Form info" },
          { n: 2, label: "Map fields" },
          { n: 3, label: "Filename" },
        ].map(({ n, label }, idx) => (
          <div key={n} className="flex items-center gap-2">
            {idx > 0 && (
              <div className="w-8 h-px" style={{ background: colors.border }} />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{
                  background:
                    step === n
                      ? "rgba(99,102,241,0.25)"
                      : step > n
                        ? "rgba(52,211,153,0.2)"
                        : "rgba(255,255,255,0.06)",
                  color:
                    step === n
                      ? "#a5b4fc"
                      : step > n
                        ? "#34d399"
                        : colors.textDim,
                  border: `1px solid ${step === n ? "rgba(99,102,241,0.35)" : step > n ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {step > n ? "✓" : n}
              </div>
              <span
                className="text-[11px] hidden sm:block"
                style={{
                  color: step === n ? colors.textSecondary : colors.textDim,
                }}
              >
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Step 1 — Form info */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: colors.text }}
            >
              Enter your Google Form details
            </h3>
            <p
              className="text-xs leading-relaxed"
              style={{ color: colors.textMuted }}
            >
              You don&apos;t need the Form ID to get started — just give it a
              name. The Form ID helps identify it later.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: colors.textSecondary }}
              >
                Form title <span style={{ color: "#f87171" }}>*</span>
              </label>
              <input
                placeholder="e.g. Customer Intake Form"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.accentBorder}`)
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.border}`)
                }
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: colors.textSecondary }}
              >
                Google Form ID{" "}
                <span style={{ color: colors.textDim, fontWeight: 400 }}>
                  (optional)
                </span>
              </label>
              <input
                placeholder="Found in the form URL: forms/d/[THIS_PART]/edit"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.accentBorder}`)
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.border}`)
                }
              />
              <p className="text-[10px]" style={{ color: colors.textDim }}>
                URL: docs.google.com/forms/d/
                <span style={{ color: colors.accentLight }}>1FAIpQL...</span>
                /edit
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: colors.textSecondary }}
              >
                Linked Spreadsheet ID{" "}
                <span style={{ color: colors.textDim, fontWeight: 400 }}>
                  (optional, for Apps Script)
                </span>
              </label>
              <input
                placeholder="Found in spreadsheet URL after /d/"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.accentBorder}`)
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.border}`)
                }
              />
            </div>

            {/* Question list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  className="text-xs font-medium"
                  style={{ color: colors.textSecondary }}
                >
                  Form question titles{" "}
                  <span style={{ color: colors.textDim, fontWeight: 400 }}>
                    (from your Google Form)
                  </span>
                </label>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-1 text-[11px] font-medium transition-colors"
                  style={{ color: colors.accentLight }}
                >
                  <PlusIcon className="w-3 h-3" />
                  Add
                </button>
              </div>
              <p className="text-[10px]" style={{ color: colors.textDim }}>
                Type each question exactly as it appears in your Google Form.
              </p>
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={q}
                      onChange={(e) => updateQuestion(i, e.target.value)}
                      placeholder={`Question ${i + 1} title…`}
                      className="flex-1 rounded-lg px-2.5 py-2 text-sm outline-none"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${colors.border}`,
                        color: colors.text,
                      }}
                    />
                    <button
                      onClick={() => removeQuestion(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ color: colors.textDim }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#f87171";
                        e.currentTarget.style.background =
                          "rgba(248,113,113,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = colors.textDim;
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {questions.length === 0 && (
                  <button
                    onClick={addQuestion}
                    className="w-full flex items-center justify-center gap-1.5 py-6 rounded-xl border-2 border-dashed text-xs transition-all"
                    style={{
                      borderColor: "rgba(255,255,255,0.08)",
                      color: colors.textDim,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.accentBorder;
                      e.currentTarget.style.color = colors.accentLight;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.08)";
                      e.currentTarget.style.color = colors.textDim;
                    }}
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add first question
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (!formTitle.trim()) {
                toast.error("Form title is required.");
                return;
              }
              setStep(2);
            }}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(99,102,241,0.18)",
              color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.28)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(99,102,241,0.28)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(99,102,241,0.18)")
            }
          >
            Next: Map fields →
          </button>
        </div>
      )}

      {/* Step 2 — Map fields */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: colors.text }}
            >
              Map form questions to template fields
            </h3>
            <p className="text-xs" style={{ color: colors.textMuted }}>
              For each template field, choose which form question provides its
              value.
            </p>
          </div>

          <div className="space-y-3">
            {templateFields
              .filter(
                (f) =>
                  f.type !== "loop" &&
                  f.type !== "condition" &&
                  f.type !== "condition_inverse"
              )
              .map((field) => {
                const c = fieldTypeColors[field.type] ?? "#6b7280";
                return (
                  <div
                    key={field.name}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div className="w-2 shrink-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full block"
                        style={{ background: c }}
                      />
                    </div>
                    <div className="w-32 shrink-0">
                      <p
                        className="text-xs font-medium truncate"
                        style={{ color: colors.textSecondary }}
                      >
                        {field.label}
                      </p>
                      <code
                        className="text-[9px] font-mono"
                        style={{ color: colors.textDim }}
                      >{`{{${field.name}}}`}</code>
                    </div>
                    <div
                      className="w-4 shrink-0 text-center"
                      style={{ color: colors.textDim }}
                    >
                      →
                    </div>
                    <select
                      value={mappings[field.name] ?? ""}
                      onChange={(e) =>
                        setMappings((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-lg px-2.5 py-2 text-sm outline-none"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${colors.border}`,
                        color: mappings[field.name]
                          ? colors.text
                          : colors.textDim,
                      }}
                    >
                      <option value="" style={{ background: "#18181d" }}>
                        — not mapped —
                      </option>
                      {questions
                        .filter((q) => q.trim())
                        .map((q) => (
                          <option
                            key={q}
                            value={q}
                            style={{ background: "#18181d" }}
                          >
                            {q}
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })}
          </div>

          {questions.length === 0 && (
            <div
              className="rounded-xl p-4 text-center"
              style={{
                background: "rgba(251,191,36,0.06)",
                border: "1px solid rgba(251,191,36,0.15)",
              }}
            >
              <p className="text-xs" style={{ color: "#fbbf24" }}>
                No questions added in step 1. Go back to add your form questions
                first.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "rgba(99,102,241,0.18)",
                color: "#a5b4fc",
                border: "1px solid rgba(99,102,241,0.28)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(99,102,241,0.28)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(99,102,241,0.18)")
              }
            >
              Next: Filename pattern →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Filename + finish */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: colors.text }}
            >
              Set filename pattern
            </h3>
            <p className="text-xs" style={{ color: colors.textMuted }}>
              Documents will be saved with this filename. Use tokens from your
              mapped fields.
            </p>
          </div>

          <div className="space-y-3">
            <input
              value={filenamePattern}
              onChange={(e) => setFilenamePattern(e.target.value)}
              placeholder={`${formTitle || "document"}_{{row_number}}`}
              className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = `1px solid ${colors.accentBorder}`)
              }
              onBlur={(e) =>
                (e.currentTarget.style.border = `1px solid ${colors.border}`)
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                "{{row_number}}",
                ...Object.keys(mappings)
                  .slice(0, 3)
                  .map((k) => `{{${k}}}`),
              ].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setFilenamePattern((p) => (p || "") + token)}
                  className="text-[10px] font-mono px-2 py-1 rounded-lg"
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    color: "#818cf8",
                    border: "1px solid rgba(99,102,241,0.2)",
                  }}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
            >
              ← Back
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(99,102,241,0.2)",
                color: "#a5b4fc",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
              onMouseEnter={(e) => {
                if (!saving)
                  e.currentTarget.style.background = "rgba(99,102,241,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(99,102,241,0.2)";
              }}
            >
              {saving ? (
                <>
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: colors.accentLight }}
                  />
                  Saving…
                </>
              ) : (
                <>
                  <ZapIcon className="w-4 h-4" />
                  Create connection
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Connection Card ───────────────────────────────────────────────────────────

function ConnectionCard({
  connection,
  webhookBase,
}: {
  connection: any;
  webhookBase: string;
}) {
  const updateConnection = useMutation(api.formConnections.update);
  const removeConnection = useMutation(api.formConnections.remove);
  const submissions = useQuery(api.formConnections.getSubmissions, {
    connectionId: connection._id,
  });
  const [expanded, setExpanded] = useState(false);

  const webhookUrl = `${webhookBase}/api/form-webhook/${connection.scriptToken}`;

  const pendingCount = (submissions ?? []).filter(
    (s: { status: string }) => s.status === "pending"
  ).length;
  const generatedCount = (submissions ?? []).filter(
    (s: { status: string }) => s.status === "generated"
  ).length;
  const errorCount = (submissions ?? []).filter(
    (s: { status: string }) => s.status === "error"
  ).length;

  const appsScript = `// Paperspace Form Webhook
// Paste this in your Google Apps Script editor and set a trigger on "On form submit"

const WEBHOOK_URL = "${webhookUrl}";

function onFormSubmit(e) {
  const response = e.response;
  const itemResponses = response.getItemResponses();
  const answers = {};
  
  itemResponses.forEach(function(r) {
    answers[r.getItem().getTitle()] = r.getResponse();
  });
  
  const payload = {
    respondentEmail: response.getRespondentEmail ? response.getRespondentEmail() : "",
    answers: answers,
    timestamp: new Date().toISOString()
  };
  
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}`;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${connection.isActive ? colors.accentBorder : colors.border}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: connection.isActive
              ? "rgba(99,102,241,0.15)"
              : "rgba(255,255,255,0.06)",
            border: `1px solid ${connection.isActive ? colors.accentBorder : colors.border}`,
          }}
        >
          <LinkIcon
            className="w-4 h-4"
            style={{ color: connection.isActive ? "#818cf8" : colors.textDim }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: colors.text }}
            >
              {connection.formTitle}
            </p>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                background: connection.isActive
                  ? "rgba(52,211,153,0.12)"
                  : "rgba(255,255,255,0.06)",
                color: connection.isActive ? "#34d399" : colors.textDim,
              }}
            >
              {connection.isActive ? "active" : "paused"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              {connection.fieldMappings.length} field
              {connection.fieldMappings.length !== 1 ? "s" : ""} mapped
            </span>
            <span className="text-[11px]" style={{ color: "#34d399" }}>
              {generatedCount} generated
            </span>
            {errorCount > 0 && (
              <span className="text-[11px]" style={{ color: "#f87171" }}>
                {errorCount} errors
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() =>
              updateConnection({
                id: connection._id,
                isActive: !connection.isActive,
              })
            }
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              background: connection.isActive
                ? "rgba(251,191,36,0.1)"
                : "rgba(52,211,153,0.1)",
              color: connection.isActive ? "#fbbf24" : "#34d399",
              border: `1px solid ${connection.isActive ? "rgba(251,191,36,0.2)" : "rgba(52,211,153,0.2)"}`,
            }}
          >
            {connection.isActive ? (
              <PauseIcon className="w-3 h-3" />
            ) : (
              <PlayIcon className="w-3 h-3" />
            )}
            {connection.isActive ? "Pause" : "Resume"}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
            }}
          >
            {expanded ? "Hide" : "Setup"}
          </button>
        </div>
      </div>

      {/* Expanded: Apps Script + mapping */}
      {expanded && (
        <div
          className="border-t p-4 space-y-5"
          style={{ borderColor: colors.border }}
        >
          {/* Apps Script */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-semibold"
                style={{ color: colors.textSecondary }}
              >
                Apps Script code
              </p>
              <CopyBtn text={appsScript} label="Copy script" />
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${colors.border}` }}
            >
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <span
                  className="text-[10px] font-mono"
                  style={{ color: colors.textDim }}
                >
                  Code.gs
                </span>
                <CopyBtn text={appsScript} />
              </div>
              <pre
                className="p-3 text-[10px] font-mono overflow-x-auto max-h-48"
                style={{ color: "#a5b4fc", background: "rgba(0,0,0,0.3)" }}
              >
                {appsScript}
              </pre>
            </div>

            <div
              className="rounded-xl p-3 space-y-2"
              style={{
                background: "rgba(99,102,241,0.05)",
                border: "1px solid rgba(99,102,241,0.12)",
              }}
            >
              <p
                className="text-xs font-semibold"
                style={{ color: colors.accentLight }}
              >
                How to install:
              </p>
              <ol className="space-y-1">
                {[
                  "Open Google Forms → ⋮ menu → Script editor",
                  "Delete existing code, paste the script above",
                  "Save (Ctrl+S), then click Triggers (clock icon)",
                  "Add trigger: function onFormSubmit, Event type: On form submit",
                  "Authorize the script when prompted",
                ].map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[11px]"
                    style={{ color: colors.textMuted }}
                  >
                    <span
                      className="shrink-0 font-semibold"
                      style={{ color: colors.accentLight }}
                    >
                      {i + 1}.
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Field mappings */}
          <div className="space-y-2">
            <p
              className="text-xs font-semibold"
              style={{ color: colors.textSecondary }}
            >
              Field mappings
            </p>
            <div className="space-y-1.5">
              {connection.fieldMappings.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <code
                    className="px-2 py-1 rounded-lg font-mono text-[10px]"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: colors.textMuted,
                    }}
                  >
                    {m.formQuestionTitle}
                  </code>
                  <span style={{ color: colors.textDim }}>→</span>
                  <code
                    className="px-2 py-1 rounded-lg font-mono text-[10px]"
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      color: "#818cf8",
                    }}
                  >
                    {`{{${m.templateFieldName}}}`}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {/* Recent submissions */}
          {submissions && submissions.length > 0 && (
            <div className="space-y-2">
              <p
                className="text-xs font-semibold"
                style={{ color: colors.textSecondary }}
              >
                Recent submissions ({submissions.length})
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {submissions
                  .slice(0, 8)
                  .map(
                    (s: {
                      _id: string;
                      filename: string;
                      status: string;
                      submittedAt: number;
                      fileUrl?: string;
                      respondentEmail?: string;
                      errorMessage?: string;
                    }) => (
                      <div
                        key={s._id}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0`}
                          style={{
                            background:
                              s.status === "generated"
                                ? "#34d399"
                                : s.status === "error"
                                  ? "#f87171"
                                  : "#fbbf24",
                          }}
                        />
                        <span
                          className="flex-1 text-[11px] truncate"
                          style={{ color: colors.textSecondary }}
                        >
                          {s.filename}.docx
                        </span>
                        <span
                          className="text-[10px] shrink-0"
                          style={{ color: colors.textDim }}
                        >
                          {formatDistanceToNow(new Date(s.submittedAt), {
                            addSuffix: true,
                          })}
                        </span>
                        {s.status === "generated" && s.fileUrl && (
                          <a
                            href={s.fileUrl}
                            download={`${s.filename}.docx`}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-lg transition-colors"
                            style={{
                              background: "rgba(52,211,153,0.1)",
                              color: "#34d399",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            ↓
                          </a>
                        )}
                        {s.status === "error" && (
                          <span
                            className="text-[9px]"
                            style={{ color: "#f87171" }}
                            title={s.errorMessage}
                          >
                            Error
                          </span>
                        )}
                      </div>
                    )
                  )}
              </div>
            </div>
          )}

          {/* Danger */}
          <button
            onClick={async () => {
              if (confirm(`Delete connection to "${connection.formTitle}"?`))
                await removeConnection({ id: connection._id });
            }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              color: "#f87171",
              border: "1px solid rgba(248,113,113,0.2)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(248,113,113,0.08)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Trash2Icon className="w-3.5 h-3.5" />
            Remove connection
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConnectFormPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const templateId = params.templateId as Id<"templates">;

  const template = useQuery(api.templates.getById, { id: templateId });
  const connections = useQuery(
    api.formConnections.getByTemplateId,
    isLoaded && isSignedIn ? { templateId } : "skip"
  );

  const [showWizard, setShowWizard] = useState(false);

  const webhookBase =
    typeof window !== "undefined" ? window.location.origin : "";

  if (template === undefined || connections === undefined) {
    return (
      <div className="flex flex-col h-full" style={{ background: colors.bg }}>
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
        className="flex flex-col items-center justify-center h-full gap-4"
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
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* Header */}
      <div
        className="px-6 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Link
            href="/templates"
            className="text-[11px] transition-colors"
            style={{ color: colors.textMuted }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = colors.accentLight)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = colors.textMuted)
            }
          >
            Templates
          </Link>
          <span style={{ color: colors.textDim, fontSize: 11 }}>/</span>
          <Link
            href={`/templates/${templateId}/edit`}
            className="text-[11px] transition-colors"
            style={{ color: colors.textMuted }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = colors.accentLight)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = colors.textMuted)
            }
          >
            {template.name}
          </Link>
          <span style={{ color: colors.textDim, fontSize: 11 }}>/</span>
          <span className="text-[11px]" style={{ color: colors.textSecondary }}>
            Connect Form
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1
              className="text-base font-semibold"
              style={{ color: colors.text }}
            >
              Google Form connections
            </h1>
            <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
              Auto-generate documents when a Google Form is submitted.
            </p>
          </div>
          {!showWizard && (
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all"
              style={{
                background: colors.accentBg,
                color: colors.accentPale,
                border: `1px solid ${colors.accentBorder}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.accentBgHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.accentBg;
              }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Connect a form
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {showWizard ? (
          <div className="max-w-xl">
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-sm font-semibold"
                style={{ color: colors.text }}
              >
                New connection
              </h2>
              <button
                onClick={() => setShowWizard(false)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                Cancel
              </button>
            </div>
            <SetupWizard
              templateId={templateId}
              templateFields={template.fields}
              onDone={() => setShowWizard(false)}
            />
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.15)",
              }}
            >
              <LinkIcon className="w-7 h-7" style={{ color: "#818cf8" }} />
            </div>
            <p
              className="text-sm font-semibold mb-2"
              style={{ color: colors.textSecondary }}
            >
              No form connections yet
            </p>
            <p
              className="text-xs mb-5 max-w-xs leading-relaxed"
              style={{ color: colors.textDim }}
            >
              Connect a Google Form to automatically generate documents when
              someone submits a response.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl"
              style={{
                background: colors.accentBg,
                color: colors.accentPale,
                border: `1px solid ${colors.accentBorder}`,
              }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Connect a form
            </button>
          </div>
        ) : (
          <div className="max-w-2xl space-y-4">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn._id}
                connection={conn}
                webhookBase={webhookBase}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
