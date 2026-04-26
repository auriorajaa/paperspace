// app/(main)/templates/[templateId]/connect/template-connect-client.tsx
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
  ChevronRightIcon,
  LogOutIcon,
  ExternalLinkIcon,
  InfoIcon,
  XIcon,
  AlertTriangleIcon,
  FileSpreadsheetIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { fieldTypeColors } from "@/lib/design-tokens";
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

interface FormQuestion {
  id: string;
  title: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts a Google Form ID from a full URL or a bare ID string.
 *
 * Accepts:
 *   https://docs.google.com/forms/d/FORM_ID/edit
 *   https://docs.google.com/forms/d/FORM_ID/viewform
 *   FORM_ID   (raw alphanumeric string, ≥10 chars)
 */
function extractFormId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  // Bare ID: alphanumeric + hyphens/underscores, reasonable minimum length
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
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
        background: "var(--danger-bg)",
        border: "1px solid color-mix(in srgb, var(--danger) 20%, transparent)",
      }}
    >
      <AlertCircleIcon
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: "var(--danger)" }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--danger)" }}
        >
          {message}
        </p>
        {(onRetry || action) && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-[13px] font-medium px-3 py-2 rounded-lg min-h-[44px] transition-colors"
                style={{
                  background:
                    "color-mix(in srgb, var(--danger) 15%, transparent)",
                  color: "var(--danger)",
                  border:
                    "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
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
                  background:
                    "color-mix(in srgb, var(--danger) 15%, transparent)",
                  color: "var(--danger)",
                  border:
                    "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
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
          style={{ color: "var(--danger)" }}
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
        background: "var(--warning-bg)",
        border: "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
      }}
    >
      <AlertTriangleIcon
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: "var(--warning)" }}
      />
      <p
        className="text-xs flex-1 leading-relaxed"
        style={{ color: "var(--warning)" }}
      >
        {message}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs font-medium px-3 py-1.5 rounded-lg min-h-[44px] shrink-0"
          style={{
            background: "color-mix(in srgb, var(--warning) 15%, transparent)",
            color: "var(--warning)",
            border:
              "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
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
        background: "var(--accent-bg)",
        border: "1px solid var(--accent-border)",
      }}
    >
      <InfoIcon
        className="w-3.5 h-3.5 shrink-0 mt-0.5"
        style={{ color: "var(--accent-light)" }}
      />
      <div
        className="text-xs leading-relaxed"
        style={{ color: "var(--text-muted)" }}
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
        "Google account disconnected — all connections paused. Reconnect to resume auto-sync."
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
            background: "var(--success-bg)",
            border:
              "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
          }}
        >
          <CheckCircleIcon
            className="w-4 h-4 shrink-0"
            style={{ color: "var(--success)" }}
          />
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-medium"
              style={{ color: "var(--success)" }}
            >
              Google connected
            </p>
            <p
              className="text-[11px] truncate"
              style={{ color: "var(--text-dim)" }}
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
              color: "var(--text-dim)",
              border: `1px solid var(--border-subtle)`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--danger)";
              e.currentTarget.style.borderColor =
                "color-mix(in srgb, var(--danger) 30%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-dim)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
            title="Disconnect Google account"
          >
            {disconnecting ? (
              <div
                className="w-3 h-3 rounded-full border border-t-transparent animate-spin"
                style={{ borderColor: "var(--text-dim)" }}
              />
            ) : (
              <LogOutIcon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <p
          className="text-[11px] leading-relaxed px-1"
          style={{ color: "var(--text-dim)" }}
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
            <div
              className="w-6 h-px"
              style={{ background: "var(--border-subtle)" }}
            />
          )}
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{
                background:
                  step === n
                    ? "var(--accent-strong-bg)"
                    : step > n
                      ? "var(--success-bg)"
                      : "var(--bg-input)",
                color:
                  step === n
                    ? "var(--accent-pale)"
                    : step > n
                      ? "var(--success)"
                      : "var(--text-dim)",
                border: `1px solid ${
                  step === n
                    ? "var(--accent-border)"
                    : step > n
                      ? "color-mix(in srgb, var(--success) 30%, transparent)"
                      : "var(--border-subtle)"
                }`,
              }}
            >
              {step > n ? "✓" : n}
            </div>
            <span
              className="text-[11px] hidden sm:block"
              style={{
                color: step === n ? "var(--text-secondary)" : "var(--text-dim)",
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

  // ── Step 1: form URL / ID entry ──────────────────────────────────────────
  const [formInput, setFormInput] = useState("");
  const [formInputError, setFormInputError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [selectedForm, setSelectedForm] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // ── Step 2: questions + field mapping ─────────────────────────────────────
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [questionIdMap, setQuestionIdMap] = useState<Record<string, string>>(
    {}
  );
  const [linkedSpreadsheetId, setLinkedSpreadsheetId] = useState<string | null>(
    null
  );
  const [questionsError, setQuestionsError] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [mappingError, setMappingError] = useState("");

  // ── Step 3: filename pattern ──────────────────────────────────────────────
  const [filenamePattern, setFilenamePattern] = useState("");
  const [filenameError, setFilenameError] = useState("");
  const [saving, setSaving] = useState(false);

  const ILLEGAL_CHARS = /[<>:"/\\|?*]/;

  // ── Step 1: load form by ID extracted from URL or raw ID ──────────────────
  const handleLoadForm = useCallback(async () => {
    const formId = extractFormId(formInput);
    if (!formId) {
      setFormInputError(
        "Couldn't recognise a valid Form ID. Paste the full Google Forms URL " +
          "(e.g. https://docs.google.com/forms/d/…/edit) or just the ID part."
      );
      return;
    }

    setFormInputError("");
    setFormLoading(true);

    try {
      const res = await fetch(`/api/google/forms/${formId}/questions`);
      const data = await res.json();

      if (!res.ok || data.error) {
        // Surface actionable messages based on error codes / HTTP status
        if (res.status === 401) {
          setFormInputError(
            data.error ??
              "Your Google session has expired. Please disconnect and reconnect your account."
          );
        } else if (res.status === 403) {
          setFormInputError(
            "You don't have permission to access this form. " +
              "Make sure you are signed in with the Google account that owns the form."
          );
        } else if (res.status === 404) {
          setFormInputError(
            "Form not found. Double-check the URL or ID — the form may have been deleted or moved."
          );
        } else {
          setFormInputError(
            data.error ??
              "Failed to load the form. Check your connection and try again."
          );
        }
        return;
      }

      const formName: string = data.formTitle ?? "Untitled Form";
      setSelectedForm({ id: formId, name: formName });

      const qs: FormQuestion[] = data.questions ?? [];
      setQuestions(qs);
      setQuestionIdMap(data.questionIdMap ?? {});
      if (data.spreadsheetId) setLinkedSpreadsheetId(data.spreadsheetId);

      if (qs.length === 0) {
        setQuestionsError(
          "This form has no questions that can be mapped. " +
            "Make sure your form has at least one question before connecting it."
        );
      } else {
        setQuestionsError("");
      }

      setStep(2);
    } catch {
      setFormInputError(
        "Could not reach Google Forms. Check your internet connection and try again."
      );
    } finally {
      setFormLoading(false);
    }
  }, [formInput]);

  // ── Step 3: create connection ─────────────────────────────────────────────
  const handleCreate = async () => {
    const validMappings = Object.entries(mappings)
      .filter(([, questionTitle]) => questionTitle)
      .map(([templateFieldName, formQuestionTitle]) => ({
        formQuestionTitle,
        templateFieldName,
      }));

    if (validMappings.length === 0) {
      setMappingError(
        "Please map at least one template field to a Google Form question."
      );
      return;
    }
    setMappingError("");

    const pattern = filenamePattern.trim() || `document_{{row_number}}`;
    const cleanedPattern = pattern.replace(/{{.*?}}/g, "");
    if (ILLEGAL_CHARS.test(cleanedPattern)) {
      setFilenameError(
        'Filename cannot contain special characters: < > : " / \\ | ? *'
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
        err?.message ?? "Failed to create connection. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const NON_MAPPABLE = ["loop", "condition", "condition_inverse"];
  const mappableFields = templateFields.filter(
    (f) => !NON_MAPPABLE.includes(f.type)
  );
  const nonMappableFields = templateFields.filter((f) =>
    NON_MAPPABLE.includes(f.type)
  );

  const STEPS = [
    { n: 1, label: "Select form" },
    { n: 2, label: "Map fields" },
    { n: 3, label: "Filename" },
  ];

  return (
    <div className="space-y-5">
      <StepIndicator step={step} steps={STEPS} />

      {/* ── Step 1: Form URL / ID entry ─────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--text)" }}
            >
              Enter your Google Form
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Paste the form URL or just the Form ID — we'll load its questions
              automatically.
            </p>
          </div>

          {/* URL / ID input */}
          <div className="space-y-2">
            <label
              className="text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Form URL or ID
            </label>
            <div className="flex gap-2">
              <input
                value={formInput}
                onChange={(e) => {
                  setFormInput(e.target.value);
                  if (formInputError) setFormInputError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !formLoading) handleLoadForm();
                }}
                placeholder="https://docs.google.com/forms/d/…/edit"
                className="flex-1 rounded-xl px-3 py-3 text-sm outline-none min-h-[44px]"
                style={{
                  background: "var(--bg-muted)",
                  border: `1px solid ${
                    formInputError
                      ? "color-mix(in srgb, var(--danger) 40%, transparent)"
                      : "var(--border-subtle)"
                  }`,
                  color: "var(--text)",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.border = `1px solid var(--accent-border)`)
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border = `1px solid ${
                    formInputError
                      ? "color-mix(in srgb, var(--danger) 40%, transparent)"
                      : "var(--border-subtle)"
                  }`)
                }
                disabled={formLoading}
              />
              <button
                onClick={handleLoadForm}
                disabled={formLoading || !formInput.trim()}
                className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl min-h-[44px] shrink-0 transition-all duration-150"
                style={{
                  background:
                    formLoading || !formInput.trim()
                      ? "var(--bg-input)"
                      : "var(--accent-strong-bg)",
                  color:
                    formLoading || !formInput.trim()
                      ? "var(--text-dim)"
                      : "var(--accent-pale)",
                  border: "1px solid var(--accent-border)",
                }}
                onMouseEnter={(e) => {
                  if (!formLoading && formInput.trim())
                    e.currentTarget.style.background = "var(--accent-mid)";
                }}
                onMouseLeave={(e) => {
                  if (!formLoading && formInput.trim())
                    e.currentTarget.style.background =
                      "var(--accent-strong-bg)";
                }}
              >
                {formLoading ? (
                  <>
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--accent-light)" }}
                    />
                    <span className="hidden sm:inline">Loading…</span>
                  </>
                ) : (
                  <>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Load</span>
                  </>
                )}
              </button>
            </div>

            {formInputError && (
              <ErrorBanner
                message={formInputError}
                onDismiss={() => setFormInputError("")}
              />
            )}
          </div>

          {/* How to find the Form ID */}
          <InfoBox>
            <p
              className="font-medium mb-1"
              style={{ color: "var(--accent-light)" }}
            >
              Where to find your Form ID:
            </p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Open your form in Google Forms</li>
              <li>Copy the URL from the address bar</li>
              <li>
                Paste it above — the ID is the long string between{" "}
                <code className="font-mono">/d/</code> and{" "}
                <code className="font-mono">/edit</code>
              </li>
            </ol>
            <p className="mt-2 font-mono text-[10px] break-all opacity-70">
              docs.google.com/forms/d/
              <span style={{ color: "var(--accent-light)" }}>
                YOUR_FORM_ID_HERE
              </span>
              /edit
            </p>
          </InfoBox>

          {/* Permissions note */}
          <InfoBox>
            <span style={{ color: "var(--accent-light)" }}>
              ℹ️ Access requirement:
            </span>{" "}
            You must be the <strong>owner</strong> of the form. Forms shared
            with you (view-only) may not be accessible due to Google API
            restrictions.
          </InfoBox>
        </div>
      )}

      {/* ── Step 2: Field mapping ────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                Map fields
              </h3>
              {selectedForm && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: "var(--success-bg)",
                    color: "var(--success)",
                  }}
                >
                  {selectedForm.name}
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
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
                style={{ color: "var(--accent-light)" }}
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
                const c = fieldTypeColors[field.type] ?? "var(--text-muted)";
                return (
                  <div
                    key={field.name}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl"
                    style={{
                      background: "var(--bg-muted)",
                      border: `1px solid ${mappings[field.name] ? `${c}30` : "var(--border-subtle)"}`,
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
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {field.label}
                        </p>
                        <code
                          className="text-[9px] font-mono"
                          style={{ color: "var(--text-dim)" }}
                        >{`{{${field.name}}}`}</code>
                      </div>
                    </div>
                    <span
                      className="text-xs shrink-0 hidden sm:block"
                      style={{ color: "var(--text-dim)" }}
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
                        background: "var(--bg-muted)",
                        border: `1px solid var(--border-subtle)`,
                        color: mappings[field.name]
                          ? "var(--text)"
                          : "var(--text-dim)",
                      }}
                    >
                      <option value="" style={{ background: "var(--popover)" }}>
                        — not mapped —
                      </option>
                      {questions.map((q) => (
                        <option
                          key={q.id}
                          value={q.title}
                          style={{ background: "var(--popover)" }}
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
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                No mappable fields in this template.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setStep(1);
                setQuestionsError("");
                setMappingError("");
              }}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: `1px solid var(--border-subtle)`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-input)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--bg-muted)")
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
                background: "var(--accent-strong-bg)",
                color: "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--accent-mid)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--accent-strong-bg)")
              }
            >
              Next: Filename →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Filename pattern ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--text)" }}
            >
              Filename pattern
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
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
                background: "var(--bg-muted)",
                border: `1px solid ${
                  filenameError
                    ? "color-mix(in srgb, var(--danger) 40%, transparent)"
                    : "var(--border-subtle)"
                }`,
                color: "var(--text)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = `1px solid var(--accent-border)`)
              }
              onBlur={(e) =>
                (e.currentTarget.style.border = `1px solid ${
                  filenameError
                    ? "color-mix(in srgb, var(--danger) 40%, transparent)"
                    : "var(--border-subtle)"
                }`)
              }
            />
            {filenameError && (
              <p className="text-xs" style={{ color: "var(--danger)" }}>
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
                    background: "var(--accent-bg)",
                    color: "var(--accent-light)",
                    border: "1px solid var(--accent-border)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--accent-soft)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--accent-bg)")
                  }
                >
                  {token}
                </button>
              ))}
            </div>

            {linkedSpreadsheetId && (
              <div
                className="flex items-center gap-2 p-2 rounded-lg"
                style={{
                  background: "var(--success-bg)",
                  border:
                    "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
                }}
              >
                <FileSpreadsheetIcon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "var(--success)" }}
                />
                <p className="text-[11px]" style={{ color: "var(--success)" }}>
                  Linked Google Sheet detected — a Spreadsheet button will
                  appear on the connection card.
                </p>
              </div>
            )}

            <InfoBox>
              <span style={{ color: "var(--accent-light)" }}>
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
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: `1px solid var(--border-subtle)`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-input)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--bg-muted)")
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
                  ? "var(--accent-bg)"
                  : "var(--accent-strong-bg)",
                color: saving ? "var(--text-dim)" : "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
              }}
              onMouseEnter={(e) => {
                if (!saving)
                  e.currentTarget.style.background = "var(--accent-mid)";
              }}
              onMouseLeave={(e) => {
                if (!saving)
                  e.currentTarget.style.background = "var(--accent-strong-bg)";
              }}
            >
              {saving ? (
                <>
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--accent-light)" }}
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
    (s: any) => s.status === "generated"
  ).length;
  const errorCount = (submissions ?? []).filter(
    (s: any) => s.status === "error"
  ).length;
  const pendingCount = (submissions ?? []).filter(
    (s: any) => s.status === "pending"
  ).length;

  const handleSync = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      await syncNow({ connectionId: connection._id });
      toast.success("Sync complete");
    } catch (err: any) {
      const msg = err?.message ?? "Sync failed";
      if (
        msg.includes("token") ||
        msg.includes("Token") ||
        msg.includes("revoked")
      ) {
        setSyncError(
          "Sync failed — your Google token may have expired or been revoked. " +
            "Please disconnect and reconnect your Google account."
        );
      } else if (msg.includes("Template") || msg.includes("template")) {
        setSyncError(
          "Sync failed — the template file is missing or corrupt. " +
            "Please check your template in the editor."
        );
      } else if (msg.includes("403") || msg.includes("permission")) {
        setSyncError(
          "Sync failed — Google Forms access was denied. " +
            "Make sure you still own the form and it hasn't been restricted."
        );
      } else if (msg.includes("404") || msg.includes("not found")) {
        setSyncError(
          "Sync failed — the form could not be found. " +
            "It may have been deleted. Consider removing this connection."
        );
      } else {
        setSyncError(
          "Sync failed. Check your Google connection and try again."
        );
      }
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
          background: "var(--bg-card)",
          border: `1px solid ${connection.isActive ? "var(--accent-border)" : "var(--border-subtle)"}`,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
            style={{
              background: connection.isActive
                ? "var(--accent-bg)"
                : "var(--bg-input)",
              border: `1px solid ${connection.isActive ? "var(--accent-border)" : "var(--border-subtle)"}`,
            }}
          >
            📋
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: "var(--text)" }}
              >
                {connection.formTitle}
              </p>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  background: connection.isActive
                    ? "var(--success-bg)"
                    : "var(--bg-input)",
                  color: connection.isActive
                    ? "var(--success)"
                    : "var(--text-dim)",
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
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {connection.fieldMappings.length} field
                {connection.fieldMappings.length !== 1 ? "s" : ""} mapped
              </span>
              <span className="text-xs" style={{ color: "var(--success)" }}>
                {generatedCount} generated
              </span>
              {errorCount > 0 && (
                <span className="text-xs" style={{ color: "var(--danger)" }}>
                  {errorCount} errors
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-xs" style={{ color: "var(--warning)" }}>
                  {pendingCount} pending
                </span>
              )}
              {connection.lastPolledAt && (
                <span className="text-xs" style={{ color: "var(--text-dim)" }}>
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
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: `1px solid var(--border-subtle)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent-light)";
                e.currentTarget.style.borderColor = "var(--accent-border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
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
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: `1px solid var(--border-subtle)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--success)";
                e.currentTarget.style.borderColor =
                  "color-mix(in srgb, var(--success) 25%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
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
              background: "var(--accent-bg)",
              color: syncing ? "var(--text-dim)" : "var(--accent-light)",
              border: "1px solid var(--accent-border)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--accent-soft)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--accent-bg)")
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
                ? "var(--warning-bg)"
                : "var(--success-bg)",
              color: connection.isActive ? "var(--warning)" : "var(--success)",
              border: `1px solid ${
                connection.isActive
                  ? "color-mix(in srgb, var(--warning) 20%, transparent)"
                  : "color-mix(in srgb, var(--success) 20%, transparent)"
              }`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = connection.isActive
                ? "color-mix(in srgb, var(--warning) 18%, transparent)"
                : "color-mix(in srgb, var(--success) 18%, transparent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = connection.isActive
                ? "var(--warning-bg)"
                : "var(--success-bg)")
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
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-muted)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--bg-input)")
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
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {/* Field mappings */}
            <div className="space-y-2">
              <p
                className="text-xs font-semibold"
                style={{ color: "var(--text-secondary)" }}
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
                        background: "var(--bg-input)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {m.formQuestionTitle}
                    </code>
                    <span style={{ color: "var(--text-dim)" }}>→</span>
                    <code
                      className="px-2 py-1 rounded-lg font-mono text-[10px]"
                      style={{
                        background: "var(--accent-bg)",
                        color: "var(--accent-light)",
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
                  style={{ color: "var(--text-secondary)" }}
                >
                  Generated documents ({submissions.length})
                </p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {(submissions as any[]).map((s) => (
                    <div
                      key={s._id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{
                        background: "var(--bg-muted)",
                        border: `1px solid var(--border-subtle)`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background:
                            s.status === "generated"
                              ? "var(--success)"
                              : s.status === "error"
                                ? "var(--danger)"
                                : "var(--warning)",
                        }}
                      />
                      <span
                        className="flex-1 text-xs truncate"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {s.filename}.docx
                      </span>
                      {s.respondentEmail && (
                        <span
                          className="text-[10px] shrink-0 hidden sm:inline"
                          style={{ color: "var(--text-dim)" }}
                        >
                          {s.respondentEmail}
                        </span>
                      )}
                      <span
                        className="text-[10px] shrink-0"
                        style={{ color: "var(--text-dim)" }}
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
                            background: "var(--success-bg)",
                            color: "var(--success)",
                          }}
                        >
                          Download
                        </button>
                      )}
                      {s.status === "error" && (
                        <span
                          className="text-[9px] shrink-0"
                          style={{ color: "var(--danger)" }}
                          title={s.errorMessage}
                        >
                          Error ⚠
                        </span>
                      )}
                      {s.status === "pending" && (
                        <span
                          className="text-[9px] shrink-0"
                          style={{ color: "var(--warning)" }}
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
                color: "var(--danger)",
                border:
                  "1px solid color-mix(in srgb, var(--danger) 20%, transparent)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--danger-bg)")
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
    isLoaded && isSignedIn ? { id: templateId } : "skip"
  );
  const connections = useQuery(
    api.formConnections.getByTemplateId,
    isLoaded && isSignedIn ? { templateId } : "skip"
  );
  const googleAccount = useQuery(api.googleAccounts.getMyAccount);

  const [showWizard, setShowWizard] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    const p = searchParams.get("error");
    if (p === "google_oauth_denied")
      setGlobalError(
        "Google sign-in was cancelled. Please try again if you'd like to connect your account."
      );
    else if (p === "token_exchange_failed")
      setGlobalError(
        "Google authentication failed — the authorisation code may have expired. Please try connecting again."
      );
    else if (p === "oauth_state_invalid")
      setGlobalError(
        "Something went wrong during Google sign-in (invalid state). Please try again."
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
      <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent-light)" }}
          />
        </div>
      </div>
    );
  }

  if (template === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
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
            style={{ color: "var(--danger)" }}
          />
        </div>
        <div className="text-center">
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: "var(--text)" }}
          >
            Template not found
          </p>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            This template may have been deleted.
          </p>
        </div>
        <button
          onClick={() => router.push("/templates")}
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-secondary)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          Back to templates
        </button>
      </div>
    );
  }

  const isConnected = !!googleAccount;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      <div
        className="px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5 shrink-0"
        style={{ borderBottom: `1px solid var(--border-subtle)` }}
      >
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Link
            href="/templates"
            className="text-[11px] transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent-light)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            Templates
          </Link>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <Link
            href={`/templates/${templateId}/edit`}
            className="text-[11px] transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent-light)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            {template.name}
          </Link>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Connect Form
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-[15px] sm:text-base font-semibold"
              style={{ color: "var(--text)" }}
            >
              Google Form connections
            </h1>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Auto-generate documents when your Google Form receives a response.
            </p>
          </div>
          {isConnected && !showWizard && (
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0 min-h-[44px]"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-pale)",
                border: `1px solid var(--accent-border)`,
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-bg-hover)";
                e.currentTarget.style.boxShadow = "0 0 20px var(--accent-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--accent-bg)";
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
                background: "var(--bg-input)",
                border: `1px solid var(--border-subtle)`,
              }}
            >
              🔗
            </div>
            <div>
              <p
                className="text-sm font-semibold mb-2"
                style={{ color: "var(--text)" }}
              >
                Connect your Google account
              </p>
              <p
                className="text-xs max-w-xs leading-relaxed mx-auto"
                style={{ color: "var(--text-dim)" }}
              >
                Connect once, then paste any Google Form URL to link it.
                Responses automatically generate documents — no code needed.
              </p>
            </div>
            <button
              onClick={handleConnectGoogle}
              className="flex items-center gap-2 text-[13px] font-semibold px-5 py-3 rounded-xl transition-all duration-150 min-h-[44px]"
              style={{
                background: "var(--accent-strong-bg)",
                color: "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--accent-mid)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--accent-strong-bg)")
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
                    style={{ color: "var(--text)" }}
                  >
                    New connection
                  </h2>
                  <button
                    onClick={() => setShowWizard(false)}
                    className="text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
                    style={{
                      color: "var(--text-muted)",
                      border: `1px solid var(--border-subtle)`,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-muted)")
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
                style={{ border: `1px dashed var(--border-subtle)` }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: "var(--bg-muted)" }}
                >
                  <LinkIcon
                    className="w-5 h-5"
                    style={{ color: "var(--text-dim)" }}
                  />
                </div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  No connections yet
                </p>
                <p
                  className="text-xs mb-5 max-w-xs leading-relaxed"
                  style={{ color: "var(--text-dim)" }}
                >
                  Paste a Google Form URL to start generating documents
                  automatically from responses.
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
                  style={{
                    background: "var(--accent-bg)",
                    color: "var(--accent-pale)",
                    border: `1px solid var(--accent-border)`,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "var(--accent-bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--accent-bg)")
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
