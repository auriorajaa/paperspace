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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function TemplateNewPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const generateUploadUrl = useMutation(api.templates.generateUploadUrl);
  const createTemplate = useMutation(api.templates.create);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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

      // Scan fields from mammoth
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

      toast.success("Template created — add your placeholders in the editor");
      router.push(`/templates/${templateId}/edit`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create template. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Link
          href="/templates"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Templates
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="text-sm font-semibold">New template</span>
      </div>

      {/* Body — centered card */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg space-y-6">
          <div>
            <h2 className="text-base font-semibold">Upload template file</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Upload your .docx file. You&apos;ll add{" "}
              <code className="font-mono bg-muted px-1 rounded">
                {"{{placeholders}}"}
              </code>{" "}
              directly in the editor after this step.
            </p>
          </div>

          {/* Upload zone */}
          {!file ? (
            <div
              className={`flex flex-col items-center justify-center p-10 rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/20"
              }`}
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
            >
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <UploadCloudIcon className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">
                Drop .docx file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">Max 10MB</p>
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
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/20">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                <FileTextIcon className="w-4.5 h-4.5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setName("");
                }}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Name + description */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-name" className="text-xs font-semibold">
                Template name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tmpl-name"
                placeholder="e.g. Employee Contract"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-desc" className="text-xs font-semibold">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <textarea
                id="tmpl-desc"
                placeholder="What is this template used for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !file || !name.trim()}
            className="w-full gap-2"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Uploading…
              </>
            ) : (
              "Save & open editor →"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
