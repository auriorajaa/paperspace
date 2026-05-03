"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback } from "react";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  ChevronLeftIcon,
  CheckIcon,
  XIcon,
  PencilIcon,
  PlusIcon,
  AlertCircleIcon,
  ChevronRightIcon,
  InfoIcon,
  ScanIcon,
  ListIcon,
  TrashIcon,
  Loader2Icon,
  EyeIcon,
} from "lucide-react";
import LightDocxPreview, {
  type ReviewField,
  type FieldType,
} from "@/components/LightDocxPreview";

// ── Constants ──────────────────────────────────────────────────────
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "loop", label: "Table (loop)" },
  { value: "condition", label: "Condition" },
  { value: "condition_inverse", label: "Condition (falsy)" },
];

const SOURCE_LABELS: Record<string, string> = {
  label_colon: "Label : ___",
  table_2col: "2-column table",
  table_loop: "Repeating rows",
  underline_blank: "Underline blank",
  form_box: "Form box",
  recipient_block: "Recipient block",
  manual: "Added manually",
};

const TYPE_COLORS: Record<
  FieldType,
  { bg: string; text: string; border: string }
> = {
  text: {
    bg: "var(--accent-soft)",
    text: "var(--accent-light)",
    border: "var(--accent-border)",
  },
  date: {
    bg: "var(--success-bg)",
    text: "var(--success)",
    border: "color-mix(in srgb, var(--success) 35%, transparent)",
  },
  number: {
    bg: "var(--warning-bg)",
    text: "var(--warning)",
    border: "color-mix(in srgb, var(--warning) 35%, transparent)",
  },
  email: {
    bg: "color-mix(in srgb, var(--field-email, #9333ea) 12%, transparent)",
    text: "var(--field-email, #9333ea)",
    border:
      "color-mix(in srgb, var(--field-email, #9333ea) 30%, transparent)",
  },
  phone: {
    bg: "color-mix(in srgb, var(--field-phone, #0891b2) 12%, transparent)",
    text: "var(--field-phone, #0891b2)",
    border:
      "color-mix(in srgb, var(--field-phone, #0891b2) 30%, transparent)",
  },
  loop: {
    bg: "color-mix(in srgb, var(--field-loop, #7c6af7) 12%, transparent)",
    text: "var(--field-loop, #7c6af7)",
    border: "color-mix(in srgb, var(--field-loop, #7c6af7) 30%, transparent)",
  },
  condition: {
    bg: "color-mix(in srgb, var(--field-condition, #db2777) 12%, transparent)",
    text: "var(--field-condition, #db2777)",
    border:
      "color-mix(in srgb, var(--field-condition, #db2777) 30%, transparent)",
  },
  condition_inverse: {
    bg: "color-mix(in srgb, var(--field-condition, #db2777) 12%, transparent)",
    text: "var(--field-condition, #db2777)",
    border:
      "color-mix(in srgb, var(--field-condition, #db2777) 30%, transparent)",
  },
};

// ── Helper Functions ───────────────────────────────────────────────
function makeId(): string {
  return `rf_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function toName(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "field"
  );
}

function toLabel(name: string): string {
  return name
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
}

function confidenceColor(conf: number): string {
  if (conf >= 0.85) return "var(--success)";
  if (conf >= 0.7) return "var(--warning)";
  return "var(--danger)";
}

function confidenceLabel(conf: number): string {
  if (conf >= 0.85) return "High";
  if (conf >= 0.7) return "Medium";
  return "Low";
}

function placeholderForType(name: string, type: FieldType): string {
  if (type === "loop" || type === "condition") {
    return `{{#${name}}}...{{/${name}}}`;
  }
  if (type === "condition_inverse") {
    return `{{^${name}}}...{{/${name}}}`;
  }
  return `{{${name}}}`;
}

function replacementForSelection(
  name: string,
  type: FieldType,
  selectedText: string
): string {
  if (type === "loop") return `{{#${name}}}${selectedText}{{/${name}}}`;
  if (type === "condition") return `{{#${name}}}${selectedText}{{/${name}}}`;
  if (type === "condition_inverse") {
    return `{{^${name}}}${selectedText}{{/${name}}}`;
  }
  return `{{${name}}}`;
}

function serializeField(field: ReviewField) {
  return {
    id: field.id,
    name: field.name,
    label: field.label,
    type: field.type,
    required: field.required,
    placeholder: field.placeholder,
    confidence: field.confidence,
    source: field.source,
    targetText: field.targetText,
    contextText: field.contextText,
    replacementText: field.replacementText,
    originalPlaceholder: field.originalPlaceholder,
    subFields: field.subFields?.map((sf) => ({
      id: sf.id,
      name: sf.name,
      label: sf.label,
      type: sf.type,
      required: sf.required,
      placeholder: sf.placeholder,
      confidence: sf.confidence,
      source: sf.source,
      targetText: sf.targetText,
      contextText: sf.contextText,
      replacementText: sf.replacementText,
      originalPlaceholder: sf.originalPlaceholder,
    })),
  };
}

// ── FieldRow Component ──────────────────────────────────────────────
function FieldRow({
  field,
  index,
  onUpdate,
  onDelete,
}: {
  field: ReviewField;
  index: number;
  onUpdate: (id: string, patch: Partial<ReviewField>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(field.label);
  const [editType, setEditType] = useState<FieldType>(field.type);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) labelInputRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    const trimmedLabel = editLabel.trim();
    if (!trimmedLabel) {
      toast.error("Label cannot be empty.");
      return;
    }
    const newName = toName(trimmedLabel);
    onUpdate(field.id, {
      label: trimmedLabel,
      name: newName,
      type: editType,
      placeholder: placeholderForType(newName, editType),
      replacementText: field.targetText
        ? replacementForSelection(newName, editType, field.targetText)
        : field.replacementText,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditLabel(field.label);
    setEditType(field.type);
    setEditing(false);
  };

  const typeColor = TYPE_COLORS[field.type] ?? TYPE_COLORS.text;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${field.isNew ? "color-mix(in srgb, var(--success) 35%, transparent)" : "var(--border-subtle)"}`,
        background: field.isNew ? "var(--success-bg)" : "var(--bg-muted)",
      }}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
          style={{ background: "var(--bg-input)", color: "var(--text-dim)" }}
        >
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                ref={labelInputRef}
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
                placeholder="Field label…"
                className="text-sm rounded-lg px-2.5 py-1.5 outline-none w-full"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--accent-border)",
                  color: "var(--text)",
                }}
              />
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as FieldType)}
                className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent-light)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  <CheckIcon className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg"
                  style={{
                    background: "var(--bg-muted)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <XIcon className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--text)" }}
                >
                  {field.label}
                </span>
                <code
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-dim)",
                  }}
                >
                  {field.name}
                </code>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    background: typeColor.bg,
                    color: typeColor.text,
                    border: `1px solid ${typeColor.border}`,
                  }}
                >
                  {FIELD_TYPES.find((t) => t.value === field.type)?.label ??
                    field.type}
                </span>
                {field.isNew && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      background:
                        "color-mix(in srgb, var(--success) 15%, transparent)",
                      color: "var(--success)",
                      border:
                        "1px solid color-mix(in srgb, var(--success) 30%, transparent)",
                    }}
                  >
                    New
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {field.source && field.source !== "manual" && (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-dim)" }}
                  >
                    From: {SOURCE_LABELS[field.source] ?? field.source}
                  </span>
                )}
                {field.confidence !== undefined && (
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: confidenceColor(field.confidence) }}
                  >
                    Confidence: {confidenceLabel(field.confidence)} (
                    {Math.round(field.confidence * 100)}%)
                  </span>
                )}
              </div>

              {field.type === "loop" &&
                field.subFields &&
                field.subFields.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {field.subFields.map((sf) => (
                      <span
                        key={sf.id}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: "var(--bg-input)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {sf.name}
                      </span>
                    ))}
                  </div>
                )}
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                setEditLabel(field.label);
                setEditType(field.type);
                setEditing(true);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--text-dim)" }}
              title="Edit field"
            >
              <PencilIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(field.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--text-dim)" }}
              title="Delete field"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AddFieldForm Component ─────────────────────────────────────────
function AddFieldForm({ onAdd }: { onAdd: (f: ReviewField) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleAdd = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error("Field label cannot be empty.");
      return;
    }
    const name = toName(trimmed);
    const field: ReviewField = {
      id: makeId(),
      name,
      label: trimmed,
      type,
      required: true,
      placeholder: placeholderForType(name, type),
      source: "manual",
      isNew: true,
    };
    onAdd(field);
    setLabel("");
    setType("text");
    setOpen(false);
    toast.success(`Field "${trimmed}" added.`);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3.5 py-2.5 rounded-xl text-sm transition-colors"
        style={{
          background: "var(--bg-muted)",
          border: "1px dashed var(--border-hover)",
          color: "var(--text-muted)",
        }}
      >
        <PlusIcon className="w-4 h-4" />
        Add field manually
      </button>
    );
  }

  return (
    <div
      className="rounded-xl p-3.5 space-y-3"
      style={{
        background: "var(--bg-muted)",
        border: "1px solid var(--accent-border)",
      }}
    >
      <p
        className="text-xs font-semibold"
        style={{ color: "var(--text-secondary)" }}
      >
        Add new field
      </p>
      <input
        ref={inputRef}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Field label, e.g.: Client Name"
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text)",
        }}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as FieldType)}
        className="w-full rounded-lg px-3 py-2 text-xs outline-none"
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-secondary)",
        }}
      >
        {FIELD_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{
            background: "var(--accent-strong-bg)",
            color: "var(--accent-pale)",
            border: "1px solid var(--accent-border)",
          }}
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setLabel("");
          }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── FieldListPanel Component ───────────────────────────────────────
function FieldListPanel({
  fields,
  totalFields,
  loopFields,
  onUpdate,
  onDelete,
  onAdd,
  onConfirm,
  saving,
}: {
  fields: ReviewField[];
  totalFields: number;
  loopFields: number;
  onUpdate: (id: string, patch: Partial<ReviewField>) => void;
  onDelete: (id: string) => void;
  onAdd: (f: ReviewField) => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats */}
      <div
        className="shrink-0 px-4 py-3 grid grid-cols-2 gap-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        {[
          {
            label: "Total fields",
            value: totalFields,
            color: "var(--text-secondary)",
          },
          {
            label: "Loop / Table",
            value: loopFields,
            color: "var(--field-loop, #7c6af7)",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 px-3 py-2 rounded-xl"
            style={{
              background: "var(--bg-muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <span className="text-[18px] font-bold" style={{ color }}>
              {value}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Field list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {fields.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ScanIcon
              className="w-8 h-8"
              style={{ color: "var(--text-dim)", opacity: 0.4 }}
            />
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              No fields detected.
              <br />
              Add manually below or select text in the document.
            </p>
          </div>
        ) : (
          fields.map((f, i) => (
            <FieldRow
              key={f.id}
              field={f}
              index={i}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))
        )}
        <AddFieldForm onAdd={onAdd} />
      </div>

      {/* Confirm button */}
      <div
        className="shrink-0 px-3 py-3"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <button
          onClick={onConfirm}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: saving
              ? "var(--accent-soft)"
              : "var(--accent-strong-bg)",
            color: saving ? "var(--text-dim)" : "var(--accent-pale)",
            border: "1.5px solid var(--accent-border)",
          }}
        >
          {saving ? (
            <>
              <Loader2Icon
                className="w-4 h-4 animate-spin"
                style={{ color: "var(--accent-light)" }}
              />
              Saving…
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4" />
              Confirm & Continue
              <ChevronRightIcon className="w-4 h-4" />
            </>
          )}
        </button>
        <p
          className="text-[10px] text-center mt-1.5"
          style={{ color: "var(--text-dim)" }}
        >
          Fields will be saved
        </p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function TemplateReviewClient() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as Id<"templates">;
  const { isLoaded, isSignedIn } = useAuth();

  const template = useQuery(
    api.templates.getById,
    isLoaded && isSignedIn ? { id: templateId } : "skip"
  );
  const updateTemplate = useMutation(api.templates.update);

  const [fields, setFields] = useState<ReviewField[]>([]);
  const [fieldsInitialized, setFieldsInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"fields" | "preview">("fields");
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);

  // Fetch DOCX buffer untuk preview
  useEffect(() => {
    if (!template?.fileUrl) return;
    fetch(template.fileUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        setDocxBuffer(buf);
        console.log("[ReviewPage] DOCX buffer loaded, size:", buf.byteLength);
      })
      .catch((err) => {
        console.error("[ReviewPage] failed to load DOCX:", err);
        toast.error("Failed to load document preview.");
      });
  }, [template?.fileUrl]);

  // Init fields from template
  useEffect(() => {
    if (!template || fieldsInitialized) return;
    setFields(
      (template.fields ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        label: f.label,
        type: f.type as FieldType,
        required: f.required,
        placeholder: f.placeholder,
        confidence: f.confidence,
        source: f.source as ReviewField["source"],
        targetText: f.targetText,
        contextText: f.contextText,
        replacementText: f.replacementText,
        originalPlaceholder: f.originalPlaceholder ?? f.placeholder,
        subFields: f.subFields?.map((sf) => ({
          id: sf.id,
          name: sf.name,
          label: sf.label,
          type: sf.type as FieldType,
          required: sf.required,
          placeholder: sf.placeholder,
          confidence: sf.confidence,
          source: sf.source as ReviewField["source"],
          targetText: sf.targetText,
          contextText: sf.contextText,
          replacementText: sf.replacementText,
          originalPlaceholder: sf.originalPlaceholder ?? sf.placeholder,
        })),
      }))
    );
    setFieldsInitialized(true);
  }, [template, fieldsInitialized]);

  // ── Field Handlers ──────────────────────────────────────────────
  const handleUpdate = useCallback(
    (id: string, patch: Partial<ReviewField>) => {
      setFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
      );
    },
    []
  );

  const handleDelete = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleAdd = useCallback((f: ReviewField) => {
    setFields((prev) => [...prev, f]);
  }, []);

  const handleAddPlaceholder = useCallback(
    (selectedText: string, type: FieldType) => {
      const name = toName(selectedText);
      const label = toLabel(name);
      setFields((prev) => {
        if (prev.some((f) => f.name === name)) {
          toast.error(`Field "${label}" already exists.`);
          return prev;
        }
        const newField: ReviewField = {
          id: makeId(),
          name,
          label,
          type,
          required: type !== "condition" && type !== "condition_inverse",
          placeholder: placeholderForType(name, type),
          replacementText: replacementForSelection(name, type, selectedText),
          targetText: selectedText,
          contextText: selectedText,
          source: "manual",
          isNew: true,
        };
        toast.success(`Placeholder "${newField.placeholder}" added.`);
        return [...prev, newField];
      });
    },
    []
  );

  // ── Confirm ─────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updatePayload: {
        id: Id<"templates">;
        fields: ReturnType<typeof serializeField>[];
        storageId?: string;
        fileUrl?: string;
        previewText?: string;
      } = {
        id: templateId,
        fields: fields.map(serializeField),
      };

      if (docxBuffer) {
        const [
          { extractAllText },
          { injectPlaceholders, restoreRemovedPlaceholders },
        ] = await Promise.all([
          import("@/lib/template-preprocessor"),
          import("@/lib/docx-placeholder-injector"),
        ]);
        // The review buffer may already contain injected placeholders; running
        // the preprocessor again can collapse PDF-converted text runs.
        const activeFieldIds = new Set(fields.map((field) => field.id));
        const activeFieldNames = new Set(fields.map((field) => field.name));
        const removedFields: ReviewField[] = (template?.fields ?? [])
          .map((field) => ({
            id: field.id,
            name: field.name,
            label: field.label,
            type: field.type as FieldType,
            required: field.required,
            placeholder: field.placeholder,
            confidence: field.confidence,
            source: field.source as ReviewField["source"],
            targetText: field.targetText,
            contextText: field.contextText,
            replacementText: field.replacementText,
            originalPlaceholder: field.originalPlaceholder ?? field.placeholder,
            subFields: field.subFields?.map((subField) => ({
              id: subField.id,
              name: subField.name,
              label: subField.label,
              type: subField.type as FieldType,
              required: subField.required,
              placeholder: subField.placeholder,
              confidence: subField.confidence,
              source: subField.source as ReviewField["source"],
              targetText: subField.targetText,
              contextText: subField.contextText,
              replacementText: subField.replacementText,
              originalPlaceholder:
                subField.originalPlaceholder ?? subField.placeholder,
            })),
          }))
          .filter(
            (field) =>
              !activeFieldIds.has(field.id) && !activeFieldNames.has(field.name)
          );

        const reconciledBuffer = await restoreRemovedPlaceholders(
          docxBuffer,
          removedFields
        );
        const modifiedBuffer = await injectPlaceholders(
          reconciledBuffer,
          fields
        );

        try {
          updatePayload.previewText = await extractAllText(modifiedBuffer);
        } catch (err) {
          console.warn("[ReviewPage] previewText extraction failed:", err);
        }

        const formData = new FormData();
        formData.append(
          "file",
          new Blob([modifiedBuffer], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          `${template?.name ?? "template"}.docx`
        );
        formData.append("templateId", templateId);

        const saveRes = await fetch("/api/docx-save", {
          method: "POST",
          body: formData,
        });
        const saveJson = (await saveRes.json()) as {
          storageId?: string;
          fileUrl?: string;
          error?: string;
        };
        if (!saveRes.ok || !saveJson.storageId || !saveJson.fileUrl) {
          throw new Error(saveJson.error ?? "Failed to upload modified DOCX.");
        }

        updatePayload.storageId = saveJson.storageId;
        updatePayload.fileUrl = saveJson.fileUrl;
        setDocxBuffer(modifiedBuffer);
      }

      await updateTemplate(updatePayload);
      toast.success(
        fields.length > 0
          ? `${fields.length} field(s) confirmed — fill the document`
          : "Template confirmed — no fields to fill"
      );
      router.push(`/templates/${templateId}/fill`);
    } catch (err) {
      console.error("[ReviewPage] failed to save:", err);
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading / Not Found States ──────────────────────────────────
  if (template === undefined) {
    return (
      <div
        className="flex items-center justify-center h-dvh"
        style={{ background: "var(--bg)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2Icon
            className="w-6 h-6 animate-spin"
            style={{ color: "var(--accent-light)" }}
          />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Loading template…
          </p>
        </div>
      </div>
    );
  }

  if (template === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-dvh gap-4 p-8 text-center"
        style={{ background: "var(--bg)" }}
      >
        <AlertCircleIcon
          className="w-8 h-8"
          style={{ color: "var(--text-dim)" }}
        />
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Template not found
        </p>
        <Link
          href="/templates"
          className="text-xs"
          style={{ color: "var(--accent-light)" }}
        >
          ← Back to Templates
        </Link>
      </div>
    );
  }

  const totalFields = fields.length;
  const loopFields = fields.filter((f) => f.type === "loop").length;
  const sourceFileType = (template as { sourceFileType?: string })
    .sourceFileType;

  return (
    <div
      className="flex flex-col h-dvh overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <div className="h-12 sm:hidden shrink-0" />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 sm:px-5 h-11 shrink-0"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-sidebar)",
        }}
      >
        <button
          onClick={() => (window.location.href = "/templates")}
          className="flex items-center gap-1 text-[12px] font-medium shrink-0 cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Templates</span>
        </button>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>/</span>
        <span
          className="text-[13px] font-medium truncate flex-1 min-w-0"
          style={{ color: "var(--text-secondary)" }}
        >
          {template.name}
        </span>
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: "var(--warning-bg)",
            color: "var(--warning)",
            border:
              "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
          }}
        >
          Review
        </span>
      </div>

      {/* Info banner */}
      <div
        className="shrink-0 px-4 sm:px-5 py-3 flex items-start gap-3"
        style={{
          background: "var(--warning-bg)",
          borderBottom:
            "1px solid color-mix(in srgb, var(--warning) 18%, transparent)",
        }}
      >
        <InfoIcon
          className="w-4 h-4 shrink-0 mt-0.5"
          style={{ color: "var(--warning)" }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-[12px] font-medium"
            style={{ color: "var(--warning)" }}
          >
            {totalFields > 0
              ? `System detected ${totalFields} field(s) automatically`
              : "No fields auto-detected"}
          </p>
          <p
            className="text-[11px] leading-relaxed mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            {totalFields > 0
              ? "Review and edit detected fields. Select text in the document to add more. Click Confirm when ready."
              : "You can still select text in the preview to add fields manually."}
          </p>
        </div>
      </div>

      {/* Main split / tabs */}
      <div className="flex-1 overflow-hidden flex">
        <div className="hidden sm:flex flex-1 overflow-hidden">
          <div
            className="w-[380px] shrink-0 flex flex-col overflow-hidden"
            style={{ borderRight: "1px solid var(--border-subtle)" }}
          >
            <FieldListPanel
              fields={fields}
              totalFields={totalFields}
              loopFields={loopFields}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAdd={handleAdd}
              onConfirm={handleConfirm}
              saving={saving}
            />
          </div>
          <div
            className="flex-1 overflow-hidden relative"
            style={{ background: "var(--bg-muted)" }}
          >
            <LightDocxPreview
              docxBuffer={docxBuffer}
              fields={fields}
              onAddPlaceholder={handleAddPlaceholder}
              preferPdfPreview={sourceFileType === "pdf"}
            />
          </div>
        </div>

        <div className="flex sm:hidden flex-1 flex-col overflow-hidden">
          <div
            className="flex shrink-0"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            {(
              [
                {
                  id: "fields",
                  label: "Fields",
                  icon: <ListIcon className="w-3.5 h-3.5" />,
                },
                {
                  id: "preview",
                  label: "Document",
                  icon: <EyeIcon className="w-3.5 h-3.5" />,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-all"
                style={{
                  borderColor:
                    activeTab === tab.id
                      ? "var(--accent-light)"
                      : "transparent",
                  color:
                    activeTab === tab.id
                      ? "var(--accent-light)"
                      : "var(--text-dim)",
                  background: "var(--bg-sidebar)",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {activeTab === "fields" ? (
              <FieldListPanel
                fields={fields}
                totalFields={totalFields}
                loopFields={loopFields}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onAdd={handleAdd}
                onConfirm={handleConfirm}
                saving={saving}
              />
            ) : (
              <LightDocxPreview
                docxBuffer={docxBuffer}
                fields={fields}
                onAddPlaceholder={handleAddPlaceholder}
                preferPdfPreview={sourceFileType === "pdf"}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
