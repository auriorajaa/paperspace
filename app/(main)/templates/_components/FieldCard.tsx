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
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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

const TYPE_COLORS: Record<FieldType, string> = {
  text: "bg-blue-500/10 text-blue-600",
  date: "bg-green-500/10 text-green-600",
  number: "bg-orange-500/10 text-orange-600",
  email: "bg-purple-500/10 text-purple-600",
  loop: "bg-indigo-500/10 text-indigo-600",
  condition: "bg-pink-500/10 text-pink-600",
  condition_inverse: "bg-rose-500/10 text-rose-600",
};

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
      return `{{#if ${name}}}…{{/if ${name}}}`;
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

export function FieldCard({ field, onChange, onRemove }: FieldCardProps) {
  const [expanded, setExpanded] = useState(false);

  const updateField = (patch: Partial<TemplateField>) => {
    const updated = { ...field, ...patch };
    // Auto-update placeholder when name or type changes
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
    const subField: SubField = {
      id,
      name: "column",
      label: "Column",
      type: "text",
      required: true,
      placeholder: "{{column}}",
    };
    onChange({
      ...field,
      subFields: [...(field.subFields ?? []), subField],
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

  const copySyntax = () => {
    navigator.clipboard.writeText(field.placeholder);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Collapsed header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <GripVerticalIcon className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />

        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
            TYPE_COLORS[field.type]
          }`}
        >
          {field.type}
        </span>

        <span className="text-sm font-medium flex-1 truncate min-w-0">
          {field.label}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            copySyntax();
          }}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0"
          title="Copy syntax"
        >
          <CopyIcon className="w-3 h-3" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors shrink-0"
          title="Remove field"
        >
          <Trash2Icon className="w-3 h-3" />
        </button>

        {expanded ? (
          <ChevronDownIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRightIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          {/* Label */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Label
            </Label>
            <Input
              value={field.label}
              onChange={(e) => updateLabel(e.target.value)}
              placeholder="Field label"
              className="h-8 text-sm"
            />
          </div>

          {/* Name (auto) */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Field name
            </Label>
            <Input
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
              className="h-8 text-sm font-mono"
            />
          </div>

          {/* Type */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Type
            </Label>
            <Select
              value={field.type}
              onValueChange={(v) => updateField({ type: v as FieldType })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Required toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={field.required}
              onClick={() => updateField({ required: !field.required })}
              className={`relative w-8 h-4 rounded-full transition-colors ${
                field.required ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                  field.required ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-xs text-muted-foreground">Required</span>
          </div>

          {/* Syntax preview */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Syntax — paste this in the editor
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono bg-muted px-2 py-1.5 rounded-md text-foreground border border-border truncate">
                {field.placeholder}
              </code>
              <button
                onClick={copySyntax}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted border border-border transition-colors shrink-0"
                title="Copy"
              >
                <CopyIcon className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Sub-fields for loop */}
          {field.type === "loop" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Columns
                </Label>
                <button
                  onClick={addSubField}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  <PlusIcon className="w-3 h-3" />
                  Add column
                </button>
              </div>

              {(field.subFields ?? []).length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  No columns yet. Add columns to define the table structure.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {(field.subFields ?? []).map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-center gap-1.5 group/sf"
                    >
                      <Input
                        value={sf.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          const name = toName(label);
                          updateSubField(sf.id, { label, name });
                        }}
                        placeholder="Column name"
                        className="h-7 text-xs flex-1"
                      />
                      <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-1 rounded shrink-0">
                        {`{{${sf.name}}}`}
                      </code>
                      <button
                        onClick={() => removeSubField(sf.id)}
                        className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/sf:opacity-100 hover:text-destructive text-muted-foreground transition-all shrink-0"
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
