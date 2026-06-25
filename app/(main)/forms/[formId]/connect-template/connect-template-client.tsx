"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";

const NON_MAPPABLE_TYPES = ["loop", "condition", "condition_inverse"];

export default function ConnectTemplateClient() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as Id<"internalForms">;
  const { isLoaded, isSignedIn } = useAuth();

  const form = useQuery(
    api.internalForms.getById,
    isLoaded && isSignedIn ? { id: formId } : "skip"
  );
  const templates = useQuery(
    api.templates.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const existingConnections = useQuery(
    api.formConnections.getByInternalFormId,
    isLoaded && isSignedIn ? { internalFormId: formId } : "skip"
  );

  const createConnection = useMutation(api.formConnections.create);

  const [selectedTemplateId, setSelectedTemplateId] =
    useState<Id<"templates"> | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [filenamePattern, setFilenamePattern] = useState("");
  const [saving, setSaving] = useState(false);

  const mappableFields = useMemo(() => {
    if (!form) return [];
    return form.schema.map((q: any) => ({
      id: q.id,
      title: q.title,
      type: q.type,
    }));
  }, [form]);

  const selectedTemplate = templates?.find(
    (t) => t._id === selectedTemplateId
  );

  const templateFields = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.fields.filter(
      (f: any) => !NON_MAPPABLE_TYPES.includes(f.type)
    );
  }, [selectedTemplate]);

  const handleCreate = async () => {
    if (!selectedTemplateId || !form) return;

    const validMappings = Object.entries(mappings)
      .filter(([, questionId]) => questionId)
      .map(([templateFieldName, questionId]) => {
        const q = mappableFields.find((f) => f.id === questionId);
        return {
          formQuestionTitle: q?.title ?? questionId,
          templateFieldName,
          sourceQuestionId: questionId,
        };
      });

    if (validMappings.length === 0) {
      toast.error("Please map at least one template field to a form question");
      return;
    }

    const pattern = filenamePattern.trim() || `document_{{row_number}}`;
    const cleanedPattern = pattern.replace(/{{.*?}}/g, "");
    if (/[<>:"/\\|?*]/.test(cleanedPattern)) {
      toast.error("Filename contains invalid characters");
      return;
    }

    setSaving(true);
    try {
      await createConnection({
        templateId: selectedTemplateId,
        formId: formId,
        formTitle: form.title,
        fieldMappings: validMappings,
        filenamePattern: pattern,
        connectionType: "internal",
        internalFormId: formId,
      });
      toast.success("Template connected");
      // Refresh by clearing selection
      setSelectedTemplateId(null);
      setMappings({});
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create connection");
    } finally {
      setSaving(false);
    }
  };

  const mappedCount = Object.values(mappings).filter(Boolean).length;

  if (form === undefined || templates === undefined || existingConnections === undefined) {
    return (
      <div
        className="flex flex-col h-full"
        style={{ background: "var(--bg)" }}
      >
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
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          Form not found
        </p>
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
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 shrink-0"
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
        <h1
          className="text-[15px] sm:text-base font-semibold"
          style={{ color: "var(--text)" }}
        >
          Connect a template
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Generate documents automatically when someone submits this form.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Existing connections */}
          {existingConnections.length > 0 && (
            <div className="space-y-2">
              <h2
                className="text-xs font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                Connected templates
              </h2>
              {existingConnections.map((conn: any) => (
                <div
                  key={conn._id}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {conn.templateName}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {conn.fieldMappings.length} field
                      {conn.fieldMappings.length !== 1 ? "s" : ""} mapped
                    </p>
                  </div>
                  <span
                    className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      background: conn.isActive
                        ? "var(--success-bg)"
                        : "var(--bg-input)",
                      color: conn.isActive
                        ? "var(--success)"
                        : "var(--text-dim)",
                    }}
                  >
                    {conn.isActive ? "active" : "paused"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* New connection wizard */}
          {!selectedTemplateId && (
            <div className="space-y-2">
              <h2
                className="text-xs font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                {existingConnections.length > 0
                  ? "Add another template"
                  : "Choose a template"}
              </h2>
              <div className="space-y-1.5">
                {(templates ?? []).map((t) => (
                  <button
                    key={t._id}
                    onClick={() => setSelectedTemplateId(t._id as Id<"templates">)}
                    className="w-full text-left rounded-xl px-4 py-3 transition-all flex items-center gap-3"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--accent-border)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--border-subtle)")
                    }
                  >
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
                        {t.fields.length} field{t.fields.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ArrowRightIcon
                      className="w-4 h-4 shrink-0"
                      style={{ color: "var(--text-dim)" }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Field mapping */}
          {selectedTemplateId && selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2
                  className="text-xs font-semibold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Map fields to &ldquo;{selectedTemplate.name}&rdquo;
                </h2>
                <button
                  onClick={() => {
                    setSelectedTemplateId(null);
                    setMappings({});
                  }}
                  className="text-xs font-medium px-2 py-1 rounded-lg"
                  style={{
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  Change template
                </button>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--bg-input)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${templateFields.length > 0 ? (mappedCount / templateFields.length) * 100 : 0}%`,
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

              {templateFields.length > 0 ? (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-card)",
                  }}
                >
                  {templateFields.map((field: any, idx: number) => {
                    const isLast = idx === templateFields.length - 1;
                    const isMapped = !!mappings[field.name];
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
                        }}
                      >
                        <div className="sm:w-40 sm:shrink-0">
                          <p
                            className="text-xs font-semibold"
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

                        <span
                          className="hidden sm:flex items-center shrink-0"
                          style={{ color: "var(--border-subtle)" }}
                        >
                          <ArrowRightIcon className="w-3.5 h-3.5" />
                        </span>

                        <select
                          value={mappings[field.name] ?? ""}
                          onChange={(e) =>
                            setMappings((prev) => ({
                              ...prev,
                              [field.name]: e.target.value,
                            }))
                          }
                          className="flex-1 rounded-xl px-3 py-2 text-sm outline-none min-h-[44px]"
                          style={{
                            background: isMapped
                              ? "color-mix(in srgb, var(--accent) 6%, var(--bg-muted))"
                              : "var(--bg-muted)",
                            border: `1px solid ${isMapped ? "var(--accent-border)" : "var(--border-subtle)"}`,
                            color: isMapped
                              ? "var(--text)"
                              : "var(--text-dim)",
                          }}
                        >
                          <option value="">— not mapped —</option>
                          {mappableFields.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                  No mappable fields in this template.
                </p>
              )}

              {/* Filename pattern */}
              <div>
                <label
                  className="text-xs font-medium mb-1 block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Filename pattern
                </label>
                <input
                  value={filenamePattern}
                  onChange={(e) => setFilenamePattern(e.target.value)}
                  placeholder="document_{{row_number}}"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
                  style={{
                    background: "var(--bg-muted)",
                    color: "var(--text)",
                    border: "1px solid var(--border-subtle)",
                  }}
                />
                <p
                  className="text-[10px] mt-1"
                  style={{ color: "var(--text-dim)" }}
                >
                  Use {"{{row_number}}"} and {"{{fieldName}}"} tokens.
                </p>
              </div>

              {/* Save */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 text-[13px] font-semibold px-4 py-2 rounded-xl min-h-[44px] transition-all"
                  style={{
                    background: "var(--accent-strong-bg)",
                    color: "var(--accent-pale)",
                    border: "1px solid var(--accent-border)",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Connecting…" : "Connect template"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
