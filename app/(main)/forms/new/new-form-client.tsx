"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  FileEditIcon,
  LayoutTemplateIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

const NON_MAPPABLE_TYPES = ["loop", "condition", "condition_inverse"];

export default function NewFormClient({ orgId }: { orgId?: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const templates = useQuery(
    api.templates.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const create = useMutation(api.internalForms.create);

  const [mode, setMode] = useState<"select" | "blank" | "template">("select");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<Id<"templates"> | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreateBlank = async () => {
    if (!title.trim()) {
      toast.error("Please enter a form title");
      return;
    }
    setCreating(true);
    try {
      const id = await create({
        title: title.trim(),
        description: description.trim() || undefined,
        organizationId: orgId,
        schema: [],
      });
      router.push(`/forms/${id}/builder${orgId ? `?orgId=${orgId}` : ""}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create form");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }
    const template = templates?.find((t) => t._id === selectedTemplateId);
    if (!template) return;

    const schema = template.fields
      .filter((f: any) => !NON_MAPPABLE_TYPES.includes(f.type))
      .map((f: any) => ({
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: f.label,
        type: fieldTypeToQuestionType(f.type),
        required: f.required,
        options: undefined as string[] | undefined,
      }));

    const formTitle =
      title.trim() || `${template.name} Form`;

    setCreating(true);
    try {
      const id = await create({
        title: formTitle,
        description: description.trim() || undefined,
        organizationId: orgId,
        schema,
      });
      router.push(`/forms/${id}/builder${orgId ? `?orgId=${orgId}` : ""}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create form");
    } finally {
      setCreating(false);
    }
  };

  if (mode === "select") {
    return (
      <div
        className="flex flex-col h-full"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push(`/forms${orgId ? `?orgId=${orgId}` : ""}`)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-dim)")
              }
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div>
              <h1
                className="text-[15px] sm:text-base font-semibold"
                style={{ color: "var(--text)" }}
              >
                New form
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                How would you like to start?
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8">
          <div className="max-w-6xl grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => {
                setMode("blank");
                setTitle("");
                setDescription("");
              }}
              className="w-full text-left rounded-2xl p-5 flex flex-col gap-4 transition-all"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent-border)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-subtle)")
              }
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <FileEditIcon
                  className="w-5 h-5"
                  style={{ color: "var(--accent-light)" }}
                />
              </div>
              <div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--text)" }}
                >
                  Start from blank
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  Build your form from scratch. Add questions, customize the
                  theme, and collect responses — all with our drag-and-drop
                  builder.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {["Short text", "Multiple choice", "Dropdown", "Email"].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          background: "var(--bg-muted)",
                          color: "var(--text-dim)",
                        }}
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium mt-auto" style={{ color: "var(--accent-light)" }}>
                <span>Create blank form</span>
                <ArrowRightIcon className="w-3 h-3" />
              </div>
            </button>

            <button
              onClick={() => {
                setMode("template");
                setTitle("");
                setDescription("");
              }}
              className="w-full text-left rounded-2xl p-5 flex flex-col gap-4 transition-all"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent-border)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-subtle)")
              }
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--success-bg)",
                  border:
                    "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
                }}
              >
                <SparklesIcon
                  className="w-5 h-5"
                  style={{ color: "var(--success)" }}
                />
              </div>
              <div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--text)" }}
                >
                  Start from a template
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  Auto-generate form questions from an existing document
                  template. Each template field becomes a form question
                  automatically.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {["Auto-mapped", "Pre-filled", "Quick setup"].map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: "var(--bg-muted)",
                        color: "var(--text-dim)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium mt-auto" style={{ color: "var(--success)" }}>
                <span>Choose template</span>
                <ArrowRightIcon className="w-3 h-3" />
              </div>
            </button>
          </div>
        </div>
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
          <button
            onClick={() => router.push(`/forms${orgId ? `?orgId=${orgId}` : ""}`)}
            className="text-[11px] transition-colors flex items-center gap-1"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Forms
          </button>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {mode === "blank" ? "Blank form" : "From template"}
          </span>
        </div>
        <h1
          className="text-[15px] sm:text-base font-semibold"
          style={{ color: "var(--text)" }}
        >
          {mode === "blank" ? "Create blank form" : "Create form from template"}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-6xl space-y-4">
          <div>
            <label
              className="text-xs font-medium mb-1 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Form title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Client Onboarding Form"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </div>

          <div>
            <label
              className="text-xs font-medium mb-1 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this form is for"
              rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </div>

          {mode === "template" && (
            <div>
              <label
                className="text-xs font-medium mb-1 block"
                style={{ color: "var(--text-secondary)" }}
              >
                Choose a template
              </label>
              {!templates ? (
                <div className="space-y-1.5">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl px-3 py-2.5"
                      style={{
                        background: "var(--bg-muted)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        className="h-4 w-2/3 rounded animate-pulse mb-2"
                        style={{ background: "var(--bg-input)" }}
                      />
                      <div
                        className="h-3 w-1/3 rounded animate-pulse"
                        style={{ background: "var(--bg-input)" }}
                      />
                    </div>
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <p
                  className="text-xs py-3 text-center"
                  style={{ color: "var(--text-dim)" }}
                >
                  No templates available. Upload a document template first.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {(templates ?? []).map((t) => {
                    const mappable = t.fields.filter(
                      (f: any) => !NON_MAPPABLE_TYPES.includes(f.type)
                    );
                    return (
                      <button
                        key={t._id}
                        onClick={() =>
                          setSelectedTemplateId(
                            t._id as Id<"templates">
                          )
                        }
                        className="w-full text-left rounded-xl px-3 py-2.5 transition-all flex items-center gap-3"
                        style={{
                          background:
                            selectedTemplateId === t._id
                              ? "var(--accent-bg)"
                              : "var(--bg-muted)",
                          border: `1px solid ${
                            selectedTemplateId === t._id
                              ? "var(--accent-border)"
                              : "var(--border-subtle)"
                          }`,
                        }}
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
                            {mappable.length} mappable field
                            {mappable.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {selectedTemplateId === t._id && (
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--accent-light)" }}
                          >
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setMode("select")}
              className="text-[13px] font-medium px-4 py-2 rounded-xl min-h-[44px] transition-all"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Back
            </button>
            <button
              onClick={
                mode === "blank"
                  ? handleCreateBlank
                  : handleCreateFromTemplate
              }
              disabled={creating || (mode === "template" && !selectedTemplateId)}
              className="flex-1 text-[13px] font-semibold px-4 py-2 rounded-xl min-h-[44px] transition-all"
              style={{
                background: "var(--accent-strong-bg)",
                color: "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
                opacity: creating || (mode === "template" && !selectedTemplateId) ? 0.6 : 1,
              }}
            >
              {creating
                ? "Creating\u2026"
                : mode === "blank"
                  ? "Create blank form"
                  : "Create form"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fieldTypeToQuestionType(type: string): string {
  if (type === "email") return "email";
  if (type === "number") return "number";
  if (type === "date") return "date";
  return "short_text";
}
