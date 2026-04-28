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
  LogOutIcon,
  ExternalLinkIcon,
  InfoIcon,
  XIcon,
  AlertTriangleIcon,
  FileSpreadsheetIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  CheckIcon,
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

const NON_MAPPABLE_TYPES = ["loop", "condition", "condition_inverse"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractFormId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
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

// ── Custom Select ─────────────────────────────────────────────────────────────

function MappingSelect({
  value,
  onChange,
  questions,
  placeholder = "— not mapped —",
}: {
  value: string;
  onChange: (v: string) => void;
  questions: FormQuestion[];
  placeholder?: string;
}) {
  const isMapped = !!value;

  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl text-sm outline-none min-h-[44px] transition-all duration-150"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          paddingTop: "10px",
          paddingBottom: "10px",
          paddingLeft: "12px",
          paddingRight: "36px",
          background: isMapped
            ? "color-mix(in srgb, var(--accent) 6%, var(--bg-muted))"
            : "var(--bg-muted)",
          border: `1.5px solid ${isMapped ? "var(--accent-border)" : "var(--border-subtle)"}`,
          color: isMapped ? "var(--text)" : "var(--text-dim)",
          cursor: "pointer",
          lineHeight: "1.4",
        }}
        onFocus={(e) =>
          (e.currentTarget.style.border = `1.5px solid var(--accent-border)`)
        }
        onBlur={(e) =>
          (e.currentTarget.style.border = `1.5px solid ${
            isMapped ? "var(--accent-border)" : "var(--border-subtle)"
          }`)
        }
      >
        <option
          value=""
          style={{ background: "var(--popover)", color: "var(--text-dim)" }}
        >
          {placeholder}
        </option>
        {questions.map((q) => (
          <option
            key={q.id}
            value={q.title}
            style={{ background: "var(--popover)", color: "var(--text)" }}
          >
            {q.title}
          </option>
        ))}
      </select>

      <div
        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
        style={{ right: "12px" }}
      >
        {isMapped ? (
          <ChevronDownIcon
            className="w-3.5 h-3.5"
            style={{ color: "var(--accent-light)" }}
          />
        ) : (
          <ChevronDownIcon
            className="w-3.5 h-3.5"
            style={{ color: "var(--text-dim)" }}
          />
        )}
      </div>
    </div>
  );
}

// ── Google Account Badge ──────────────────────────────────────────────────────

function AccountBadge({
  email,
  clerkEmail,
  expiresAt,
  onDisconnect,
  onReconnect,
}: {
  email: string;
  clerkEmail?: string | null;
  expiresAt?: number;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const disconnect = useMutation(api.googleAccounts.disconnect);
  const deactivateAll = useMutation(api.formConnections.deactivateAllForOwner);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const emailMismatch = clerkEmail && email !== clerkEmail;

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
          Token auto-refreshes in the background. Only reconnect if you revoke
          access in Google Account settings.
        </p>

        {emailMismatch && (
          <WarningBanner
            message={`You are logged in as ${clerkEmail}, but the connected Google account is ${email}. This is okay if you intentionally use two different accounts.`}
          />
        )}
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

  // ── Step 1 ───────────────────────────────────────────────────────────────
  const [formInput, setFormInput] = useState("");
  const [formInputError, setFormInputError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selectedForm, setSelectedForm] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // ── Step 2 ───────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [questionIdMap, setQuestionIdMap] = useState<Record<string, string>>(
    {}
  );
  const [linkedSpreadsheetId, setLinkedSpreadsheetId] = useState<string | null>(
    null
  );
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [mappingError, setMappingError] = useState("");

  // ── Step 3 ───────────────────────────────────────────────────────────────
  const [filenamePattern, setFilenamePattern] = useState("");
  const [filenameError, setFilenameError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Browser detection (hanya untuk pesan informatif) ─────────────────────
  const [browserKind, setBrowserKind] = useState<
    "detecting" | "supported" | "firefox" | "brave"
  >("detecting");

  useEffect(() => {
    const detect = async () => {
      const ua = navigator.userAgent;
      if (ua.includes("Firefox")) {
        setBrowserKind("firefox");
        return;
      }
      if (ua.includes("Brave")) {
        setBrowserKind("brave");
        return;
      }
      try {
        if ((navigator as any).brave?.isBrave) {
          const isBrave = await (navigator as any).brave.isBrave();
          if (isBrave) {
            setBrowserKind("brave");
            return;
          }
        }
      } catch {}
      setBrowserKind("supported");
    };
    detect();
  }, []);

  const ILLEGAL_CHARS = /[<>:"/\\|?*]/;
  const mappableFields = templateFields.filter(
    (f) => !NON_MAPPABLE_TYPES.includes(f.type)
  );

  // ── Core load logic ───────────────────────────────────────────────────────
  const handleLoadFormById = useCallback(async (formId: string) => {
    setFormInputError("");
    setFormLoading(true);
    try {
      const res = await fetch(`/api/google/forms/${formId}/questions`);

      if (!res.ok) {
        let data: { error?: string; code?: string } = {};
        try {
          data = await res.json();
        } catch {}

        if (res.status === 401) {
          const isRevoked = data.code === "token_revoked";
          setFormInputError(
            isRevoked
              ? "Your Google access has been revoked. Please disconnect and reconnect your account."
              : (data.error ??
                  "Your Google session has expired. Please disconnect and reconnect your account.")
          );
        } else if (res.status === 403) {
          setFormInputError(
            data.error ??
              "You don't have permission to access this form. Make sure you're signed in with the Google account that owns the form."
          );
        } else if (res.status === 404) {
          setFormInputError(
            data.error ??
              "Form not found. Double-check the URL or ID — the form may have been deleted or moved."
          );
        } else if (res.status === 503) {
          setFormInputError(
            data.error ??
              "Could not reach Google. Check your internet connection and try again."
          );
        } else if (res.status >= 500) {
          setFormInputError(
            "Google Forms is temporarily unavailable. Please wait a moment and try again."
          );
        } else {
          setFormInputError(
            data.error ??
              "Failed to load the form. Check your connection and try again."
          );
        }
        return;
      }

      const data = await res.json();
      const formName: string = data.formTitle ?? "Untitled Form";
      setSelectedForm({ id: formId, name: formName });

      const qs: FormQuestion[] = data.questions ?? [];
      setQuestions(qs);
      setQuestionIdMap(data.questionIdMap ?? {});
      if (data.spreadsheetId) setLinkedSpreadsheetId(data.spreadsheetId);

      if (qs.length === 0) {
        setFormInputError(
          "This form has no questions that can be mapped. Make sure your form has at least one question before connecting it."
        );
        setSelectedForm(null);
        return;
      }

      setStep(2);
    } catch (err) {
      const isOffline = !navigator.onLine;
      setFormInputError(
        isOffline
          ? "You appear to be offline. Check your internet connection and try again."
          : "Could not reach Google Forms. Check your internet connection and try again."
      );
      console.error("[handleLoadFormById]", err);
    } finally {
      setFormLoading(false);
    }
  }, []);

  // ── Wrapper for manual input ──────────────────────────────────────────────
  const handleLoadForm = useCallback(async () => {
    const formId = extractFormId(formInput);
    if (!formId) {
      setFormInputError(
        "Couldn't recognise a valid Form ID. Paste the full Google Forms URL (e.g. https://docs.google.com/forms/d/…/edit) or just the ID part."
      );
      return;
    }
    await handleLoadFormById(formId);
  }, [formInput, handleLoadFormById]);

  // ── Google Drive Picker (dengan scroll fix + error handling profesional) ──
  const openPicker = useCallback(async () => {
    setPickerLoading(true);
    setFormInputError("");
    try {
      const tokenRes = await fetch("/api/google/picker-token");
      if (!tokenRes.ok) {
        const data = await tokenRes.json().catch(() => ({}));
        setFormInputError(
          data.error ?? "Failed to get Google token. Please try again."
        );
        return;
      }
      const { accessToken } = await tokenRes.json();

      // Muat gapi
      await new Promise<void>((resolve, reject) => {
        if ((window as any).gapi) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("gapi_load_failed"));
        document.body.appendChild(script);
      });

      await new Promise<void>((resolve) =>
        (window as any).gapi.load("picker", () => resolve())
      );

      const google = (window as any).google;
      const picker = new google.picker.PickerBuilder()
        .addView(
          new google.picker.DocsView()
            .setMimeTypes("application/vnd.google-apps.form")
            .setMode(google.picker.DocsViewMode.LIST)
        )
        .setOAuthToken(accessToken)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!)
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            setFormInput(doc.id);
            handleLoadFormById(doc.id);
          }
        })
        .build();

      // 🚀 PENTING: scroll ke atas agar dialog muncul di tengah viewport
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      // Delay kecil untuk memastikan rendering selesai
      setTimeout(() => {
        picker.setVisible(true);
      }, 100);
    } catch (err: unknown) {
      const isBlocked =
        err instanceof Error &&
        (err.message === "gapi_load_failed" ||
          err.name === "AbortError" ||
          String(err).includes("Failed to fetch") ||
          String(err).includes("NetworkError"));

      if (isBlocked) {
        setFormInputError(
          "It looks like your browser's tracking protection prevented the Google Drive Picker from opening. You can disable the shield for this site and try again, or simply paste the form URL below."
        );
      } else {
        setFormInputError(
          "Failed to open Google Drive Picker. Please paste the Form URL manually below."
        );
      }
      console.error("[openPicker]", err);
    } finally {
      setPickerLoading(false);
    }
  }, [handleLoadFormById]);

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
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create connection. Please try again.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const mappedCount = Object.values(mappings).filter(Boolean).length;

  const isPrivacyBrowser = browserKind === "firefox" || browserKind === "brave";

  const STEPS = [
    { n: 1, label: "Select form" },
    { n: 2, label: "Map fields" },
    { n: 3, label: "Filename" },
  ];

  return (
    <div className="space-y-5">
      <StepIndicator step={step} steps={STEPS} />

      {/* ── Step 1 ────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Info banner untuk Firefox/Brave */}
          {isPrivacyBrowser && (
            <div
              className="rounded-xl p-3 flex items-start gap-3"
              style={{
                background:
                  "color-mix(in srgb, var(--accent-bg) 40%, transparent)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <span className="text-lg shrink-0" style={{ lineHeight: 1 }}>
                {browserKind === "brave" ? "🦁" : "🦊"}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  {browserKind === "brave"
                    ? "Brave Shields detected"
                    : "Firefox Tracking Protection detected"}
                </p>
                <p
                  className="text-[11px] leading-relaxed mt-0.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  {browserKind === "brave"
                    ? "Brave's Shields may prevent the Google Drive Picker from opening. If you encounter an error, try disabling Shields for this site, or use the manual paste option below."
                    : "Firefox's Enhanced Tracking Protection may block the Drive Picker popup. If it doesn't open, you can disable protection for this site or paste the form URL below."}
                </p>
              </div>
            </div>
          )}

          {/* UI Utama */}
          <div className="space-y-4">
            <div>
              <h3
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--text)" }}
              >
                Select your Google Form
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Pick directly from your Drive, or paste the form URL / ID below.
              </p>
            </div>

            {/* Drive Picker button */}
            <button
              onClick={openPicker}
              disabled={
                pickerLoading || formLoading || browserKind === "detecting"
              }
              className="w-full flex items-center justify-center gap-2 text-[13px] font-semibold px-4 py-3 rounded-xl min-h-[48px] transition-all duration-150"
              style={{
                background:
                  pickerLoading || formLoading
                    ? "var(--bg-input)"
                    : "var(--accent-strong-bg)",
                color:
                  pickerLoading || formLoading
                    ? "var(--text-dim)"
                    : "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
              }}
              onMouseEnter={(e) => {
                if (!pickerLoading && !formLoading)
                  e.currentTarget.style.background = "var(--accent-mid)";
              }}
              onMouseLeave={(e) => {
                if (!pickerLoading && !formLoading)
                  e.currentTarget.style.background = "var(--accent-strong-bg)";
              }}
            >
              {pickerLoading ? (
                <>
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--accent-light)" }}
                  />
                  Opening Drive…
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 87.3 78"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
                      fill="#0066da"
                    />
                    <path
                      d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
                      fill="#00ac47"
                    />
                    <path
                      d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
                      fill="#ea4335"
                    />
                    <path
                      d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
                      fill="#00832d"
                    />
                    <path
                      d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
                      fill="#2684fc"
                    />
                    <path
                      d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
                      fill="#ffba00"
                    />
                  </svg>
                  Choose from Google Drive
                </>
              )}
            </button>

            <p
              className="text-[10px] text-center"
              style={{ color: "var(--text-dim)" }}
            >
              Works best on Chrome &amp; Edge
            </p>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div
                className="flex-1 h-px"
                style={{ background: "var(--border-subtle)" }}
              />
              <span
                className="text-[11px]"
                style={{ color: "var(--text-dim)" }}
              >
                or paste manually
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: "var(--border-subtle)" }}
              />
            </div>

            {/* Manual input */}
            <div className="space-y-2">
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
                  disabled={formLoading || pickerLoading}
                />
                <button
                  onClick={handleLoadForm}
                  disabled={formLoading || pickerLoading || !formInput.trim()}
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

            {/* How-to guide */}
            <div
              className="rounded-xl p-3 space-y-2"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-dim)" }}
              >
                How to find your form URL
              </p>
              <div className="space-y-2">
                {[
                  { n: "1", text: "Go to forms.google.com" },
                  { n: "2", text: "Open the form you want to connect" },
                  {
                    n: "3",
                    text: 'Click the ✏️ edit button — the URL should contain "/edit"',
                  },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                      style={{
                        background: "var(--accent-bg)",
                        color: "var(--accent-light)",
                        border: "1px solid var(--accent-border)",
                      }}
                    >
                      {n}
                    </span>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <a
              href="https://forms.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[12px] font-medium transition-colors w-fit"
              style={{ color: "var(--accent-light)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--accent-pale)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--accent-light)")
              }
            >
              <ExternalLinkIcon className="w-3 h-3" />
              Open Google Forms in a new tab
            </a>

            <InfoBox>
              <span style={{ color: "var(--accent-light)" }}>
                Access requirement:
              </span>{" "}
              You must be the <strong>owner</strong> of the form. Forms shared
              with you (view-only) may not be accessible due to Google API
              restrictions.
            </InfoBox>
          </div>
        </div>
      )}

      {/* ── Step 2: Field mapping ─────────────────────────────────────────── */}
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
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium truncate max-w-[180px]"
                  style={{
                    background: "var(--success-bg)",
                    color: "var(--success)",
                  }}
                  title={selectedForm.name}
                >
                  {selectedForm.name}
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Match each template field to the Google Form question that
              provides its value. Loop and condition fields are template logic —
              they can&apos;t be mapped from form answers.
            </p>
          </div>

          {mappingError && (
            <ErrorBanner
              message={mappingError}
              onDismiss={() => setMappingError("")}
            />
          )}

          {/* Progress bar */}
          {mappableFields.length > 0 && (
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--bg-input)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(mappedCount / mappableFields.length) * 100}%`,
                    background:
                      mappedCount === mappableFields.length
                        ? "var(--success)"
                        : "var(--accent-light)",
                  }}
                />
              </div>
              <span
                className="text-[11px] font-medium shrink-0"
                style={{
                  color:
                    mappedCount === mappableFields.length
                      ? "var(--success)"
                      : "var(--text-dim)",
                }}
              >
                {mappedCount}/{mappableFields.length} mapped
              </span>
            </div>
          )}

          {mappableFields.length > 0 ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-card)",
              }}
            >
              {mappableFields.map((field, idx) => {
                const c = fieldTypeColors[field.type] ?? "var(--text-muted)";
                const isMapped = !!mappings[field.name];
                const isLast = idx === mappableFields.length - 1;

                return (
                  <div
                    key={field.name}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3"
                    style={{
                      borderBottom: isLast
                        ? "none"
                        : "1px solid var(--border-subtle)",
                      background: isMapped
                        ? "color-mix(in srgb, var(--accent) 3%, transparent)"
                        : "transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {/* Field label + token */}
                    <div className="flex items-center gap-2.5 sm:w-40 sm:shrink-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: c }}
                      />
                      <div className="min-w-0">
                        <p
                          className="text-xs font-semibold leading-tight"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {field.label}
                        </p>
                        <code
                          className="text-[10px] font-mono"
                          style={{ color: "var(--text-dim)" }}
                        >
                          {`{{${field.name}}}`}
                        </code>
                      </div>
                    </div>

                    {/* Arrow separator (desktop only) */}
                    <span
                      className="hidden sm:flex items-center shrink-0"
                      style={{ color: "var(--border-subtle)" }}
                    >
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </span>

                    {/* Question select */}
                    <div className="flex-1 min-w-0">
                      <MappingSelect
                        value={mappings[field.name] ?? ""}
                        onChange={(v) =>
                          setMappings((prev) => ({ ...prev, [field.name]: v }))
                        }
                        questions={questions}
                      />
                    </div>

                    {/* Mapped checkmark indicator (desktop only) */}
                    <div
                      className="hidden sm:flex items-center justify-center w-5 h-5 rounded-full shrink-0 transition-all duration-200"
                      style={{
                        background: isMapped
                          ? "var(--success-bg)"
                          : "transparent",
                        border: isMapped
                          ? "1px solid color-mix(in srgb, var(--success) 30%, transparent)"
                          : "1px solid transparent",
                      }}
                    >
                      {isMapped && (
                        <CheckIcon
                          className="w-2.5 h-2.5"
                          style={{ color: "var(--success)" }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Empty state — template has no mappable fields
            <div
              className="flex flex-col items-center justify-center py-10 rounded-xl text-center"
              style={{ border: "1px dashed var(--border-subtle)" }}
            >
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                No mappable fields in this template.
              </p>
              <p
                className="text-[11px] mt-1"
                style={{ color: "var(--text-dim)" }}
              >
                Loops and conditions are handled automatically.
              </p>
            </div>
          )}

          {/* Step 2 nav buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setStep(1);
                setMappingError("");
              }}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                (e.currentTarget.style.background = "var(--bg-input)")
              }
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
                (e.currentTarget.style.background = "var(--bg-muted)")
              }
            >
              ← Back
            </button>
            <button
              onClick={() => {
                const validMappings = Object.values(mappings).filter(Boolean);
                if (validMappings.length === 0 && mappableFields.length > 0) {
                  setMappingError(
                    "Please map at least one template field to a Google Form question."
                  );
                  return;
                }
                setMappingError("");
                setStep(3);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium py-2 rounded-xl min-h-[44px] transition-all duration-150"
              style={{
                background: "var(--accent-strong-bg)",
                color: "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                (e.currentTarget.style.background = "var(--accent-mid)")
              }
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
                (e.currentTarget.style.background = "var(--accent-strong-bg)")
              }
            >
              Next: Filename →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Filename pattern ──────────────────────────────────────── */}
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
            {/* Filename input */}
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

            {/* Insertable token chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                "{{row_number}}",
                ...Object.keys(mappings)
                  .filter((k) => mappings[k])
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
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                    (e.currentTarget.style.background = "var(--accent-soft)")
                  }
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
                    (e.currentTarget.style.background = "var(--accent-bg)")
                  }
                >
                  {token}
                </button>
              ))}
            </div>

            {/* Linked spreadsheet notice */}
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

          {/* Step 3 nav buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                (e.currentTarget.style.background = "var(--bg-input)")
              }
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
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
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                if (!saving)
                  e.currentTarget.style.background = "var(--accent-mid)";
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
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
      const msg: string = err?.message ?? "";
      if (/token|revoked/i.test(msg)) {
        setSyncError(
          "Sync failed — your Google token may have expired or been revoked. " +
            "Please disconnect and reconnect your Google account."
        );
      } else if (/template/i.test(msg)) {
        setSyncError(
          "Sync failed — the template file is missing or corrupt. " +
            "Please check your template in the editor."
        );
      } else if (/403|permission/i.test(msg)) {
        setSyncError(
          "Sync failed — Google Forms access was denied. Make sure you still own " +
            "the form and it hasn't been restricted."
        );
      } else if (/404|not found/i.test(msg)) {
        setSyncError(
          "Sync failed — the form could not be found. It may have been deleted. " +
            "Consider removing this connection."
        );
      } else if (/offline|network|fetch/i.test(msg) || !navigator.onLine) {
        setSyncError(
          "Sync failed — you appear to be offline. Check your internet connection."
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
    } catch {
      toast.error("Failed to update connection. Please try again.");
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
          border: `1px solid ${
            connection.isActive
              ? "var(--accent-border)"
              : "var(--border-subtle)"
          }`,
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
              border: `1px solid ${
                connection.isActive
                  ? "var(--accent-border)"
                  : "var(--border-subtle)"
              }`,
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
              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.color = "var(--accent-light)";
                e.currentTarget.style.borderColor = "var(--accent-border)";
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
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
              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.color = "var(--success)";
                e.currentTarget.style.borderColor =
                  "color-mix(in srgb, var(--success) 25%, transparent)";
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
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
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
              (e.currentTarget.style.background = "var(--accent-soft)")
            }
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
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
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
              (e.currentTarget.style.background = connection.isActive
                ? "color-mix(in srgb, var(--warning) 18%, transparent)"
                : "color-mix(in srgb, var(--success) 18%, transparent)")
            }
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
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
              background: expanded ? "var(--bg-muted)" : "var(--bg-input)",
              color: "var(--text-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
              (e.currentTarget.style.background = "var(--bg-muted)")
            }
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
              (e.currentTarget.style.background = expanded
                ? "var(--bg-muted)"
                : "var(--bg-input)")
            }
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </div>

        {syncError && (
          <div className="px-4 pb-4">
            <ErrorBanner
              message={syncError}
              onDismiss={() => setSyncError("")}
              onRetry={handleSync}
            />
          </div>
        )}

        {expanded && (
          <div
            className="border-t p-4 space-y-5"
            style={{ borderColor: "var(--border-subtle)" }}
          >
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

            <button
              onClick={() => setConfirmRemove(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
              style={{
                color: "var(--danger)",
                border:
                  "1px solid color-mix(in srgb, var(--danger) 20%, transparent)",
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                (e.currentTarget.style.background = "var(--danger-bg)")
              }
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
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
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) =>
              (e.currentTarget.style.color = "var(--accent-light)")
            }
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) =>
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
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) =>
              (e.currentTarget.style.color = "var(--accent-light)")
            }
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) =>
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
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.background = "var(--accent-bg-hover)";
                e.currentTarget.style.boxShadow = "0 0 20px var(--accent-bg)";
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
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
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                (e.currentTarget.style.background = "var(--accent-mid)")
              }
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
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
              clerkEmail={googleAccount.clerkEmail}
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
                    onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                      (e.currentTarget.style.background = "var(--bg-muted)")
                    }
                    onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
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
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                    (e.currentTarget.style.background =
                      "var(--accent-bg-hover)")
                  }
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
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
