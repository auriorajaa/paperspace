// app\(main)\forms\[formId]\connect-template\connect-template-client.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  PlusIcon,
  ArrowRightIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  ZapIcon,
  PlayIcon,
  PauseIcon,
  Trash2Icon,
  ChevronDownIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
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

const NON_MAPPABLE_TYPES = ["loop", "condition", "condition_inverse"];

// ── Shared banner components ──────────────────────────────────────────────────

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
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
      <p
        className="text-xs flex-1 leading-relaxed"
        style={{ color: "var(--danger)" }}
      >
        {message}
      </p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ color: "var(--danger)" }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function WarningBanner({ message }: { message: string }) {
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
    </div>
  );
}

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

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({
  step,
  steps,
}: {
  step: number;
  steps: { n: number; label: string }[];
}) {
  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none" }}
    >
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

// ── Connection card ───────────────────────────────────────────────────────────

function TemplateConnectionCard({
  connection,
  allTemplates,
}: {
  connection: any;
  allTemplates: any[];
}) {
  const updateConnection = useMutation(api.formConnections.update);
  const removeConnection = useMutation(api.formConnections.remove);

  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const linkedTemplate = allTemplates.find(
    (t) => t._id === connection.templateId
  );

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
          border: `1px solid ${connection.isActive ? "var(--accent-border)" : "var(--border-subtle)"}`,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: connection.isActive
                ? "rgba(99,102,241,0.15)"
                : "var(--bg-input)",
              border: `1px solid ${connection.isActive ? "rgba(99,102,241,0.25)" : "var(--border-subtle)"}`,
            }}
          >
            <LayoutTemplateIcon
              className="w-4 h-4"
              style={{
                color: connection.isActive
                  ? "var(--accent-light)"
                  : "var(--text-dim)",
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: "var(--text)" }}
              >
                {connection.templateName ?? "Unknown template"}
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
              >
                {connection.isActive ? "active" : "paused"}
              </span>
              {connection.templateDeleted && (
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                  }}
                >
                  template deleted
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {connection.fieldMappings.length} field
                {connection.fieldMappings.length !== 1 ? "s" : ""} mapped
              </span>
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                Generates on each form submission
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
          {linkedTemplate && (
            <Link
              href={`/templates/${linkedTemplate._id}/fill`}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.color = "var(--accent-light)";
                e.currentTarget.style.borderColor = "var(--accent-border)";
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
              }}
            >
              <LayoutTemplateIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Use template</span>
            </Link>
          )}

          <div className="flex-1" />

          <button
            onClick={handleToggleActive}
            disabled={toggling || !!connection.templateDeleted}
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
              opacity: connection.templateDeleted ? 0.5 : 1,
            }}
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
              border: "1px solid var(--border-subtle)",
            }}
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </div>

        {connection.templateDeleted && (
          <div className="px-4 pb-4">
            <WarningBanner message="The template linked to this connection has been deleted. Auto-generation is paused. Remove this connection and create a new one with an active template." />
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

            <div>
              <p
                className="text-xs font-semibold mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Filename pattern
              </p>
              <code
                className="text-[11px] font-mono px-2 py-1 rounded-lg"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-muted)",
                }}
              >
                {connection.filenamePattern || "document_{{row_number}}"}
              </code>
            </div>

            <button
              onClick={() => setConfirmRemove(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px]"
              style={{
                color: "var(--danger)",
                border:
                  "1px solid color-mix(in srgb, var(--danger) 20%, transparent)",
              }}
              onMouseEnter={(e: any) =>
                (e.currentTarget.style.background = "var(--danger-bg)")
              }
              onMouseLeave={(e: any) =>
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
              The connection to &ldquo;
              {connection.templateName ?? "this template"}&rdquo; will be
              removed. Existing generated documents will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemoveConfirmed}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────

function ConnectTemplateWizard({
  formId,
  formTitle,
  formQuestions,
  templates,
  existingConnections,
  onDone,
}: {
  formId: Id<"internalForms">;
  formTitle: string;
  formQuestions: any[];
  templates: any[];
  existingConnections: any[];
  onDone: () => void;
}) {
  const createConnection = useMutation(api.formConnections.create);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<Id<"templates"> | null>(null);

  // Step 2
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [mappingError, setMappingError] = useState("");

  // Step 3
  const [filenamePattern, setFilenamePattern] = useState("");
  const [filenameError, setFilenameError] = useState("");
  const [saving, setSaving] = useState(false);

  const alreadyConnectedTemplateIds = useMemo(
    () => new Set(existingConnections.map((c: any) => c.templateId)),
    [existingConnections]
  );

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);
  const templateFields = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.fields.filter(
      (f: any) => !NON_MAPPABLE_TYPES.includes(f.type)
    );
  }, [selectedTemplate]);

  const mappedCount = Object.values(mappings).filter(Boolean).length;
  const ILLEGAL_CHARS = /[<>:"/\\|?*]/;

  const STEPS = [
    { n: 1, label: "Select template" },
    { n: 2, label: "Map fields" },
    { n: 3, label: "Filename" },
  ];

  const handleCreate = async () => {
    const validMappings = Object.entries(mappings)
      .filter(([, questionId]) => questionId)
      .map(([templateFieldName, questionId]) => {
        const q = formQuestions.find((f: any) => f.id === questionId);
        return {
          formQuestionTitle: q?.title ?? questionId,
          templateFieldName,
          sourceQuestionId: questionId,
        };
      });

    if (validMappings.length === 0 && templateFields.length > 0) {
      toast.error("Please map at least one template field to a form question");
      return;
    }

    const pattern = filenamePattern.trim() || "document_{{row_number}}";
    const cleanedPattern = pattern.replace(/{{.*?}}/g, "");
    if (ILLEGAL_CHARS.test(cleanedPattern)) {
      setFilenameError(
        'Filename cannot contain special characters: < > : " / \\ | ? *'
      );
      return;
    }
    setFilenameError("");

    if (!selectedTemplate) return;
    setSaving(true);
    try {
      await createConnection({
        templateId: selectedTemplateId!,
        formId: formId as string,
        formTitle,
        fieldMappings: validMappings,
        filenamePattern: pattern,
        connectionType: "internal",
        internalFormId: formId,
      });
      toast.success(
        "Template connected — documents will generate on each submission"
      );
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create connection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <StepIndicator step={step} steps={STEPS} />

      {/* ── Step 1: Select template ───────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--text)" }}
            >
              Select a template
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              A document will be generated using this template on each new form
              response.
            </p>
          </div>

          {templates.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 rounded-xl text-center"
              style={{ border: "1px dashed var(--border-subtle)" }}
            >
              <LayoutTemplateIcon
                className="w-8 h-8 mb-3"
                style={{ color: "var(--text-dim)" }}
              />
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                No templates yet
              </p>
              <p
                className="text-xs mb-4 max-w-xs"
                style={{ color: "var(--text-dim)" }}
              >
                Upload a .docx file with placeholders to create a template
                first.
              </p>
              <Link
                href="/templates/new"
                className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl min-h-[44px]"
                style={{
                  background: "var(--accent-strong-bg)",
                  color: "var(--accent-pale)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Create a template
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {templates.map((t: any) => {
                const connected = alreadyConnectedTemplateIds.has(t._id);
                return (
                  <button
                    key={t._id}
                    onClick={() => {
                      if (connected) {
                        toast.error(
                          "This template is already connected to this form"
                        );
                        return;
                      }
                      setSelectedTemplateId(t._id);
                      setMappings({});
                      setStep(2);
                    }}
                    disabled={connected}
                    className="w-full text-left rounded-xl px-4 py-3 transition-all flex items-center gap-3"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      opacity: connected ? 0.5 : 1,
                      cursor: connected ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={(e: any) => {
                      if (!connected)
                        e.currentTarget.style.borderColor =
                          "var(--accent-border)";
                    }}
                    onMouseLeave={(e: any) => {
                      if (!connected)
                        e.currentTarget.style.borderColor =
                          "var(--border-subtle)";
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: connected
                          ? "var(--bg-input)"
                          : "rgba(99,102,241,0.12)",
                        border: "1px solid rgba(99,102,241,0.2)",
                      }}
                    >
                      <LayoutTemplateIcon
                        className="w-3.5 h-3.5"
                        style={{
                          color: connected
                            ? "var(--text-dim)"
                            : "var(--accent-light)",
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {t.name}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {t.fields?.length ?? 0} field
                        {(t.fields?.length ?? 0) !== 1 ? "s" : ""}
                        {connected ? " · Already connected" : ""}
                      </p>
                    </div>
                    {!connected ? (
                      <ArrowRightIcon
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--text-dim)" }}
                      />
                    ) : (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                        style={{
                          background: "var(--success-bg)",
                          color: "var(--success)",
                        }}
                      >
                        connected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <InfoBox>
            <span style={{ color: "var(--accent-light)" }}>How it works:</span>{" "}
            Form answers are mapped to template fields and a document is
            generated instantly the moment someone submits this form.
          </InfoBox>
        </div>
      )}

      {/* ── Step 2: Map fields ────────────────────────────────────────────── */}
      {step === 2 && selectedTemplate && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                Map fields
              </h3>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium truncate max-w-[180px]"
                style={{
                  background: "var(--success-bg)",
                  color: "var(--success)",
                }}
                title={selectedTemplate.name}
              >
                {selectedTemplate.name}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Match each template field to the form question that fills it. Loop
              and condition fields are template logic and can&apos;t be mapped
              from answers.
            </p>
          </div>

          {mappingError && (
            <ErrorBanner
              message={mappingError}
              onDismiss={() => setMappingError("")}
            />
          )}

          {/* Progress bar */}
          {templateFields.length > 0 && (
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--bg-input)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(mappedCount / templateFields.length) * 100}%`,
                    background:
                      mappedCount === templateFields.length
                        ? "var(--success)"
                        : "var(--accent-light)",
                  }}
                />
              </div>
              <span
                className="text-[11px] font-medium shrink-0"
                style={{
                  color:
                    mappedCount === templateFields.length
                      ? "var(--success)"
                      : "var(--text-dim)",
                }}
              >
                {mappedCount}/{templateFields.length} mapped
              </span>
            </div>
          )}

          {templateFields.length > 0 ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-card)",
              }}
            >
              {templateFields.map((field: any, idx: number) => {
                const isMapped = !!mappings[field.name];
                const isLast = idx === templateFields.length - 1;
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
                    <div className="flex items-center gap-2.5 sm:w-40 sm:shrink-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background: isMapped
                            ? "var(--success)"
                            : "var(--text-dim)",
                        }}
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

                    <span
                      className="hidden sm:flex items-center shrink-0"
                      style={{ color: "var(--border-subtle)" }}
                    >
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </span>

                    <div className="relative flex-1 min-w-0">
                      <select
                        value={mappings[field.name] ?? ""}
                        onChange={(e) =>
                          setMappings((prev) => ({
                            ...prev,
                            [field.name]: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl text-sm outline-none min-h-[44px] transition-all duration-150"
                        style={{
                          appearance: "none",
                          WebkitAppearance: "none",
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
                        }}
                      >
                        <option
                          value=""
                          style={{
                            background: "var(--popover)",
                            color: "var(--text-dim)",
                          }}
                        >
                          — not mapped —
                        </option>
                        {formQuestions.map((q: any) => (
                          <option
                            key={q.id}
                            value={q.id}
                            style={{
                              background: "var(--popover)",
                              color: "var(--text)",
                            }}
                          >
                            {q.title}
                          </option>
                        ))}
                      </select>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ right: "12px" }}
                      >
                        <ChevronDownIcon
                          className="w-3.5 h-3.5"
                          style={{
                            color: isMapped
                              ? "var(--accent-light)"
                              : "var(--text-dim)",
                          }}
                        />
                      </div>
                    </div>

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
              onMouseEnter={(e: any) =>
                (e.currentTarget.style.background = "var(--bg-input)")
              }
              onMouseLeave={(e: any) =>
                (e.currentTarget.style.background = "var(--bg-muted)")
              }
            >
              ← Back
            </button>
            <button
              onClick={() => {
                if (mappedCount === 0 && templateFields.length > 0) {
                  setMappingError(
                    "Please map at least one template field to a form question."
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
              onMouseEnter={(e: any) =>
                (e.currentTarget.style.background = "var(--accent-mid)")
              }
              onMouseLeave={(e: any) =>
                (e.currentTarget.style.background = "var(--accent-strong-bg)")
              }
            >
              Next: Filename →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Filename ──────────────────────────────────────────────── */}
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
              placeholder={`${selectedTemplate?.name ?? "document"}_{{row_number}}`}
              className="w-full rounded-xl px-3 py-3 text-sm font-mono outline-none min-h-[44px]"
              style={{
                background: "var(--bg-muted)",
                border: `1px solid ${filenameError ? "color-mix(in srgb, var(--danger) 40%, transparent)" : "var(--border-subtle)"}`,
                color: "var(--text)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border =
                  "1px solid var(--accent-border)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.border = `1px solid ${filenameError ? "color-mix(in srgb, var(--danger) 40%, transparent)" : "var(--border-subtle)"}`)
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
                  onMouseEnter={(e: any) =>
                    (e.currentTarget.style.background = "var(--accent-soft)")
                  }
                  onMouseLeave={(e: any) =>
                    (e.currentTarget.style.background = "var(--accent-bg)")
                  }
                >
                  {token}
                </button>
              ))}
            </div>

            <InfoBox>
              <span style={{ color: "var(--accent-light)" }}>
                ⚡ Instant generation.
              </span>{" "}
              Documents are generated the moment this form is submitted — no
              polling or waiting. You can view generated documents from the
              responses page.
            </InfoBox>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e: any) =>
                (e.currentTarget.style.background = "var(--bg-input)")
              }
              onMouseLeave={(e: any) =>
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
              onMouseEnter={(e: any) => {
                if (!saving)
                  e.currentTarget.style.background = "var(--accent-mid)";
              }}
              onMouseLeave={(e: any) => {
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
                  Connecting…
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConnectTemplateClient() {
  const params = useParams();
  const formId = params.formId as Id<"internalForms">;
  const { isLoaded, isSignedIn } = useAuth();

  const ready = isLoaded && isSignedIn && !!formId;

  const form = useQuery(
    api.internalForms.getById,
    ready ? { id: formId } : "skip"
  );
  const templates = useQuery(api.templates.getAll, ready ? {} : "skip");
  const existingConnections = useQuery(
    api.formConnections.getByInternalFormId,
    ready ? { internalFormId: formId } : "skip"
  );

  const [showWizard, setShowWizard] = useState(false);

  const formQuestions = useMemo(() => {
    if (!form) return [];
    return form.schema.map((q: any) => ({ id: q.id, title: q.title }));
  }, [form]);

  const loading =
    form === undefined ||
    templates === undefined ||
    existingConnections === undefined;

  if (loading) {
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

  if (form === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border-subtle)",
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
            Form not found
          </p>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            This form may have been deleted.
          </p>
        </div>
        <Link
          href="/forms"
          className="text-[13px] font-medium px-4 py-2 rounded-xl"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          Back to forms
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <div
        className="px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Link
            href="/forms"
            className="text-[11px] transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            Forms
          </Link>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <Link
            href={`/forms/${formId}/builder`}
            className="text-[11px] transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            {form.title}
          </Link>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Connect Template
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-[15px] sm:text-base font-semibold"
              style={{ color: "var(--text)" }}
            >
              Template connections
            </h1>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Auto-generate documents when this form receives a response.
            </p>
          </div>
          {!showWizard && (
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0 min-h-[44px]"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.background = "var(--accent-bg-hover)";
                e.currentTarget.style.boxShadow = "0 0 20px var(--accent-bg)";
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.background = "var(--accent-bg)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Connect template
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-xl space-y-5">
          {/* How it works — shown when no connections and wizard is closed */}
          {existingConnections.length === 0 && !showWizard && (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.2)",
                  }}
                >
                  <LayoutTemplateIcon
                    className="w-4 h-4"
                    style={{ color: "var(--accent-light)" }}
                  />
                </div>
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    Auto-fill documents from responses
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Connect any number of templates to this form.
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                {[
                  {
                    n: "1",
                    text: "Choose a template (.docx with {{placeholders}})",
                  },
                  {
                    n: "2",
                    text: "Map each template field to a form question",
                  },
                  {
                    n: "3",
                    text: "Documents generate the moment the form is submitted",
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
          )}

          {/* Wizard */}
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
                    border: "1px solid var(--border-subtle)",
                  }}
                  onMouseEnter={(e: any) =>
                    (e.currentTarget.style.background = "var(--bg-muted)")
                  }
                  onMouseLeave={(e: any) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  Cancel
                </button>
              </div>
              <ConnectTemplateWizard
                formId={formId}
                formTitle={form.title}
                formQuestions={formQuestions}
                templates={templates ?? []}
                existingConnections={existingConnections}
                onDone={() => setShowWizard(false)}
              />
            </div>
          ) : existingConnections.length === 0 ? (
            /* Empty state */
            <div
              className="flex flex-col items-center justify-center py-16 text-center rounded-2xl"
              style={{ border: "1px dashed var(--border-subtle)" }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: "var(--bg-muted)" }}
              >
                <LayoutTemplateIcon
                  className="w-5 h-5"
                  style={{ color: "var(--text-dim)" }}
                />
              </div>
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                No templates connected
              </p>
              <p
                className="text-xs mb-5 max-w-xs leading-relaxed"
                style={{ color: "var(--text-dim)" }}
              >
                Connect a template to start generating documents automatically
                on every submission.
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all duration-150"
                style={{
                  background: "var(--accent-bg)",
                  color: "var(--accent-pale)",
                  border: "1px solid var(--accent-border)",
                }}
                onMouseEnter={(e: any) =>
                  (e.currentTarget.style.background = "var(--accent-bg-hover)")
                }
                onMouseLeave={(e: any) =>
                  (e.currentTarget.style.background = "var(--accent-bg)")
                }
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Connect a template
              </button>
            </div>
          ) : (
            /* Connection cards */
            <div className="space-y-4">
              {existingConnections.map((conn: any) => (
                <TemplateConnectionCard
                  key={conn._id}
                  connection={conn}
                  allTemplates={templates ?? []}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
