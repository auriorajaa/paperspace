"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SaveIcon, ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { FormBuilder } from "@/components/forms/FormBuilder";
import type { FormQuestion } from "@/components/forms/QuestionBlock";

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [schema, setSchema] = useState<FormQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [initialised, setInitialised] = useState(false);

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
      });
      toast.success("Form saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  const siteUrl =
    typeof window !== "undefined" ? window.location.origin : "";

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
            className="text-[11px] transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
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
          <div className="flex items-center gap-2 shrink-0">
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
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl min-h-[44px] transition-all"
              style={{
                background: "var(--accent-strong-bg)",
                color: "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
                opacity: saving ? 0.6 : 1,
              }}
            >
              <SaveIcon className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <FormBuilder schema={schema} onChange={setSchema} />
        </div>
      </div>
    </div>
  );
}
