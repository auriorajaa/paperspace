"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  Trash2Icon,
  GripVerticalIcon,
  PlusIcon,
  XIcon,
  CheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { colors, fieldTypeColors } from "@/lib/design-tokens";

export type FieldType =
  | "text"
  | "date"
  | "number"
  | "email"
  | "loop"
  | "condition"
  | "condition_inverse";

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
  subFields?: SubField[];
}

export interface SubField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "loop", label: "Repeating Rows" },
  { value: "condition", label: "Show/Hide" },
];

function buildPlaceholder(name: string, type: FieldType): string {
  switch (type) {
    case "loop":
      return `{{#${name}}}…{{/${name}}}`;
    case "condition":
      return `{{#${name}}}…{{/${name}}}`;
    case "condition_inverse":
      return `{{^${name}}}…{{/${name}}}`;
    default:
      return `{{${name}}}`;
  }
}

function toName(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

interface FieldCardProps {
  field: TemplateField;
  onChange: (updated: TemplateField) => void;
  onRemove: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
        toast.success("Copied");
      }}
      className="w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0"
      style={{ color: copied ? "#34d399" : colors.textDim }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      title="Copy syntax"
    >
      {copied ? (
        <CheckIcon className="w-3 h-3" />
      ) : (
        <CopyIcon className="w-3 h-3" />
      )}
    </button>
  );
}

export function FieldCard({ field, onChange, onRemove }: FieldCardProps) {
  const [expanded, setExpanded] = useState(false);

  const color = fieldTypeColors[field.type] ?? "#6b7280";

  const updateField = (patch: Partial<TemplateField>) => {
    const updated = { ...field, ...patch };
    if (patch.name !== undefined || patch.type !== undefined) {
      updated.placeholder = buildPlaceholder(
        patch.name ?? field.name,
        patch.type ?? field.type
      );
    }
    onChange(updated);
  };

  const updateLabel = (label: string) => {
    const name = toName(label);
    updateField({
      label,
      name,
      placeholder: buildPlaceholder(name, field.type),
    });
  };

  const addSubField = () => {
    const id = `sf_${Date.now()}`;
    onChange({
      ...field,
      subFields: [
        ...(field.subFields ?? []),
        {
          id,
          name: "column",
          label: "Column",
          type: "text",
          required: false,
          placeholder: "{{column}}",
        },
      ],
    });
  };

  const updateSubField = (sfId: string, patch: Partial<SubField>) => {
    onChange({
      ...field,
      subFields: (field.subFields ?? []).map((sf) =>
        sf.id === sfId
          ? {
              ...sf,
              ...patch,
              placeholder:
                patch.name !== undefined ? `{{${patch.name}}}` : sf.placeholder,
            }
          : sf
      ),
    });
  };

  const removeSubField = (sfId: string) => {
    onChange({
      ...field,
      subFields: (field.subFields ?? []).filter((sf) => sf.id !== sfId),
    });
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${expanded ? `${color}25` : colors.border}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors"
        style={{ background: expanded ? `${color}08` : "transparent" }}
        onClick={() => setExpanded((v) => !v)}
        onMouseEnter={(e) => {
          if (!expanded)
            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.background = "transparent";
        }}
      >
        <GripVerticalIcon
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: "rgba(255,255,255,0.15)" }}
        />

        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0"
          style={{
            background: `${color}18`,
            color,
            border: `1px solid ${color}30`,
          }}
        >
          {field.type}
        </span>

        <span
          className="text-sm font-medium flex-1 truncate"
          style={{ color: colors.text }}
        >
          {field.label}
        </span>

        <code
          className="hidden sm:block text-[10px] font-mono shrink-0"
          style={{ color: colors.textDim }}
        >
          {field.placeholder.length > 24
            ? field.placeholder.slice(0, 24) + "…"
            : field.placeholder}
        </code>

        <CopyButton text={field.placeholder} />

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0"
          style={{ color: colors.textDim }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(248,113,113,0.12)";
            e.currentTarget.style.color = "#f87171";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = colors.textDim;
          }}
          title="Remove field"
        >
          <Trash2Icon className="w-3 h-3" />
        </button>

        {expanded ? (
          <ChevronDownIcon
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: colors.textDim }}
          />
        ) : (
          <ChevronRightIcon
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: colors.textDim }}
          />
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div
          className="px-3 pb-3 space-y-3"
          style={{ borderTop: `1px solid ${color}20` }}
        >
          <div className="pt-3 grid grid-cols-2 gap-3">
            {/* Label */}
            <div className="space-y-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: colors.textDim }}
              >
                Label
              </p>
              <input
                value={field.label}
                onChange={(e) => updateLabel(e.target.value)}
                placeholder="Field label"
                className="w-full h-8 rounded-lg px-2.5 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.border = `1px solid ${color}40`)
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.border}`)
                }
              />
            </div>

            {/* Field name */}
            <div className="space-y-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: colors.textDim }}
              >
                Field name
              </p>
              <input
                value={field.name}
                onChange={(e) =>
                  updateField({
                    name: e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "_")
                      .replace(/[^a-z0-9_]/g, ""),
                  })
                }
                placeholder="field_name"
                className="w-full h-8 rounded-lg px-2.5 text-sm font-mono outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.border = `1px solid ${color}40`)
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.border}`)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Type */}
            <div className="space-y-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: colors.textDim }}
              >
                Type
              </p>
              <select
                value={field.type}
                onChange={(e) =>
                  updateField({ type: e.target.value as FieldType })
                }
                className="w-full h-8 rounded-lg px-2.5 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              >
                {FIELD_TYPES.map((t) => (
                  <option
                    key={t.value}
                    value={t.value}
                    style={{ background: "#18181d" }}
                  >
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Required */}
            <div className="space-y-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: colors.textDim }}
              >
                Required
              </p>
              <button
                type="button"
                onClick={() => updateField({ required: !field.required })}
                className="flex items-center gap-2 h-8 px-2.5 rounded-lg transition-all"
                style={{
                  background: field.required
                    ? `${color}15`
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${field.required ? `${color}30` : colors.border}`,
                  color: field.required ? color : colors.textMuted,
                }}
              >
                <div
                  className="relative w-7 h-4 rounded-full transition-colors"
                  style={{
                    background: field.required
                      ? `${color}40`
                      : "rgba(255,255,255,0.1)",
                  }}
                >
                  <span
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
                    style={{
                      transform: field.required
                        ? "translateX(14px)"
                        : "translateX(2px)",
                    }}
                  />
                </div>
                <span className="text-xs">{field.required ? "Yes" : "No"}</span>
              </button>
            </div>
          </div>

          {/* Date format hint */}
          {field.type === "date" && (
            <div
              className="rounded-xl p-2.5"
              style={{
                background: "rgba(52,211,153,0.06)",
                border: "1px solid rgba(52,211,153,0.15)",
              }}
            >
              <p className="text-[10px]" style={{ color: "#34d399" }}>
                💡 Date is free-text. User can type any format: "March 12,
                2026", "12/03/2026", "2026-03-12", etc.
              </p>
            </div>
          )}

          {/* Syntax */}
          <div className="space-y-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: colors.textDim }}
            >
              Syntax — paste in editor
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 text-[11px] font-mono px-2.5 py-1.5 rounded-lg truncate"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: "#a5b4fc",
                }}
              >
                {field.placeholder}
              </code>
              <CopyButton text={field.placeholder} />
            </div>
          </div>

          {/* Sub-fields for loop */}
          {field.type === "loop" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: colors.textDim }}
                >
                  Columns
                </p>
                <button
                  onClick={addSubField}
                  className="flex items-center gap-1 text-[10px] font-medium transition-colors"
                  style={{ color: colors.accentLight }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <PlusIcon className="w-3 h-3" />
                  Add column
                </button>
              </div>

              {(field.subFields ?? []).length === 0 ? (
                <p className="text-[10px]" style={{ color: colors.textDim }}>
                  No columns yet — add columns to define the repeating table
                  structure.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {(field.subFields ?? []).map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-center gap-2 group/sf"
                    >
                      <input
                        value={sf.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          updateSubField(sf.id, { label, name: toName(label) });
                        }}
                        placeholder="Column name"
                        className="flex-1 h-7 rounded-lg px-2 text-xs outline-none"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${colors.border}`,
                          color: colors.text,
                        }}
                      />
                      <code
                        className="text-[10px] font-mono shrink-0"
                        style={{ color: colors.textDim }}
                      >
                        {`{{${sf.name}}}`}
                      </code>
                      <button
                        onClick={() => removeSubField(sf.id)}
                        className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/sf:opacity-100 transition-all shrink-0"
                        style={{ color: colors.textDim }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#f87171";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = colors.textDim;
                        }}
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
