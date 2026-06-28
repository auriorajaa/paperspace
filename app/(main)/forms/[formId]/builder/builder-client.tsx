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
  });
  const [saving, setSaving] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"questions" | "customize">("questions");

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

  const siteUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const hasUnsaved = initialised && form && (
    title !== form.title ||
    description !== (form.description ?? "") ||
    JSON.stringify(schema) !== JSON.stringify(form.schema) ||
    JSON.stringify(settings) !== JSON.stringify(form.settings)
  );

  if (form === undefined) {
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
                background: showPreview ? "var(--accent-bg)" : "var(--bg-muted)",
                color: showPreview ? "var(--accent-light)" : "var(--text-muted)",
                border: `1px solid ${showPreview ? "var(--accent-border)" : "var(--border-subtle)"}`,
              }}
            >
              <EyeIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{showPreview ? "Editor" : "Preview"}</span>
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
                  border: "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
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
                  border: "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
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
              {saving ? "Saving\u2026" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className={`flex-1 overflow-y-auto ${showPreview ? "hidden lg:block lg:w-1/2" : "w-full"}`}>
          <div className="px-4 sm:px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("questions")}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: activeTab === "questions" ? "var(--accent-bg)" : "transparent",
                  color: activeTab === "questions" ? "var(--accent-light)" : "var(--text-muted)",
                }}
              >
                <FileEditIcon className="w-3.5 h-3.5" />
                Questions
              </button>
              <button
                onClick={() => setActiveTab("customize")}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: activeTab === "customize" ? "var(--accent-bg)" : "transparent",
                  color: activeTab === "customize" ? "var(--accent-light)" : "var(--text-muted)",
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
                <div className="space-y-6">
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
                        setSettings({ ...settings, headerImage: e.target.value })
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
                            (e.target as HTMLImageElement).style.display = "none";
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
                        setSettings({ ...settings, showHeader: e.target.checked })
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
                        setSettings({ ...settings, submitButtonText: e.target.value })
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
                        setSettings({ ...settings, confirmationMessage: e.target.value })
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
                borderBottom: "1px solid var(--border-subtle)",
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
