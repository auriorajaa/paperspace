// app/(main)/templates/[templateId]/connect/page.tsx
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
  ExternalLinkIcon,
  InfoIcon,
  XIcon,
  AlertTriangleIcon,
  FileSpreadsheetIcon,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { colors, fieldTypeColors } from "@/lib/design-tokens";
import { formatDistanceToNow } from "date-fns";
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

// ── Error Banner ──────────────────────────────────────────────────────────────

function ErrorBanner({
  message,
  onDismiss,
  onRetry,
  action,
}: {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{
        background: "rgba(248,113,113,0.08)",
        border: "1px solid rgba(248,113,113,0.2)",
      }}
    >
      <AlertCircleIcon
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: "#f87171" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-relaxed" style={{ color: "#fca5a5" }}>
          {message}
        </p>
        {(onRetry || action) && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-[13px] font-medium px-3 py-2 rounded-lg min-h-[44px] transition-colors"
                style={{
                  background: "rgba(248,113,113,0.15)",
                  color: "#f87171",
                  border: "1px solid rgba(248,113,113,0.3)",
                }}
              >
                Try again
              </button>
            )}
            {action && (
              <button
                onClick={action.onClick}
                className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0"
                style={{
                  background: "rgba(248,113,113,0.15)",
                  color: "#f87171",
                  border: "1px solid rgba(248,113,113,0.3)",
                }}
              >
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ color: "#f87171" }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Warning Banner ────────────────────────────────────────────────────────────

function WarningBanner({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="rounded-xl p-3 flex items-start gap-3"
      style={{
        background: "rgba(251,191,36,0.08)",
        border: "1px solid rgba(251,191,36,0.2)",
      }}
    >
      <AlertTriangleIcon
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: "#fbbf24" }}
      />
      <p
        className="text-xs flex-1 leading-relaxed"
        style={{ color: "#fde68a" }}
      >
        {message}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[44px] shrink-0"
          style={{
            background: "rgba(251,191,36,0.15)",
            color: "#fbbf24",
            border: "1px solid rgba(251,191,36,0.3)",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Info Box ──────────────────────────────────────────────────────────────────

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3 flex items-start gap-2.5"
      style={{
        background: "rgba(99,102,241,0.06)",
        border: "1px solid rgba(99,102,241,0.15)",
      }}
    >
      <InfoIcon
        className="w-3.5 h-3.5 shrink-0 mt-0.5"
        style={{ color: colors.accentLight }}
      />
      <div
        className="text-xs leading-relaxed"
        style={{ color: colors.textMuted }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Google Account Badge ──────────────────────────────────────────────────────

function AccountBadge({
  email,
  expiresAt,
  onDisconnect,
  onReconnect,
}: {
  email: string;
  expiresAt?: number;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const disconnect = useMutation(api.googleAccounts.disconnect);
  const deactivateAll = useMutation(api.formConnections.deactivateAllForOwner);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const tokenExpiresIn = expiresAt ? expiresAt - Date.now() : null;
  const tokenExpiringSoon =
    tokenExpiresIn !== null && tokenExpiresIn < 3_600_000 && tokenExpiresIn > 0;
  const tokenExpired = tokenExpiresIn !== null && tokenExpiresIn <= 0;

  const handleDisconnectConfirmed = async () => {
    setDisconnecting(true);
    try {
      await deactivateAll({});
      await disconnect();
      onDisconnect();
      toast.success(
        "Google account disconnected — all connections paused. Reconnect to resume auto-sync.",
      );
    } catch {
      toast.error("Failed to disconnect. Please try again.");
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-xl"
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
            <p
              className="text-[11px] truncate"
              style={{ color: colors.textDim }}
            >
              {email}
            </p>
          </div>
          <button
            onClick={() => setConfirmDisconnect(true)}
            disabled={disconnecting}
            aria-label="Disconnect Google account"
            className="flex items-center justify-center w-11 h-11 rounded-lg transition-colors shrink-0"
            style={{
              color: colors.textDim,
              border: `1px solid ${colors.border}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f87171";
              e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.textDim;
              e.currentTarget.style.borderColor = colors.border;
            }}
            title="Disconnect Google account"
          >
            {disconnecting ? (
              <div
                className="w-3 h-3 rounded-full border border-t-transparent animate-spin"
                style={{ borderColor: colors.textDim }}
              />
            ) : (
              <LogOutIcon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Always-visible token info — replaces hover-only tooltip on mobile */}
        <p
          className="text-[11px] leading-relaxed px-1"
          style={{ color: colors.textDim }}
        >
          Token auto-refreshes in the background. You only need to reconnect if
          you revoke access in your Google Account settings.
        </p>

        {tokenExpired && (
          <ErrorBanner
            message="Your Google connection has expired. Please disconnect and reconnect to resume auto-sync."
            action={{ label: "Reconnect now", onClick: onReconnect }}
          />
        )}
        {tokenExpiringSoon && !tokenExpired && expiresAt && (
          <WarningBanner
            message={`Your Google token expires ${formatDistanceToNow(
              expiresAt,
              { addSuffix: true }
            )}. Consider reconnecting soon to avoid sync interruption.`}
          />
        )}
      </div>

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google account?</AlertDialogTitle>
            <AlertDialogDescription>
              All connections will be paused. Existing generated documents will
              not be deleted. You can reconnect at any time to resume auto-sync.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDisconnectConfirmed}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({
  step,
  steps,
}: {
  step: number;
  steps: { n: number; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {steps.map(({ n, label }, idx) => (
        <div key={n} className="flex items-center gap-1.5 shrink-0">
          {idx > 0 && (
            <div className="w-6 h-px" style={{ background: colors.border }} />
          )}
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
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
                border: `1px solid ${
                  step === n
                    ? "rgba(99,102,241,0.35)"
                    : step > n
                      ? "rgba(52,211,153,0.3)"
                      : "rgba(255,255,255,0.08)"
                }`,
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

  const [forms, setForms] = useState<GoogleForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [formsError, setFormsError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedForm, setSelectedForm] = useState<GoogleForm | null>(null);

  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [questionIdMap, setQuestionIdMap] = useState<Record<string, string>>(
    {},
  );
  // Store linked spreadsheet ID fetched from the questions API
  const [linkedSpreadsheetId, setLinkedSpreadsheetId] = useState<string | null>(
    null,
  );
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [mappingError, setMappingError] = useState("");

  const [filenamePattern, setFilenamePattern] = useState("");
  const [filenameError, setFilenameError] = useState("");
  const [saving, setSaving] = useState(false);

  const ILLEGAL_CHARS = /[<>:"/\\|?*]/;

  useEffect(() => {
    fetch("/api/google/forms")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setFormsError(data.error);
        else setForms(data.forms ?? []);
      })
      .catch(() =>
        setFormsError(
          "Unable to fetch your forms. Check your internet connection or try again.",
        ),
      )
      .finally(() => setFormsLoading(false));
  }, []);

  const loadQuestions = useCallback(async (form: GoogleForm) => {
    setSelectedForm(form);
    setQuestionsLoading(true);
    setQuestionsError("");
    setLinkedSpreadsheetId(null);
    try {
      const res = await fetch(`/api/google/forms/${form.id}/questions`);
      const data = await res.json();
      if (data.error) {
        setQuestionsError(`Failed to load questions: ${data.error}`);
        return;
      }
      const qs: FormQuestion[] = data.questions ?? [];
      if (qs.length === 0) {
        setQuestionsError(
          "This form has no questions that can be mapped. Make sure your form has at least one question.",
        );
        setQuestions([]);
        setQuestionIdMap({});
        setStep(2);
        return;
      }
      setQuestions(qs);
      setQuestionIdMap(data.questionIdMap ?? {});
      // Store linked spreadsheet ID if present
      if (data.spreadsheetId) {
        setLinkedSpreadsheetId(data.spreadsheetId);
      }
      setStep(2);
    } catch {
      setQuestionsError(
        "Failed to load form questions. Please check your connection and try again.",
      );
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  const handleCreate = async () => {
    const validMappings = Object.entries(mappings)
      .filter(([, questionTitle]) => questionTitle)
      .map(([templateFieldName, formQuestionTitle]) => ({
        formQuestionTitle,
        templateFieldName,
      }));

    if (validMappings.length === 0) {
      setMappingError(
        "Please map at least one template field to a Google Form question.",
      );
      return;
    }
    setMappingError("");

    const pattern = filenamePattern.trim() || `document_{{row_number}}`;
    const cleanedPattern = pattern.replace(/{{.*?}}/g, "");
    if (ILLEGAL_CHARS.test(cleanedPattern)) {
      setFilenameError(
        'Filename cannot contain special characters: < > : " / \\ | ? *',
      );
      return;
    }
    setFilenameError("");

    if (!selectedForm) return;
    setSaving(true);
    try {
      await createConnection({
        templateId,
        formId: selectedForm.id,
        formTitle: selectedForm.name,
        // Pass the linked spreadsheet ID so the Spreadsheet button works
        spreadsheetId: linkedSpreadsheetId ?? undefined,
        fieldMappings: validMappings,
        filenamePattern: pattern,
        connectionType: "google",
        googleFormId: selectedForm.id,
        googleQuestionMap: questionIdMap,
      });
      toast.success("Connection created — first sync in ≤5 minutes");
      onDone();
    } catch (err: any) {
      toast.error(
        err?.message ?? "Failed to create connection. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredForms = forms.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  const NON_MAPPABLE = ["loop", "condition", "condition_inverse"];
  const mappableFields = templateFields.filter(
    (f) => !NON_MAPPABLE.includes(f.type),
  );
  const nonMappableFields = templateFields.filter((f) =>
    NON_MAPPABLE.includes(f.type),
  );

  const STEPS = [
    { n: 1, label: "Select form" },
    { n: 2, label: "Map fields" },
    { n: 3, label: "Filename" },
  ];

  return (
    <div className="space-y-5">
      <StepIndicator step={step} steps={STEPS} />

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: colors.text }}
            >
              Select a Google Form
            </h3>
            <p className="text-xs" style={{ color: colors.textMuted }}>
              Choose a form from your Drive — we'll read its questions
              automatically.
            </p>
          </div>

          {formsError ? (
            <ErrorBanner
              message={formsError}
              onDismiss={() => setFormsError("")}
              onRetry={() => {
                setFormsError("");
                setFormsLoading(true);
                fetch("/api/google/forms")
                  .then((r) => r.json())
                  .then((d) => {
                    if (d.error) setFormsError(d.error);
                    else setForms(d.forms ?? []);
                  })
                  .catch(() =>
                    setFormsError(
                      "Unable to fetch your forms. Check your connection.",
                    ),
                  )
                  .finally(() => setFormsLoading(false));
              }}
            />
          ) : (
            <>
              <div className="relative">
                <SearchIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: colors.textDim }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search forms…"
                  className="w-full rounded-xl pl-9 pr-3 py-3 text-sm outline-none min-h-[44px]"
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
                  className="rounded-xl overflow-hidden max-h-64 overflow-y-auto"
                  style={{ border: `1px solid ${colors.border}` }}
                >
                  {filteredForms.map((form) => (
                    <div
                      key={form.id}
                      className="flex items-center"
                      style={{ borderBottom: `1px solid ${colors.border}` }}
                    >
                      <button
                        onClick={() => loadQuestions(form)}
                        disabled={questionsLoading}
                        className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-h-[56px] transition-colors"
                        style={{ background: "transparent" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(99,102,241,0.06)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
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
                            className="text-xs"
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
                      <a
                        href={`https://docs.google.com/forms/d/${form.id}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open in Google Forms"
                        className="flex items-center justify-center w-11 h-11 shrink-0 mr-2 rounded-lg transition-colors"
                        style={{ color: colors.textDim }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = colors.accentLight)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = colors.textDim)
                        }
                        onClick={(e) => e.stopPropagation()}
                        title="Open in Google Forms"
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3
                className="text-sm font-semibold"
                style={{ color: colors.text }}
              >
                Map fields
              </h3>
              {selectedForm && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: "rgba(52,211,153,0.1)",
                    color: "#34d399",
                  }}
                >
                  {selectedForm.name}
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: colors.textMuted }}>
              Match each template field to the Google Form question that
              provides its value.
            </p>
          </div>

          {questionsError && <WarningBanner message={questionsError} />}

          {mappingError && (
            <ErrorBanner
              message={mappingError}
              onDismiss={() => setMappingError("")}
            />
          )}

          {nonMappableFields.length > 0 && (
            <InfoBox>
              <span
                className="font-medium"
                style={{ color: colors.accentLight }}
              >
                {nonMappableFields.length} field
                {nonMappableFields.length !== 1 ? "s" : ""} skipped:
              </span>{" "}
              Condition and loop fields (
              <code className="font-mono">
                {nonMappableFields.map((f) => f.label).join(", ")}
              </code>
              ) are internal template logic and cannot be mapped from Google
              Forms.
            </InfoBox>
          )}

          {mappableFields.length > 0 ? (
            <div className="space-y-2">
              {mappableFields.map((field) => {
                const c = fieldTypeColors[field.type] ?? "#6b7280";
                return (
                  <div
                    key={field.name}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${mappings[field.name] ? `${c}30` : colors.border}`,
                    }}
                  >
                    <div className="flex items-center gap-2 sm:w-36 sm:shrink-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: c }}
                      />
                      <div className="min-w-0">
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
                    </div>
                    <span
                      className="text-xs shrink-0 hidden sm:block"
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
                      className="flex-1 w-full rounded-lg px-2.5 py-2.5 text-sm outline-none min-h-[44px]"
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
          ) : (
            <div className="text-center py-6">
              <p className="text-xs" style={{ color: colors.textDim }}>
                No mappable fields in this template.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.09)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
              }
            >
              ← Back
            </button>
            <button
              onClick={() => {
                setMappingError("");
                setStep(3);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium py-2 rounded-xl min-h-[44px] transition-all duration-150"
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

      {/* ── Step 3 ── */}
      {step === 3 && (
        <div className="space-y-4">
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
              onChange={(e) => {
                setFilenamePattern(e.target.value);
                setFilenameError("");
              }}
              placeholder={`${selectedForm?.name ?? "document"}_{{row_number}}`}
              className="w-full rounded-xl px-3 py-3 text-sm font-mono outline-none min-h-[44px]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${
                  filenameError ? "rgba(248,113,113,0.4)" : colors.border
                }`,
                color: colors.text,
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = `1px solid ${colors.accentBorder}`)
              }
              onBlur={(e) =>
                (e.currentTarget.style.border = `1px solid ${
                  filenameError ? "rgba(248,113,113,0.4)" : colors.border
                }`)
              }
            />
            {filenameError && (
              <p className="text-xs" style={{ color: "#f87171" }}>
                {filenameError}
              </p>
            )}

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
                  className="text-[10px] font-mono px-2 py-2 rounded-lg transition-colors min-h-[36px]"
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

            {/* Show linked spreadsheet info if detected */}
            {linkedSpreadsheetId && (
              <div
                className="flex items-center gap-2 p-2 rounded-lg"
                style={{
                  background: "rgba(52,211,153,0.06)",
                  border: "1px solid rgba(52,211,153,0.15)",
                }}
              >
                <FileSpreadsheetIcon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "#34d399" }}
                />
                <p className="text-[11px]" style={{ color: "#34d399" }}>
                  Linked Google Sheet detected — a Spreadsheet button will
                  appear on the connection card.
                </p>
              </div>
            )}

            <InfoBox>
              <span style={{ color: colors.accentLight }}>
                ⏱ Auto-sync every 5 minutes.
              </span>{" "}
              After someone submits the form, their document will appear in the
              submissions list within 5 minutes. You can also sync manually at
              any time.
            </InfoBox>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.09)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
              }
            >
              ← Back
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 text-[13px] py-2 rounded-xl font-semibold transition-all duration-150 min-h-[44px]"
              style={{
                background: saving
                  ? "rgba(99,102,241,0.12)"
                  : "rgba(99,102,241,0.2)",
                color: saving ? colors.textDim : "#a5b4fc",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
              onMouseEnter={(e) => {
                if (!saving)
                  e.currentTarget.style.background = "rgba(99,102,241,0.3)";
              }}
              onMouseLeave={(e) => {
                if (!saving)
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
  const [syncError, setSyncError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const generatedCount = (submissions ?? []).filter(
    (s: any) => s.status === "generated",
  ).length;
  const errorCount = (submissions ?? []).filter(
    (s: any) => s.status === "error",
  ).length;
  const pendingCount = (submissions ?? []).filter(
    (s: any) => s.status === "pending",
  ).length;

  const handleSync = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      await syncNow({ connectionId: connection._id });
      toast.success("Sync complete");
    } catch (err: any) {
      const msg = err?.message ?? "Sync failed";
      setSyncError(
        msg.includes("token") || msg.includes("Token")
          ? "Sync failed — Google token may have expired. Try reconnecting your Google account."
          : msg.includes("Template")
            ? "Sync failed — template file is missing. Please check your template."
            : "Sync failed. Check your Google connection and try again.",
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleActive = async () => {
    setToggling(true);
    try {
      await updateConnection({
        id: connection._id,
        isActive: !connection.isActive,
      });
    } finally {
      setToggling(false);
    }
  };

  const handleRemoveConfirmed = async () => {
    setRemoving(true);
    try {
      await removeConnection({ id: connection._id });
      toast.success("Connection removed");
    } catch {
      toast.error("Failed to remove connection. Please try again.");
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.025)",
          border: `1px solid ${connection.isActive ? colors.accentBorder : colors.border}`,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4">
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
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: colors.text }}
              >
                {connection.formTitle}
              </p>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  background: connection.isActive
                    ? "rgba(52,211,153,0.12)"
                    : "rgba(255,255,255,0.06)",
                  color: connection.isActive ? "#34d399" : colors.textDim,
                }}
                title={
                  connection.isActive
                    ? "Auto-sync is active"
                    : "Auto-sync is paused — manual sync still works"
                }
              >
                {connection.isActive ? "active" : "paused"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              <span className="text-xs" style={{ color: colors.textMuted }}>
                {connection.fieldMappings.length} field
                {connection.fieldMappings.length !== 1 ? "s" : ""} mapped
              </span>
              <span className="text-xs" style={{ color: "#34d399" }}>
                {generatedCount} generated
              </span>
              {errorCount > 0 && (
                <span className="text-xs" style={{ color: "#f87171" }}>
                  {errorCount} errors
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-xs" style={{ color: "#fbbf24" }}>
                  {pendingCount} pending
                </span>
              )}
              {connection.lastPolledAt && (
                <span className="text-xs" style={{ color: colors.textDim }}>
                  synced{" "}
                  {formatDistanceToNow(new Date(connection.lastPolledAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
          {connection.googleFormId && (
            <a
              href={`https://docs.google.com/forms/d/${connection.googleFormId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = colors.accentLight;
                e.currentTarget.style.borderColor = colors.accentBorder;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.textMuted;
                e.currentTarget.style.borderColor = colors.border;
              }}
              title="Open Google Form"
            >
              <ExternalLinkIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open form</span>
            </a>
          )}

          {connection.spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${connection.spreadsheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#34d399";
                e.currentTarget.style.borderColor = "rgba(52,211,153,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.textMuted;
                e.currentTarget.style.borderColor = colors.border;
              }}
              title="View responses in Google Sheets"
            >
              <FileSpreadsheetIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Spreadsheet</span>
            </a>
          )}

          <div className="flex-1" />

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
            style={{
              background: "rgba(99,102,241,0.1)",
              color: syncing ? colors.textDim : "#818cf8",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(99,102,241,0.18)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(99,102,241,0.1)")
            }
            title="Sync now (works even when paused)"
          >
            <RefreshCwIcon
              className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">
              {syncing ? "Syncing…" : "Sync"}
            </span>
          </button>

          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
            style={{
              background: connection.isActive
                ? "rgba(251,191,36,0.1)"
                : "rgba(52,211,153,0.1)",
              color: connection.isActive ? "#fbbf24" : "#34d399",
              border: `1px solid ${
                connection.isActive
                  ? "rgba(251,191,36,0.2)"
                  : "rgba(52,211,153,0.2)"
              }`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = connection.isActive
                ? "rgba(251,191,36,0.18)"
                : "rgba(52,211,153,0.18)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = connection.isActive
                ? "rgba(251,191,36,0.1)"
                : "rgba(52,211,153,0.1)")
            }
            title={
              connection.isActive
                ? "Pause auto-sync (manual sync still works)"
                : "Resume auto-sync"
            }
          >
            {toggling ? (
              <div
                className="w-3.5 h-3.5 rounded-full border border-t-transparent animate-spin"
                style={{ borderColor: "currentColor" }}
              />
            ) : connection.isActive ? (
              <PauseIcon className="w-3.5 h-3.5" />
            ) : (
              <PlayIcon className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {connection.isActive ? "Pause" : "Resume"}
            </span>
          </button>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
            }
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </div>

        {/* Sync error */}
        {syncError && (
          <div className="px-4 pb-4">
            <ErrorBanner
              message={syncError}
              onDismiss={() => setSyncError("")}
              onRetry={handleSync}
            />
          </div>
        )}

        {/* Expanded section */}
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
                  {(submissions as any[]).map((s) => (
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
                        className="flex-1 text-xs truncate"
                        style={{ color: colors.textSecondary }}
                      >
                        {s.filename}.docx
                      </span>
                      {s.respondentEmail && (
                        <span
                          className="text-[10px] shrink-0 hidden sm:inline"
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
                          onClick={async () => {
                            const res = await fetch(s.fileUrl);
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${s.filename}.docx`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors shrink-0 min-h-[44px] sm:min-h-0"
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

            {/* Remove connection */}
            <button
              onClick={() => setConfirmRemove(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
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

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove connection?</AlertDialogTitle>
            <AlertDialogDescription>
              The connection to &ldquo;{connection.formTitle}&rdquo; will be
              removed. Existing generated documents will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemoveConfirmed}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConnectFormPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const templateId = params.templateId as Id<"templates">;

  const template = useQuery(
    api.templates.getById,
    isLoaded && isSignedIn ? { id: templateId } : "skip",
  );
  const connections = useQuery(
    api.formConnections.getByTemplateId,
    isLoaded && isSignedIn ? { templateId } : "skip",
  );
  const googleAccount = useQuery(api.googleAccounts.getMyAccount);

  const [showWizard, setShowWizard] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    const p = searchParams.get("error");
    if (p === "google_oauth_denied")
      setGlobalError("Google sign-in was cancelled. Please try again.");
    else if (p === "token_exchange_failed")
      setGlobalError(
        "Google authentication failed. Please try connecting again.",
      );
    else if (p === "oauth_state_invalid")
      setGlobalError(
        "Something went wrong during Google sign-in. Please try again.",
      );

    if (searchParams.get("connected") === "1") {
      toast.success("Google account connected!");
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
    }

    if (p) {
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
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
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <AlertCircleIcon
            className="w-6 h-6"
            style={{ color: colors.danger }}
          />
        </div>
        <div className="text-center">
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: colors.text }}
          >
            Template not found
          </p>
          <p className="text-xs" style={{ color: colors.textDim }}>
            This template may have been deleted.
          </p>
        </div>
        <button
          onClick={() => router.push("/templates")}
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
          }}
        >
          Back to templates
        </button>
      </div>
    );
  }

  const isConnected = !!googleAccount;

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      <div
        className="px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5 shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
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

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-[15px] sm:text-base font-semibold"
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
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0 min-h-[44px]"
              style={{
                background: colors.accentBg,
                color: colors.accentPale,
                border: `1px solid ${colors.accentBorder}`,
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.accentBgHover;
                e.currentTarget.style.boxShadow =
                  "0 0 20px rgba(99,102,241,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.accentBg;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Connect a form
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {globalError && (
          <div className="mb-5 max-w-xl">
            <ErrorBanner
              message={globalError}
              onDismiss={() => setGlobalError("")}
              onRetry={handleConnectGoogle}
            />
          </div>
        )}

        {!isConnected && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
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
                Responses automatically generate documents — no code needed.
              </p>
            </div>
            <button
              onClick={handleConnectGoogle}
              className="flex items-center gap-2 text-[13px] font-semibold px-5 py-3 rounded-xl transition-all duration-150 min-h-[44px]"
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

        {isConnected && (
          <div className="max-w-xl space-y-5">
            <AccountBadge
              email={googleAccount.email}
              expiresAt={googleAccount.expiresAt}
              onDisconnect={() => {}}
              onReconnect={handleConnectGoogle}
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
                    className="text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
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
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <LinkIcon
                    className="w-5 h-5"
                    style={{ color: colors.textDim }}
                  />
                </div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: colors.textSecondary }}
                >
                  No connections yet
                </p>
                <p
                  className="text-xs mb-5 max-w-xs leading-relaxed"
                  style={{ color: colors.textDim }}
                >
                  Pick a Google Form to start generating documents
                  automatically.
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
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
