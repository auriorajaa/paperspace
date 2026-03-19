"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { TemplateField, FieldType, SubField } from "./FieldCard";

const FIELD_TYPES: {
  value: FieldType;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: "text",
    label: "Merge Field",
    description: "A single text, number, date, or email value",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  {
    value: "loop",
    label: "Repeating Rows",
    description: "A table or list that repeats for each row of data",
    color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  },
  {
    value: "condition",
    label: "Show / Hide",
    description: "Show a block of content only when a condition is true",
    color: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  },
];

const MERGE_SUBTYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
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
      return `{{#if ${name}}}…{{/if ${name}}}`;
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
  const [required, setRequired] = useState(true);
  const [subFields, setSubFields] = useState<SubField[]>([]);
  const [newColLabel, setNewColLabel] = useState("");

  const name = toName(label);
  const effectiveType = category === "text" ? subtype : category;
  const placeholder = buildPlaceholder(name || "field_name", effectiveType);

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
      toast.error(
        "Field name is invalid. Use letters, numbers, or underscores."
      );
      return;
    }

    const field: TemplateField = {
      id: `field_${Date.now()}`,
      name,
      label: label.trim(),
      type: effectiveType,
      required,
      placeholder,
      subFields: category === "loop" ? subFields : undefined,
    };

    onAdd(field);
    toast.success("Field added");
    reset();
    onOpenChange(false);
  };

  const addSubField = () => {
    if (!newColLabel.trim()) return;
    const id = `sf_${Date.now()}`;
    const sfName = toName(newColLabel);
    setSubFields((prev) => [
      ...prev,
      {
        id,
        name: sfName,
        label: newColLabel.trim(),
        type: "text",
        required: true,
        placeholder: `{{${sfName}}}`,
      },
    ]);
    setNewColLabel("");
  };

  const removeSubField = (id: string) => {
    setSubFields((prev) => prev.filter((sf) => sf.id !== id));
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
          <DialogTitle>Add field</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Field category */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Field type</Label>
            <div className="space-y-2">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  type="button"
                  onClick={() => setCategory(ft.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                    category === ft.value
                      ? `${ft.color} border-current`
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                      category === ft.value
                        ? ft.color
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {ft.value}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{ft.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {ft.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Merge sub-type */}
          {category === "text" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Data type</Label>
              <div className="flex gap-1.5 flex-wrap">
                {MERGE_SUBTYPES.map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setSubtype(st.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      subtype === st.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Label */}
          <div className="space-y-1.5">
            <Label htmlFor="field-label" className="text-xs font-semibold">
              Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-label"
              placeholder="e.g. Customer Name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
            {name && (
              <p className="text-[10px] text-muted-foreground">
                Field name:{" "}
                <code className="font-mono bg-muted px-1 rounded">{name}</code>
              </p>
            )}
          </div>

          {/* Required */}
          {category !== "condition" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={required}
                onClick={() => setRequired((v) => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors ${
                  required ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    required ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-xs text-muted-foreground">
                Required field
              </span>
            </div>
          )}

          {/* Columns for loop */}
          {category === "loop" && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Columns (optional)
              </Label>
              {subFields.length > 0 && (
                <div className="space-y-1">
                  {subFields.map((sf) => (
                    <div key={sf.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 px-2 py-1 bg-muted rounded-md">
                        {sf.label}
                      </span>
                      <code className="text-[10px] font-mono text-muted-foreground">
                        {`{{${sf.name}}}`}
                      </code>
                      <button
                        type="button"
                        onClick={() => removeSubField(sf.id)}
                        className="w-5 h-5 rounded flex items-center justify-center hover:text-destructive text-muted-foreground"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Column name"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubField();
                    }
                  }}
                  className="h-8 text-sm flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addSubField}
                  className="h-8 gap-1"
                >
                  <PlusIcon className="w-3 h-3" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Syntax preview */}
          {label && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Paste this in the editor
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] font-mono bg-background border border-border px-2 py-1.5 rounded-md text-foreground truncate">
                  {placeholder}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(placeholder);
                    toast.success("Copied!");
                  }}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted border border-border transition-colors shrink-0"
                >
                  <CopyIcon className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
