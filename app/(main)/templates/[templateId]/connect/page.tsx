"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import {
  PlusIcon,
  Trash2Icon,
  LinkIcon,
  PlayIcon,
  PauseIcon,
  AlertCircleIcon,
  ZapIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  SearchIcon,
  ChevronRightIcon,
  LogOutIcon,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { colors, fieldTypeColors } from "@/lib/design-tokens";
import { formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GoogleForm {
  id: string;
  name: string;
  modifiedTime: string;
}

interface FormQuestion {
  id: string;
  title: string;
}

// ── Google Account Badge ──────────────────────────────────────────────────────

function AccountBadge({
  email,
  templateId,
  onDisconnect,
}: {
  email: string;
  templateId: string;
  onDisconnect: () => void;
}) {
  const disconnect = useMutation(api.googleAccounts.disconnect);

  const handleDisconnect = async () => {
    if (
      !confirm(
        "Disconnect Google account? This will not delete existing connections."
      )
    )
      return;
    await disconnect();
    onDisconnect();
  };

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{
        background: "rgba(52,211,153,0.06)",
        border: "1px solid rgba(52,211,153,0.15)",
      }}
    >
      <CheckCircleIcon
        className="w-4 h-4 shrink-0"
        style={{ color: "#34d399" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: "#34d399" }}>
          Google connected
        </p>
        <p className="text-[11px] truncate" style={{ color: colors.textDim }}>
          {email}
        </p>
      </div>
      <button
        onClick={handleDisconnect}
        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors"
        style={{ color: colors.textDim, border: `1px solid ${colors.border}` }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#f87171";
          e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = colors.textDim;
          e.currentTarget.style.borderColor = colors.border;
        }}
        title="Disconnect"
      >
        <LogOutIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Google Form Wizard ────────────────────────────────────────────────────────

function GoogleFormWizard({
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

  // Step 1 state
  const [forms, setForms] = useState<GoogleForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [formsError, setFormsError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedForm, setSelectedForm] = useState<GoogleForm | null>(null);

  // Step 2 state
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [questionIdMap, setQuestionIdMap] = useState<Record<string, string>>(
    {}
  );
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [mappings, setMappings] = useState<Record<string, string>>({}); // templateFieldName → questionTitle

  // Step 3 state
  const [filenamePattern, setFilenamePattern] = useState("");
  const [saving, setSaving] = useState(false);

  // Load forms on mount
  useEffect(() => {
    fetch("/api/google/forms")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setFormsError(data.error);
        else setForms(data.forms ?? []);
      })
      .catch(() => setFormsError("Failed to load forms"))
      .finally(() => setFormsLoading(false));
  }, []);

  // Load questions when form is selected
  const loadQuestions = useCallback(async (form: GoogleForm) => {
    setSelectedForm(form);
    setQuestionsLoading(true);
    try {
      const res = await fetch(`/api/google/forms/${form.id}/questions`);
      const data = await res.json();
      if (data.error) {
        toast.error("Failed to load form questions");
        return;
      }
      setQuestions(data.questions ?? []);
      setQuestionIdMap(data.questionIdMap ?? {});
      setStep(2);
    } catch {
      toast.error("Failed to load form questions");
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  const handleCreate = async () => {
    if (!selectedForm) return;

    const validMappings = Object.entries(mappings)
      .filter(([, questionTitle]) => questionTitle)
      .map(([templateFieldName, formQuestionTitle]) => ({
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
        formId: selectedForm.id,
        formTitle: selectedForm.name,
        fieldMappings: validMappings,
        filenamePattern: filenamePattern.trim() || `document_{{row_number}}`,
        connectionType: "google",
        googleFormId: selectedForm.id,
        googleQuestionMap: questionIdMap,
      });
      toast.success("Connection created — first sync in ≤5 min");
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create connection");
    } finally {
      setSaving(false);
    }
  };

  const filteredForms = forms.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const mappableFields = templateFields.filter(
    (f) =>
      f.type !== "loop" &&
      f.type !== "condition" &&
      f.type !== "condition_inverse"
  );

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Select form" },
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

      {/* ── Step 1: Pick a Google Form ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: colors.text }}
            >
              Select a Google Form from your Drive
            </h3>
            <p className="text-xs" style={{ color: colors.textMuted }}>
              We&apos;ll automatically read its questions — no copy-pasting
              needed.
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: colors.textDim }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms…"
              className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
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

          {/* Form list */}
          {formsLoading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <div
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.accentLight }}
              />
              <span className="text-xs" style={{ color: colors.textDim }}>
                Loading your forms…
              </span>
            </div>
          ) : formsError ? (
            <div
              className="rounded-xl p-4 text-center"
              style={{
                background: "rgba(248,113,113,0.06)",
                border: "1px solid rgba(248,113,113,0.15)",
              }}
            >
              <p className="text-xs" style={{ color: "#f87171" }}>
                {formsError}
              </p>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs" style={{ color: colors.textDim }}>
                {search
                  ? "No forms match your search"
                  : "No Google Forms found in your Drive"}
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden divide-y max-h-72 overflow-y-auto"
              style={{
                border: `1px solid ${colors.border}`,
                // divideColor: colors.border,
              }}
            >
              {filteredForms.map((form) => (
                <button
                  key={form.id}
                  onClick={() => loadQuestions(form)}
                  disabled={questionsLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(99,102,241,0.06)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm"
                    style={{ background: "rgba(99,102,241,0.12)" }}
                  >
                    📋
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: colors.text }}
                    >
                      {form.name}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: colors.textDim }}
                    >
                      Modified{" "}
                      {formatDistanceToNow(new Date(form.modifiedTime), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  {questionsLoading && selectedForm?.id === form.id ? (
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                      style={{ borderColor: colors.accentLight }}
                    />
                  ) : (
                    <ChevronRightIcon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: colors.textDim }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Map fields ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3
                className="text-sm font-semibold"
                style={{ color: colors.text }}
              >
                Map fields
              </h3>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}
              >
                {selectedForm?.name}
              </span>
            </div>
            <p className="text-xs" style={{ color: colors.textMuted }}>
              Match each template field to the Google Form question that
              provides its value.
            </p>
          </div>

          <div className="space-y-2.5">
            {mappableFields.map((field) => {
              const c = fieldTypeColors[field.type] ?? "#6b7280";
              return (
                <div
                  key={field.name}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${mappings[field.name] ? `${c}25` : colors.border}`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: c }}
                  />
                  <div className="w-36 shrink-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: colors.textSecondary }}
                    >
                      {field.label}
                    </p>
                    <code
                      className="text-[9px] font-mono"
                      style={{ color: colors.textDim }}
                    >
                      {`{{${field.name}}}`}
                    </code>
                  </div>
                  <span
                    className="text-xs shrink-0"
                    style={{ color: colors.textDim }}
                  >
                    ←
                  </span>
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
                    {questions.map((q) => (
                      <option
                        key={q.id}
                        value={q.title}
                        style={{ background: "#18181d" }}
                      >
                        {q.title}
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
                No questions found in this form. Make sure your form has
                questions.
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
              Next: Filename →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Filename pattern ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: colors.text }}
            >
              Filename pattern
            </h3>
            <p className="text-xs" style={{ color: colors.textMuted }}>
              How each generated document will be named. Click tokens to insert
              them.
            </p>
          </div>

          <div className="space-y-3">
            <input
              value={filenamePattern}
              onChange={(e) => setFilenamePattern(e.target.value)}
              placeholder={`${selectedForm?.name ?? "document"}_{{row_number}}`}
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
                  .slice(0, 4)
                  .map((k) => `{{${k}}}`),
              ].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setFilenamePattern((p) => (p || "") + token)}
                  className="text-[10px] font-mono px-2 py-1 rounded-lg transition-colors"
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    color: "#818cf8",
                    border: "1px solid rgba(99,102,241,0.2)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(99,102,241,0.2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "rgba(99,102,241,0.1)")
                  }
                >
                  {token}
                </button>
              ))}
            </div>

            {/* Info about timing */}
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(99,102,241,0.05)",
                border: "1px solid rgba(99,102,241,0.12)",
              }}
            >
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: colors.textMuted }}
              >
                <span style={{ color: colors.accentLight }}>
                  ⏱ Auto-sync every 5 minutes.
                </span>{" "}
                After someone submits the form, their generated document will
                appear in the submissions list within 5 minutes. You can also
                sync manually.
              </p>
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
                  Creating…
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

function ConnectionCard({ connection }: { connection: any }) {
  const updateConnection = useMutation(api.formConnections.update);
  const removeConnection = useMutation(api.formConnections.remove);
  const syncNow = useAction(api.processFormResponses.syncConnection);
  const submissions = useQuery(api.formConnections.getSubmissions, {
    connectionId: connection._id,
  });
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const generatedCount = (submissions ?? []).filter(
    (s: any) => s.status === "generated"
  ).length;
  const errorCount = (submissions ?? []).filter(
    (s: any) => s.status === "error"
  ).length;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncNow({ connectionId: connection._id });
      toast.success("Sync complete");
    } catch (err: any) {
      toast.error(err?.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

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
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
          style={{
            background: connection.isActive
              ? "rgba(99,102,241,0.15)"
              : "rgba(255,255,255,0.06)",
            border: `1px solid ${connection.isActive ? colors.accentBorder : colors.border}`,
          }}
        >
          📋
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
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
              style={{
                background: connection.isActive
                  ? "rgba(52,211,153,0.12)"
                  : "rgba(255,255,255,0.06)",
                color: connection.isActive ? "#34d399" : colors.textDim,
              }}
            >
              {connection.isActive ? "active" : "paused"}
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
            >
              Google Forms
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
            {connection.lastPolledAt && (
              <span className="text-[10px]" style={{ color: colors.textDim }}>
                synced{" "}
                {formatDistanceToNow(new Date(connection.lastPolledAt), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sync Now */}
          <button
            onClick={handleSync}
            disabled={syncing || !connection.isActive}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              background: "rgba(99,102,241,0.1)",
              color: syncing ? colors.textDim : "#818cf8",
              border: "1px solid rgba(99,102,241,0.2)",
              opacity: !connection.isActive ? 0.4 : 1,
            }}
            title="Sync now"
          >
            <RefreshCwIcon
              className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Syncing…" : "Sync"}
          </button>

          {/* Pause/Resume */}
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
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {/* Expanded: mappings + submissions */}
      {expanded && (
        <div
          className="border-t p-4 space-y-5"
          style={{ borderColor: colors.border }}
        >
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
                <div
                  key={i}
                  className="flex items-center gap-3 text-xs flex-wrap"
                >
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
                Generated documents ({submissions.length})
              </p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {submissions.map((s: any) => (
                  <div
                    key={s._id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
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
                    {s.respondentEmail && (
                      <span
                        className="text-[10px] shrink-0"
                        style={{ color: colors.textDim }}
                      >
                        {s.respondentEmail}
                      </span>
                    )}
                    <span
                      className="text-[10px] shrink-0"
                      style={{ color: colors.textDim }}
                    >
                      {formatDistanceToNow(new Date(s.submittedAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {s.status === "generated" && s.fileUrl && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const res = await fetch(s.fileUrl);
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${s.filename}.docx`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors shrink-0"
                        style={{
                          background: "rgba(52,211,153,0.1)",
                          color: "#34d399",
                        }}
                      >
                        Download
                      </button>
                    )}
                    {s.status === "error" && (
                      <span
                        className="text-[9px] shrink-0"
                        style={{ color: "#f87171" }}
                        title={s.errorMessage}
                      >
                        Error ⚠
                      </span>
                    )}
                    {s.status === "pending" && (
                      <span
                        className="text-[9px] shrink-0"
                        style={{ color: "#fbbf24" }}
                      >
                        Processing…
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete */}
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
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const templateId = params.templateId as Id<"templates">;

  const template = useQuery(api.templates.getById, { id: templateId });
  const connections = useQuery(
    api.formConnections.getByTemplateId,
    isLoaded && isSignedIn ? { templateId } : "skip"
  );
  const googleAccount = useQuery(api.googleAccounts.getMyAccount);

  const [showWizard, setShowWizard] = useState(false);
  const [accountRefresh, setAccountRefresh] = useState(0);

  // Show success toast when returning from OAuth
  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      toast.success("Google account connected!");
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const handleConnectGoogle = () => {
    window.location.href = `/api/google/auth?templateId=${templateId}`;
  };

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

  const isConnected = !!googleAccount;

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
              Auto-generate documents when your Google Form receives a response.
            </p>
          </div>
          {isConnected && !showWizard && (
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all"
              style={{
                background: colors.accentBg,
                color: colors.accentPale,
                border: `1px solid ${colors.accentBorder}`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = colors.accentBgHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = colors.accentBg)
              }
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Connect a form
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* ── Not connected to Google ── */}
        {!isConnected && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${colors.border}`,
              }}
            >
              🔗
            </div>
            <div>
              <p
                className="text-sm font-semibold mb-2"
                style={{ color: colors.text }}
              >
                Connect your Google account
              </p>
              <p
                className="text-xs max-w-xs leading-relaxed mx-auto"
                style={{ color: colors.textDim }}
              >
                Connect once, then pick any Google Form from your Drive.
                Responses will automatically generate documents — no code
                needed.
              </p>
            </div>
            <button
              onClick={handleConnectGoogle}
              className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
              style={{
                background: "rgba(99,102,241,0.2)",
                color: "#a5b4fc",
                border: "1px solid rgba(99,102,241,0.35)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(99,102,241,0.3)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(99,102,241,0.2)")
              }
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Connect with Google
            </button>
          </div>
        )}

        {/* ── Connected, show wizard or connections ── */}
        {isConnected && (
          <div className="max-w-xl space-y-5">
            {/* Account badge */}
            <AccountBadge
              email={googleAccount.email}
              templateId={templateId}
              onDisconnect={() => {}}
            />

            {showWizard ? (
              <div>
                <div className="flex items-center justify-between mb-5">
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
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.05)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    Cancel
                  </button>
                </div>
                <GoogleFormWizard
                  templateId={templateId}
                  templateFields={template.fields}
                  onDone={() => setShowWizard(false)}
                />
              </div>
            ) : connections.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 text-center rounded-2xl"
                style={{ border: `1px dashed ${colors.border}` }}
              >
                <LinkIcon
                  className="w-7 h-7 mb-3"
                  style={{ color: colors.textDim }}
                />
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: colors.textSecondary }}
                >
                  No connections yet
                </p>
                <p className="text-xs mb-4" style={{ color: colors.textDim }}>
                  Pick a Google Form to start generating documents
                  automatically.
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
              <div className="space-y-4 max-w-2xl">
                {connections.map((conn) => (
                  <ConnectionCard key={conn._id} connection={conn} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
