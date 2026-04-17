"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CopyIcon, PlusIcon, XIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { TemplateField, FieldType, SubField } from "./FieldCard";
import { fieldTypeColors } from "@/lib/design-tokens";

const FIELD_CATEGORIES: {
  value: FieldType;
  label: string;
  description: string;
}[] = [
  {
    value: "text",
    label: "Merge Field",
    description: "Text, number, date, or any value",
  },
  {
    value: "loop",
    label: "Repeating Rows",
    description: "Table rows that repeat per data item",
  },
  {
    value: "condition",
    label: "Show / Hide",
    description: "Block shown only when condition is true",
  },
];

const MERGE_SUBTYPES: { value: FieldType; label: string; hint: string }[] = [
  { value: "text", label: "Text", hint: "Any free-form text" },
  { value: "date", label: "Date", hint: "Free-text date (any format)" },
  { value: "number", label: "Number", hint: "Numeric value" },
  { value: "email", label: "Email", hint: "Email address" },
];

function toName(label: string) {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function buildPlaceholder(name: string, type: FieldType): string {
  switch (type) {
    case "loop":
      return `{{#${name}}}…{{/${name}}}`;
    case "condition":
      return `{{#${name}}}…{{/${name}}}`;
    default:
      return `{{${name}}}`;
  }
}

interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (field: TemplateField) => void;
}

export function AddFieldDialog({
  open,
  onOpenChange,
  onAdd,
}: AddFieldDialogProps) {
  const [category, setCategory] = useState<FieldType>("text");
  const [subtype, setSubtype] = useState<FieldType>("text");
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(false);
  const [subFields, setSubFields] = useState<SubField[]>([]);
  const [newColLabel, setNewColLabel] = useState("");
  const [copied, setCopied] = useState(false);

  const name = toName(label);
  const effectiveType = category === "text" ? subtype : category;
  const placeholder = buildPlaceholder(name || "field_name", effectiveType);
  const color = fieldTypeColors[effectiveType] ?? "#6b7280";

  const reset = () => {
    setCategory("text");
    setSubtype("text");
    setLabel("");
    setRequired(true);
    setSubFields([]);
    setNewColLabel("");
  };

  const handleAdd = () => {
    if (!label.trim()) {
      toast.error("Field label is required.");
      return;
    }
    if (!name) {
      toast.error("Field name invalid. Use letters, numbers, or underscores.");
      return;
    }
    onAdd({
      id: `field_${Date.now()}`,
      name,
      label: label.trim(),
      type: effectiveType,
      required,
      placeholder,
      subFields: category === "loop" ? subFields : undefined,
    });
    toast.success("Field added");
    reset();
    onOpenChange(false);
  };

  const addSubField = () => {
    if (!newColLabel.trim()) return;
    const sfName = toName(newColLabel);
    setSubFields((prev) => [
      ...prev,
      {
        id: `sf_${Date.now()}`,
        name: sfName,
        label: newColLabel.trim(),
        type: "text",
        required: true,
        placeholder: `{{${sfName}}}`,
      },
    ]);
    setNewColLabel("");
  };

  const copyPlaceholder = () => {
    if (!name) return;
    navigator.clipboard.writeText(placeholder);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
    toast.success("Copied!");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "var(--text)" }}>Add field</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Category */}
          <div className="space-y-2">
            <p
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-dim)" }}
            >
              Field type
            </p>
            <div className="grid grid-cols-3 gap-2">
              {FIELD_CATEGORIES.map((ft) => {
                const c = fieldTypeColors[ft.value] ?? "#6b7280";
                const active = category === ft.value;
                return (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => setCategory(ft.value)}
                    className="flex flex-col items-start gap-1 p-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: active ? `${c}15` : "var(--bg-muted)",
                      border: `1px solid ${active ? `${c}35` : "var(--border-subtle)"}`,
                    }}
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: active ? c : "var(--text-dim)" }}
                    >
                      {ft.value}
                    </span>
                    <span
                      className="text-[11px] font-medium"
                      style={{
                        color: active ? "var(--text-secondary)" : "var(--text-muted)",
                      }}
                    >
                      {ft.label}
                    </span>
                    <span
                      className="text-[10px] leading-tight"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {ft.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtype for text */}
          {category === "text" && (
            <div className="space-y-2">
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-dim)" }}
              >
                Data format
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {MERGE_SUBTYPES.map((st) => {
                  const c = fieldTypeColors[st.value] ?? "#6b7280";
                  const active = subtype === st.value;
                  return (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => setSubtype(st.value)}
                      className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-center transition-all"
                      style={{
                        background: active
                          ? `${c}15`
                          : "var(--bg-muted)",
                        border: `1px solid ${active ? `${c}35` : "var(--border-subtle)"}`,
                      }}
                    >
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: active ? c : "var(--text-muted)" }}
                      >
                        {st.label}
                      </span>
                      <span
                        className="text-[9px]"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {st.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              {subtype === "date" && (
                <div
                  className="rounded-lg p-2.5"
                  style={{
                    background: "rgba(52,211,153,0.06)",
                    border: "1px solid rgba(52,211,153,0.15)",
                  }}
                >
                  <p className="text-[10px]" style={{ color: "#34d399" }}>
                    💡 Date is free-text — user types any format (e.g. "March
                    12, 2026" or "12/03/2026").
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Label + name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-dim)" }}
              >
                Label <span style={{ color: "#f87171" }}>*</span>
              </p>
              <input
                id="field-label"
                placeholder="e.g. Customer Name"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
                className="w-full h-9 rounded-xl px-3 text-sm outline-none"
                style={{
                  background: "var(--bg-muted)",
                  border: `1px solid var(--border-subtle)`,
                  color: "var(--text)",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.border = `1px solid ${color}40`)
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border = `1px solid var(--border-subtle)`)
                }
              />
            </div>
            <div className="space-y-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-dim)" }}
              >
                Field name (auto)
              </p>
              <div
                className="h-9 rounded-xl px-3 flex items-center"
                style={{
                  background: "var(--bg-muted)",
                  border: `1px solid var(--border-subtle)`,
                }}
              >
                <code
                  className="text-[11px] font-mono"
                  style={{ color: name ? "var(--accent-light)" : "var(--text-dim)" }}
                >
                  {name || "field_name"}
                </code>
              </div>
            </div>
          </div>

          {/* Required (not for condition) */}
          {category !== "condition" && (
            <button
              type="button"
              onClick={() => setRequired((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
              style={{
                background: required
                  ? "rgba(99,102,241,0.1)"
                  : "var(--bg-muted)",
                border: `1px solid ${required ? "rgba(99,102,241,0.25)" : "var(--border-subtle)"}`,
                color: required ? "var(--accent-light)" : "var(--text-muted)",
              }}
            >
              <div
                className="relative w-7 h-4 rounded-full transition-colors shrink-0"
                style={{
                  background: required
                    ? "rgba(99,102,241,0.4)"
                    : "var(--border-hover)",
                }}
              >
                <span
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
                  style={{
                    transform: required
                      ? "translateX(14px)"
                      : "translateX(2px)",
                  }}
                />
              </div>
              <span className="text-xs">Required field</span>
            </button>
          )}

          {/* Columns for loop */}
          {category === "loop" && (
            <div className="space-y-2">
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-dim)" }}
              >
                Columns (optional)
              </p>
              {subFields.length > 0 && (
                <div
                  className="space-y-1 rounded-xl p-2"
                  style={{
                    background: "var(--bg-muted)",
                    border: `1px solid var(--border-subtle)`,
                  }}
                >
                  {subFields.map((sf) => (
                    <div key={sf.id} className="flex items-center gap-2">
                      <span
                        className="flex-1 text-xs px-2 py-1 rounded-lg"
                        style={{
                          color: "var(--text-secondary)",
                          background: "var(--bg-muted)",
                        }}
                      >
                        {sf.label}
                      </span>
                      <code
                        className="text-[10px] font-mono shrink-0"
                        style={{ color: "var(--text-dim)" }}
                      >{`{{${sf.name}}}`}</code>
                      <button
                        type="button"
                        onClick={() =>
                          setSubFields((p) => p.filter((s) => s.id !== sf.id))
                        }
                        className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                        style={{ color: "var(--text-dim)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#f87171")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--text-dim)")
                        }
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  placeholder="Column name"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubField();
                    }
                  }}
                  className="flex-1 h-8 rounded-lg px-2.5 text-sm outline-none"
                  style={{
                    background: "var(--bg-muted)",
                    border: `1px solid var(--border-subtle)`,
                    color: "var(--text)",
                  }}
                />
                <button
                  type="button"
                  onClick={addSubField}
                  className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-medium"
                  style={{
                    background: "rgba(99,102,241,0.12)",
                    color: "var(--accent-light)",
                    border: `1px solid rgba(99,102,241,0.2)`,
                  }}
                >
                  <PlusIcon className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Syntax preview */}
          {label && (
            <div
              className="rounded-xl p-3 space-y-2"
              style={{
                background: `${color}08`,
                border: `1px solid ${color}20`,
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-dim)" }}
              >
                Paste this in the editor
              </p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-[11px] font-mono px-2.5 py-1.5 rounded-lg truncate"
                  style={{ background: "rgba(0,0,0,0.2)", color }}
                >
                  {placeholder}
                </code>
                <button
                  onClick={copyPlaceholder}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
                  style={{
                    background: "var(--bg-input)",
                    color: copied ? "#34d399" : "var(--text-muted)",
                    border: `1px solid var(--border-subtle)`,
                  }}
                >
                  {copied ? (
                    <CheckIcon className="w-3 h-3" />
                  ) : (
                    <CopyIcon className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(99,102,241,0.2)",
              color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.3)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(99,102,241,0.3)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(99,102,241,0.2)")
            }
          >
            Add field
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





