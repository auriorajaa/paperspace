"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  SaveIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
  EyeIcon,
  PaintBucketIcon,
  FileEditIcon,
  CheckCircle2Icon,
  CircleIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { FormBuilder } from "@/components/forms/FormBuilder";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { FormQuestion } from "@/components/forms/QuestionBlock";

const THEME_COLORS = [
  { label: "Indigo", value: "" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#10b981" },
  { label: "Red", value: "#ef4444" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Orange", value: "#f97316" },
  { label: "Teal", value: "#14b8a6" },
];

const FONT_OPTIONS = [
  { label: "Default", value: "default", css: undefined },
  { label: "Serif", value: "serif", css: "Georgia, 'Times New Roman', serif" },
  {
    label: "Mono",
    value: "mono",
    css: "'JetBrains Mono', ui-monospace, monospace",
  },
  {
    label: "Rounded",
    value: "rounded",
    css: "'Quicksand', system-ui, sans-serif",
  },
] as const;

const CORNER_OPTIONS = [
  { label: "Soft", value: "soft" },
  { label: "Square", value: "square" },
  { label: "Pill", value: "pill" },
] as const;

function fontCss(value?: string) {
  return FONT_OPTIONS.find((f) => f.value === value)?.css;
}

export default function BuilderPageClient() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as Id<"internalForms">;
  const { isLoaded, isSignedIn } = useAuth();

  const form = useQuery(
    api.internalForms.getById,
    isLoaded && isSignedIn ? { id: formId } : "skip"
  );
  const updateForm = useMutation(api.internalForms.update);
  const publish = useMutation(api.internalForms.publish);
  const archive = useMutation(api.internalForms.archive);
  const templateConnections = useQuery(
    api.formConnections.getByInternalFormId,
    isLoaded && isSignedIn && form ? { internalFormId: formId } : "skip"
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [schema, setSchema] = useState<FormQuestion[]>([]);
  const [settings, setSettings] = useState({
    acceptResponses: false,
    confirmationMessage: "",
    headerImage: "",
    themeColor: "",
    submitButtonText: "",
    showHeader: true,
    fontFamily: "default",
    cornerStyle: "soft",
    showProgress: true,
    seoDescription: "",
    collectEmail: false,
    allowedDomains: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"questions" | "customize">(
    "questions"
  );

  useEffect(() => {
    if (form && !initialised) {
      setTitle(form.title);
      setDescription(form.description ?? "");
      setSchema(
        form.schema.map((q: any) => ({
          id: q.id,
          title: q.title,
          type: q.type as FormQuestion["type"],
          required: q.required,
          options: q.options,
          description: q.description,
          placeholder: q.placeholder,
          min: q.min,
          max: q.max,
        }))
      );
      if (form.settings) {
        setSettings({
          acceptResponses: form.settings.acceptResponses ?? false,
          confirmationMessage: form.settings.confirmationMessage ?? "",
          headerImage: form.settings.headerImage ?? "",
          themeColor: form.settings.themeColor ?? "",
          submitButtonText: form.settings.submitButtonText ?? "",
          showHeader: form.settings.showHeader ?? true,
          fontFamily: form.settings.fontFamily ?? "default",
          cornerStyle: form.settings.cornerStyle ?? "soft",
          showProgress: form.settings.showProgress ?? true,
          seoDescription: form.settings.seoDescription ?? "",
          collectEmail: form.settings.collectEmail ?? false,
          allowedDomains: form.settings.allowedDomains ?? [],
        });
      }
      setInitialised(true);
    }
  }, [form, initialised]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please enter a form title");
      return;
    }
    setSaving(true);
    try {
      await updateForm({
        id: formId,
        title: title.trim(),
        description: description.trim() || undefined,
        schema: schema as any,
        settings,
      });
      toast.success("Form saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      await publish({ id: formId });
      toast.success("Form published");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to publish form");
    }
  };

  const handleArchive = async () => {
    try {
      await archive({ id: formId });
      toast.success("Form archived");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to archive form");
    }
  };

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const hasUnsaved =
    initialised &&
    form &&
    (title !== form.title ||
      description !== (form.description ?? "") ||
      JSON.stringify(schema) !== JSON.stringify(form.schema) ||
      JSON.stringify(settings) !== JSON.stringify(form.settings));

  if (form === undefined) {
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
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      <div
        className="px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Link
            href="/forms"
            className="text-[11px] transition-colors flex items-center gap-1"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Forms
          </Link>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {form.title || "Untitled"}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Builder
          </span>
          <StatusPill status={form.status} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-[15px] sm:text-base font-semibold bg-transparent outline-none w-full"
              style={{ color: "var(--text)" }}
              placeholder="Form title"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs mt-1 bg-transparent outline-none w-full"
              style={{ color: "var(--text-muted)" }}
              placeholder="Form description (optional)"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl min-h-[44px] transition-all"
              style={{
                background: showPreview
                  ? "var(--accent-bg)"
                  : "var(--bg-muted)",
                color: showPreview
                  ? "var(--accent-light)"
                  : "var(--text-muted)",
                border: `1px solid ${showPreview ? "var(--accent-border)" : "var(--border-subtle)"}`,
              }}
            >
              <EyeIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {showPreview ? "Editor" : "Preview"}
              </span>
            </button>

            {form.status === "published" && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${siteUrl}/f/${form.publicId}`
                  );
                  toast.success("Public link copied");
                }}
                className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl min-h-[44px] transition-all"
                style={{
                  background: "var(--bg-muted)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <ExternalLinkIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy link</span>
              </button>
            )}

            {form.status === "draft" && (
              <button
                onClick={handlePublish}
                className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-xl min-h-[44px] transition-all"
                style={{
                  background: "var(--success-bg)",
                  color: "var(--success)",
                  border:
                    "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
                }}
              >
                <ExternalLinkIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Publish</span>
              </button>
            )}

            {form.status === "published" && (
              <button
                onClick={handleArchive}
                className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl min-h-[44px] transition-all"
                style={{
                  background: "var(--warning-bg)",
                  color: "var(--warning)",
                  border:
                    "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
                }}
              >
                <ArchiveIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Archive</span>
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !hasUnsaved}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl min-h-[44px] transition-all"
              style={{
                background: "var(--accent-strong-bg)",
                color: "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
                opacity: saving || !hasUnsaved ? 0.6 : 1,
              }}
            >
              <SaveIcon className="w-3.5 h-3.5" />
              {saving ? "Saving\u2026" : hasUnsaved ? "Save" : "Saved"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div
          className={`flex-1 overflow-y-auto ${showPreview ? "hidden lg:block lg:w-1/2" : "w-full"}`}
        >
          <div
            className="px-4 sm:px-6 py-4 border-b shrink-0"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("questions")}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background:
                    activeTab === "questions"
                      ? "var(--accent-bg)"
                      : "transparent",
                  color:
                    activeTab === "questions"
                      ? "var(--accent-light)"
                      : "var(--text-muted)",
                }}
              >
                <FileEditIcon className="w-3.5 h-3.5" />
                Questions
                <span
                  className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "var(--bg-muted)",
                    color: "var(--text-dim)",
                  }}
                >
                  {schema.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("customize")}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background:
                    activeTab === "customize"
                      ? "var(--accent-bg)"
                      : "transparent",
                  color:
                    activeTab === "customize"
                      ? "var(--accent-light)"
                      : "var(--text-muted)",
                }}
              >
                <PaintBucketIcon className="w-3.5 h-3.5" />
                Customize
              </button>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-6">
            <div className="max-w-6xl">
              {activeTab === "questions" ? (
                <FormBuilder schema={schema} onChange={setSchema} />
              ) : (
                <div className="space-y-8">
                  {/* ── Appearance ── */}
                  <section className="space-y-5">
                    <SectionLabel
                      title="Appearance"
                      subtitle="Colors, typography, and shape applied to every field."
                    />

                    <div>
                      <label
                        className="text-xs font-medium mb-1.5 block"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Theme color
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {THEME_COLORS.map((c) => (
                          <button
                            key={c.label}
                            onClick={() =>
                              setSettings({ ...settings, themeColor: c.value })
                            }
                            className="w-8 h-8 rounded-lg transition-all"
                            style={{
                              background: c.value || "var(--accent-light)",
                              border:
                                settings.themeColor === c.value
                                  ? "2px solid var(--text)"
                                  : "2px solid transparent",
                              outline:
                                !c.value && settings.themeColor === ""
                                  ? `2px solid ${c.value || "var(--accent-light)"}`
                                  : undefined,
                              outlineOffset: 2,
                            }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          className="text-xs font-medium mb-1.5 block"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Font style
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {FONT_OPTIONS.map((f) => (
                            <button
                              key={f.value}
                              onClick={() =>
                                setSettings({
                                  ...settings,
                                  fontFamily: f.value,
                                })
                              }
                              className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all"
                              style={{
                                fontFamily: f.css,
                                background:
                                  settings.fontFamily === f.value
                                    ? "var(--accent-bg)"
                                    : "var(--bg-muted)",
                                color:
                                  settings.fontFamily === f.value
                                    ? "var(--accent-light)"
                                    : "var(--text-secondary)",
                                border: `1px solid ${
                                  settings.fontFamily === f.value
                                    ? "var(--accent-border)"
                                    : "var(--border-subtle)"
                                }`,
                              }}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label
                          className="text-xs font-medium mb-1.5 block"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Field shape
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {CORNER_OPTIONS.map((c) => (
                            <button
                              key={c.value}
                              onClick={() =>
                                setSettings({
                                  ...settings,
                                  cornerStyle: c.value,
                                })
                              }
                              className="text-[12px] font-medium px-3 py-1.5 transition-all"
                              style={{
                                borderRadius:
                                  c.value === "pill"
                                    ? 999
                                    : c.value === "square"
                                      ? 6
                                      : 10,
                                background:
                                  settings.cornerStyle === c.value
                                    ? "var(--accent-bg)"
                                    : "var(--bg-muted)",
                                color:
                                  settings.cornerStyle === c.value
                                    ? "var(--accent-light)"
                                    : "var(--text-secondary)",
                                border: `1px solid ${
                                  settings.cornerStyle === c.value
                                    ? "var(--accent-border)"
                                    : "var(--border-subtle)"
                                }`,
                              }}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label
                        className="text-xs font-medium mb-1.5 block"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Header image URL (optional)
                      </label>
                      <input
                        value={settings.headerImage}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            headerImage: e.target.value,
                          })
                        }
                        placeholder="https://example.com/image.jpg"
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={{
                          background: "var(--bg-muted)",
                          color: "var(--text)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      />
                      {settings.headerImage && (
                        <div className="mt-2 rounded-xl overflow-hidden max-h-32">
                          <img
                            src={settings.headerImage}
                            alt="Header preview"
                            className="w-full h-32 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showHeader"
                        checked={settings.showHeader}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            showHeader: e.target.checked,
                          })
                        }
                        className="rounded"
                        style={{ accentColor: "var(--accent-light)" }}
                      />
                      <label
                        htmlFor="showHeader"
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Show header with title and description
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showProgress"
                        checked={settings.showProgress}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            showProgress: e.target.checked,
                          })
                        }
                        className="rounded"
                        style={{ accentColor: "var(--accent-light)" }}
                      />
                      <label
                        htmlFor="showProgress"
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Show progress bar for forms with more than 3 questions
                      </label>
                    </div>
                  </section>

                  {/* ── Submission behavior ── */}
                  <section className="space-y-5">
                    <SectionLabel
                      title="Submission"
                      subtitle="What respondents see when they finish."
                    />

                    <div>
                      <label
                        className="text-xs font-medium mb-1.5 block"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Submit button text
                      </label>
                      <input
                        value={settings.submitButtonText}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            submitButtonText: e.target.value,
                          })
                        }
                        placeholder="Submit"
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={{
                          background: "var(--bg-muted)",
                          color: "var(--text)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        className="text-xs font-medium mb-1.5 block"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Confirmation message (after submission)
                      </label>
                      <textarea
                        value={settings.confirmationMessage}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            confirmationMessage: e.target.value,
                          })
                        }
                        placeholder="Thank you! Your response has been recorded."
                        rows={2}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                        style={{
                          background: "var(--bg-muted)",
                          color: "var(--text)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      />
                    </div>
                  </section>

                  {/* ── Email collection ── */}
                  <section className="space-y-5">
                    <SectionLabel
                      title="Email collection"
                      subtitle="Respondents must sign in with Google. Their verified email is recorded with each response."
                    />

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="collectEmail"
                        checked={settings.collectEmail}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            collectEmail: e.target.checked,
                            allowedDomains: e.target.checked
                              ? settings.allowedDomains
                              : [],
                          })
                        }
                        className="rounded"
                        style={{ accentColor: "var(--accent-light)" }}
                      />
                      <label
                        htmlFor="collectEmail"
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Require Google sign-in to collect respondent email
                      </label>
                    </div>

                    {settings.collectEmail && (
                      <DomainInput
                        domains={settings.allowedDomains}
                        onChange={(domains) =>
                          setSettings({ ...settings, allowedDomains: domains })
                        }
                      />
                    )}
                  </section>

                  {/* ── Connected templates ── */}
                  <section className="space-y-4">
                    <SectionLabel
                      title="Connected templates"
                      subtitle="Auto-generate documents when someone submits this form."
                    />

                    {templateConnections === undefined ? (
                      <div
                        className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: "var(--accent-light)" }}
                      />
                    ) : templateConnections.length > 0 ? (
                      <div className="space-y-1.5">
                        {templateConnections.map((conn: any) => (
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
                                {conn.fieldMappings.length !== 1
                                  ? "s"
                                  : ""}{" "}
                                mapped
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
                    ) : (
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-dim)" }}
                      >
                        No templates connected yet.
                      </p>
                    )}

                    <Link
                      href={`/forms/${formId}/connect-template`}
                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl transition-all"
                      style={{
                        background: "var(--accent-strong-bg)",
                        color: "var(--accent-pale)",
                        border: "1px solid var(--accent-border)",
                      }}
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      Connect a template
                    </Link>
                  </section>

                  {/* ── Link sharing ── */}
                  <section className="space-y-5">
                    <SectionLabel
                      title="Link sharing"
                      subtitle="Used as the preview text when this form's link is shared."
                    />
                    <div>
                      <label
                        className="text-xs font-medium mb-1.5 block"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Preview description (optional)
                      </label>
                      <textarea
                        value={settings.seoDescription}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            seoDescription: e.target.value,
                          })
                        }
                        placeholder={
                          description ||
                          "Fill out this short form — it only takes a minute."
                        }
                        rows={2}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                        style={{
                          background: "var(--bg-muted)",
                          color: "var(--text)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      />
                      <p
                        className="text-[10.5px] mt-1"
                        style={{ color: "var(--text-dim)" }}
                      >
                        Falls back to the form description if left empty.
                      </p>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>

        {showPreview && (
          <div
            className="w-full lg:w-1/2 border-l overflow-y-auto"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div
              className="px-4 py-3 text-xs font-medium sticky top-0"
              style={{
                background: "var(--bg)",
                color: "var(--text-muted)",
              }}
            >
              <EyeIcon className="w-3 h-3 inline mr-1" />
              Live preview
            </div>
            <div className="px-4 sm:px-6 py-6">
              <div className="max-w-lg">
                <div
                  className="rounded-2xl p-6 sm:p-8"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    ...(settings.themeColor
                      ? { borderTop: `3px solid ${settings.themeColor}` }
                      : {}),
                  }}
                >
                  <FormRenderer
                    schema={schema}
                    title={title}
                    description={description}
                    disabled
                    onSubmit={() => {}}
                    submitLabel={settings.submitButtonText || "Submit"}
                    themeColor={settings.themeColor}
                    headerImage={settings.headerImage}
                    showHeader={settings.showHeader}
                    showProgress={settings.showProgress}
                    cornerStyle={
                      settings.cornerStyle as "pill" | "soft" | "square"
                    }
                    fontFamily={fontCss(settings.fontFamily)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h3
        className="text-[13px] font-semibold"
        style={{ color: "var(--text)" }}
      >
        {title}
      </h3>
      <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text-dim)" }}>
        {subtitle}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isPublished = status === "published";
  const isArchived = status === "archived";
  const Icon = isPublished ? CheckCircle2Icon : CircleIcon;
  const label = isArchived ? "Archived" : isPublished ? "Published" : "Draft";
  return (
    <span
      className="flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ml-1"
      style={{
        background: isPublished ? "var(--success-bg)" : "var(--bg-muted)",
        color: isPublished ? "var(--success)" : "var(--text-dim)",
      }}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function DomainInput({
  domains,
  onChange,
}: {
  domains: string[];
  onChange: (domains: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addDomain = () => {
    const val = input.trim().toLowerCase();
    if (!val) return;
    if (domains.includes(val)) return;
    onChange([...domains, val]);
    setInput("");
  };

  const removeDomain = (domain: string) => {
    onChange(domains.filter((d) => d !== domain));
  };

  return (
    <div>
      <label
        className="text-xs font-medium mb-1.5 block"
        style={{ color: "var(--text-secondary)" }}
      >
        Allowed email domains (optional)
      </label>
      <p
        className="text-[10.5px] mb-2"
        style={{ color: "var(--text-dim)" }}
      >
        Leave empty to accept any email. Add one domain per line (e.g.
        <code className="text-[10px] ml-0.5" style={{ color: "var(--accent-light)" }}>
          mhsw.pnj.ac.id
        </code>
        ).
      </p>

      {domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {domains.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-light)",
                border: "1px solid var(--accent-border)",
              }}
            >
              {d}
              <button
                type="button"
                onClick={() => removeDomain(d)}
                className="hover:opacity-70"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDomain();
            }
          }}
          placeholder="mhsw.pnj.ac.id"
          className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text)",
            border: "1px solid var(--border-subtle)",
          }}
        />
        <button
          type="button"
          onClick={addDomain}
          className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "var(--accent-bg)",
            color: "var(--accent-light)",
            border: "1px solid var(--accent-border)",
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
