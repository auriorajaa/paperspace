"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  UploadCloudIcon,
  FileTextIcon,
  ChevronLeftIcon,
  XIcon,
  TagIcon,
} from "lucide-react";
import Link from "next/link";
import { colors } from "@/lib/design-tokens";

export default function TemplateNewPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const generateUploadUrl = useMutation(api.templates.generateUploadUrl);
  const createTemplate = useMutation(api.templates.create);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".docx")) {
      toast.error("Only .docx files are supported.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10MB.");
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.docx$/i, ""));
  };

  const addTag = (raw: string) => {
    const newTags = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !tags.includes(t));
    if (newTags.length) setTags((prev) => [...prev, ...newTags]);
  };
  const removeTag = (tag: string) =>
    setTags((prev) => prev.filter((t) => t !== tag));
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput && tags.length)
      removeTag(tags[tags.length - 1]);
  };

  const handleSave = async () => {
    if (!file) {
      toast.error("Please upload a .docx file first.");
      return;
    }
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }

    setSaving(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();

      const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
      const fileUrl = `${convexSiteUrl}/getFile?storageId=${storageId}`;

      const mammoth = await import("mammoth");
      const buffer = await file.arrayBuffer();
      const textResult = await mammoth.extractRawText({ arrayBuffer: buffer });
      const { detectPlaceholders } = await import("@/lib/placeholder-detector");
      const fields = detectPlaceholders(textResult.value);

      const templateId = await createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        storageId,
        fileUrl,
        previewText: textResult.value,
        tags: tags.length > 0 ? tags : undefined,
        organizationId: organization?.id,
        fields: fields.map((f) => ({
          id: f.id,
          name: f.name,
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder,
          subFields: f.subFields?.map((sf) => ({
            id: sf.id,
            name: sf.name,
            label: sf.label,
            type: sf.type,
            required: sf.required,
            placeholder: sf.placeholder,
          })),
        })),
      });

      toast.success(
        fields.length > 0
          ? `Template created — ${fields.length} placeholder${fields.length !== 1 ? "s" : ""} detected`
          : "Template created — add placeholders in the editor"
      );
      router.push(`/templates/${templateId}/edit`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create template. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <Link
          href="/templates"
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: colors.textMuted }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = colors.accentLight)
          }
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Templates
        </Link>
        <span style={{ color: colors.textDim, fontSize: 11 }}>/</span>
        <span className="text-sm font-semibold" style={{ color: colors.text }}>
          New template
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-lg space-y-6">
          {/* Title */}
          <div>
            <h2
              className="text-base font-semibold"
              style={{ color: colors.text }}
            >
              Upload template file
            </h2>
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{ color: colors.textMuted }}
            >
              Upload your .docx file. After saving, you&apos;ll add{" "}
              <code
                className="font-mono px-1 rounded text-[11px]"
                style={{
                  background: "rgba(99,102,241,0.12)",
                  color: "#818cf8",
                }}
              >
                {"{{placeholders}}"}
              </code>{" "}
              directly in the ONLYOFFICE editor.
            </p>
          </div>

          {/* Upload zone */}
          {!file ? (
            <div
              className="flex flex-col items-center justify-center p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer"
              style={{
                borderColor: dragOver ? colors.accent : "rgba(255,255,255,0.1)",
                background: dragOver
                  ? "rgba(99,102,241,0.06)"
                  : "rgba(255,255,255,0.02)",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              onMouseEnter={(e) => {
                if (!dragOver)
                  e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)";
              }}
              onMouseLeave={(e) => {
                if (!dragOver)
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                <UploadCloudIcon
                  className="w-6 h-6"
                  style={{ color: "#818cf8" }}
                />
              </div>
              <p
                className="text-sm font-medium mb-1"
                style={{ color: colors.textSecondary }}
              >
                Drop .docx file here, or click to browse
              </p>
              <p className="text-xs" style={{ color: colors.textDim }}>
                Max 10MB
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          ) : (
            <div
              className="flex items-center gap-3 p-4 rounded-2xl"
              style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.18)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(99,102,241,0.15)" }}
              >
                <FileTextIcon
                  className="w-4.5 h-4.5"
                  style={{ color: "#818cf8" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: colors.text }}
                >
                  {file.name}
                </p>
                <p className="text-xs" style={{ color: colors.textMuted }}>
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setName("");
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: colors.textMuted }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Fields */}
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold"
                style={{ color: colors.textMuted }}
              >
                Template name <span style={{ color: "#f87171" }}>*</span>
              </label>
              <input
                placeholder="e.g. Employee Contract"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
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

            {/* Description */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold"
                style={{ color: colors.textMuted }}
              >
                Description{" "}
                <span style={{ color: colors.textDim, fontWeight: 400 }}>
                  (optional)
                </span>
              </label>
              <textarea
                placeholder="What is this template used for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
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

            {/* Tags */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold flex items-center gap-1.5"
                style={{ color: colors.textMuted }}
              >
                <TagIcon className="w-3 h-3" />
                Tags{" "}
                <span style={{ color: colors.textDim, fontWeight: 400 }}>
                  (optional)
                </span>
              </label>
              <div
                className="flex flex-wrap gap-1.5 p-2.5 rounded-xl min-h-[42px]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${colors.border}`,
                }}
              >
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{
                      background: "rgba(129,140,248,0.15)",
                      color: "#818cf8",
                      border: "1px solid rgba(129,140,248,0.25)",
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:opacity-60"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => {
                    if (tagInput.trim()) {
                      addTag(tagInput);
                      setTagInput("");
                    }
                  }}
                  placeholder={
                    tags.length ? "" : "invoice, contract, hr… (Enter or comma)"
                  }
                  className="flex-1 min-w-[120px] text-xs bg-transparent outline-none"
                  style={{ color: colors.text }}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={saving || !file || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              background:
                saving || !file || !name.trim()
                  ? "rgba(99,102,241,0.1)"
                  : "rgba(99,102,241,0.2)",
              color:
                saving || !file || !name.trim()
                  ? colors.textDim
                  : colors.accentPale,
              border: `1px solid ${saving || !file || !name.trim() ? "rgba(99,102,241,0.1)" : colors.accentBorder}`,
              cursor:
                saving || !file || !name.trim() ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!saving && file && name.trim()) {
                e.currentTarget.style.background = "rgba(99,102,241,0.3)";
                e.currentTarget.style.boxShadow =
                  "0 0 20px rgba(99,102,241,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(99,102,241,0.2)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {saving ? (
              <>
                <div
                  className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: colors.accentLight }}
                />
                Uploading & scanning…
              </>
            ) : (
              "Save & open editor →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
