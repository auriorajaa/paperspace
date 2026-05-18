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
  ChevronDownIcon,
  RepeatIcon,
  GitBranchIcon,
  TypeIcon,
  CalendarIcon,
  HashIcon,
} from "lucide-react";
import LightDocxPreview, {
  type ReviewField,
  type FieldType,
} from "@/components/LightDocxPreview";

// ── Field type definitions ─────────────────────────────────────────

const FIELD_TYPE_OPTIONS = [
  {
    value: "text" as FieldType,
    label: "Text",
    shortLabel: "Text",
    desc: "Name, number, address, etc.",
    icon: TypeIcon,
    color: "var(--accent-light)",
    bg: "var(--accent-soft)",
    border: "var(--accent-border)",
  },
  {
    value: "date" as FieldType,
    label: "Date",
    shortLabel: "Date",
    desc: "Date or time",
    icon: CalendarIcon,
    color: "var(--success)",
    bg: "var(--success-bg)",
    border: "color-mix(in srgb, var(--success) 35%, transparent)",
  },
  {
    value: "loop" as FieldType,
    label: "Table / Loop",
    shortLabel: "Loop",
    desc: "Repeating rows — {{#name}}…{{/name}}",
    icon: RepeatIcon,
    color: "var(--field-loop, #4f46e5)",
    bg: "color-mix(in srgb, var(--field-loop, #4f46e5) 12%, transparent)",
    border: "color-mix(in srgb, var(--field-loop, #4f46e5) 30%, transparent)",
  },
  {
    value: "condition" as FieldType,
    label: "Condition (if)",
    shortLabel: "If",
    desc: "Show if value exists — {{#name}}…{{/name}}",
    icon: GitBranchIcon,
    color: "var(--field-condition, #db2777)",
    bg: "color-mix(in srgb, var(--field-condition, #db2777) 12%, transparent)",
    border:
      "color-mix(in srgb, var(--field-condition, #db2777) 30%, transparent)",
  },
  {
    value: "condition_inverse" as FieldType,
    label: "Condition (else)",
    shortLabel: "Else",
    desc: "Show if value is empty — {{^name}}…{{/name}}",
    icon: GitBranchIcon,
    color: "var(--field-condition, #db2777)",
    bg: "color-mix(in srgb, var(--field-condition, #db2777) 12%, transparent)",
    border:
      "color-mix(in srgb, var(--field-condition, #db2777) 30%, transparent)",
  },
] as const;

type FieldTypeOption = (typeof FIELD_TYPE_OPTIONS)[number];

function getTypeOption(type: FieldType): FieldTypeOption {
  return (
    (FIELD_TYPE_OPTIONS.find((o) => o.value === type) as FieldTypeOption) ??
    FIELD_TYPE_OPTIONS[0]
  );
}

function syntaxFor(name: string, type: FieldType): string {
  if (type === "loop") return `{{#${name}}} … {{/${name}}}`;
  if (type === "condition") return `{{#${name}}} … {{/${name}}}`;
  if (type === "condition_inverse") return `{{^${name}}} … {{/${name}}}`;
  return `{{${name}}}`;
}

// ── Helper functions ──────────────────────────────────────────────
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

function placeholderForType(name: string, type: FieldType): string {
  if (type === "loop" || type === "condition") {
    return `{{#${name}}}…{{/${name}}}`;
  }
  if (type === "condition_inverse") {
    return `{{^${name}}}…{{/${name}}}`;
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

// ── TypeSelect ────────────────────────────────────────────────────
// Uses position:fixed so the dropdown escapes ANY overflow:hidden/auto parent.
// Coordinates are recalculated from getBoundingClientRect() every open.
interface DropPos {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

function TypeSelect({
  value,
  onChange,
}: {
  value: FieldType;
  onChange: (v: FieldType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<DropPos>({ left: 0, width: 260 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const opt = getTypeOption(value);
  const Icon = opt.icon;

  const openDropdown = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const dropWidth = Math.max(rect.width, 260);
    // Estimated dropdown height for 5 options × ~64px + padding
    const dropHeight = FIELD_TYPE_OPTIONS.length * 64 + 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < dropHeight + 8;
    // Keep within viewport horizontally
    const rawLeft = rect.left;
    const clampedLeft = Math.min(rawLeft, window.innerWidth - dropWidth - 8);

    setDropPos({
      top: flipUp ? undefined : rect.bottom + 4,
      bottom: flipUp ? window.innerHeight - rect.top + 4 : undefined,
      left: Math.max(8, clampedLeft),
      width: dropWidth,
    });
    setOpen(true);
  };

  // Close on outside click / Escape / any scroll (so it doesn't detach from button)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150"
        style={{
          background: open
            ? `color-mix(in srgb, ${opt.bg} 200%, transparent)`
            : opt.bg,
          border: `1px solid ${open ? opt.color : opt.border}`,
          color: opt.color,
          boxShadow: open
            ? `0 0 0 3px color-mix(in srgb, ${opt.color} 12%, transparent)`
            : "none",
        }}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span className="flex-1 text-left font-semibold">{opt.label}</span>
        <ChevronDownIcon
          className="w-3 h-3 shrink-0 transition-transform duration-200"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: opt.color,
            opacity: 0.7,
          }}
        />
      </button>

      {open && (
        <div
          ref={dropRef}
          className="type-select-fixed-dropdown"
          style={{
            position: "fixed",
            top: dropPos.top,
            bottom: dropPos.bottom,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: "var(--popover)",
            border: "1px solid var(--accent-border)",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px rgba(99,102,241,0.06)",
          }}
        >
          {/* Dropdown header hint */}
          <div
            className="px-3.5 pt-2.5 pb-1.5"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <p
              className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: "var(--text-dim)" }}
            >
              Select Field Type
            </p>
          </div>

          <div className="py-1">
            {FIELD_TYPE_OPTIONS.map((o) => {
              const OIcon = o.icon;
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-all duration-100"
                  style={{
                    background: isSelected ? o.bg : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--accent-soft)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      isSelected ? o.bg : "transparent";
                  }}
                >
                  {/* Icon box */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: o.bg,
                      border: `1.5px solid ${o.border}`,
                      color: o.color,
                    }}
                  >
                    <OIcon className="w-3.5 h-3.5" />
                  </div>

                  {/* Label + desc */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[12px] font-semibold leading-tight"
                      style={{
                        color: isSelected ? o.color : "var(--text)",
                      }}
                    >
                      {o.label}
                    </p>
                    <p
                      className="text-[10px] mt-0.5 leading-relaxed"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {o.desc}
                    </p>
                  </div>

                  {/* Check indicator */}
                  {isSelected && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: o.color }}
                    >
                      <CheckIcon className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) labelInputRef.current?.focus();
  }, [editing]);

  // Auto-reset delete confirm after 2.5s
  useEffect(() => {
    if (!deleteConfirm) return;
    const t = setTimeout(() => setDeleteConfirm(false), 2500);
    return () => clearTimeout(t);
  }, [deleteConfirm]);

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

  const opt = getTypeOption(field.type);
  const Icon = opt.icon;
  const isStructural =
    field.type === "loop" ||
    field.type === "condition" ||
    field.type === "condition_inverse";

  return (
    <div
      className="field-row rounded-xl overflow-visible transition-all duration-200"
      style={{
        border: `1px solid ${
          field.isNew
            ? "color-mix(in srgb, var(--success) 40%, transparent)"
            : editing
              ? "var(--accent-border)"
              : "var(--border-subtle)"
        }`,
        background: field.isNew
          ? "var(--success-bg)"
          : editing
            ? "var(--accent-soft)"
            : "var(--bg-muted)",
        boxShadow: editing
          ? "0 0 0 3px color-mix(in srgb, var(--accent-light) 10%, transparent)"
          : "none",
      }}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        {/* Index badge */}
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 tabular-nums"
          style={{
            background: editing ? "var(--accent-soft)" : "var(--bg-input)",
            color: editing ? "var(--accent-light)" : "var(--text-dim)",
            border: `1px solid ${editing ? "var(--accent-border)" : "transparent"}`,
          }}
        >
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-2.5">
              <input
                ref={labelInputRef}
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
                placeholder="Field label…"
                className="text-sm rounded-lg px-3 py-2 outline-none w-full transition-all"
                style={{
                  background: "var(--bg-input)",
                  border: "1.5px solid var(--accent-border)",
                  color: "var(--text)",
                  boxShadow:
                    "0 0 0 3px color-mix(in srgb, var(--accent-light) 8%, transparent)",
                }}
              />
              <TypeSelect value={editType} onChange={setEditType} />

              {/* Syntax preview while editing */}
              {editLabel.trim() && (
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <span
                    className="text-[9px] font-medium uppercase tracking-wider shrink-0"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Preview
                  </span>
                  <code
                    className="text-[10px] font-mono truncate"
                    style={{ color: "var(--accent-light)" }}
                  >
                    {syntaxFor(toName(editLabel.trim()), editType)}
                  </code>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: "var(--accent-strong-bg)",
                    color: "var(--accent-pale)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  <CheckIcon className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all"
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
              {/* Label row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-sm font-semibold leading-tight"
                  style={{ color: "var(--text)" }}
                >
                  {field.label}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    background: opt.bg,
                    color: opt.color,
                    border: `1px solid ${opt.border}`,
                  }}
                >
                  <Icon className="w-2.5 h-2.5" />
                  {opt.shortLabel}
                </span>
                {field.isNew && (
                  <span className="new-badge text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    NEW
                  </span>
                )}
              </div>

              {/* Syntax chip */}
              <code
                className="inline-flex mt-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                style={{
                  background: "var(--bg-input)",
                  color: opt.color,
                  border: `1px solid ${opt.border}`,
                  opacity: 0.9,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "block",
                }}
              >
                {syntaxFor(field.name, field.type)}
              </code>

              {/* Loop subfields */}
              {field.type === "loop" &&
                field.subFields &&
                field.subFields.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {field.subFields.map((sf) => (
                      <code
                        key={sf.id}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: "var(--bg-input)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {`{{${sf.name}}}`}
                      </code>
                    ))}
                  </div>
                )}

              {/* Structural hint */}
              {isStructural && (
                <p
                  className="text-[10px] mt-1 leading-relaxed"
                  style={{ color: "var(--text-dim)" }}
                >
                  {field.type === "loop"
                    ? "Wrap table rows with this tag."
                    : field.type === "condition"
                      ? "Content shows when value exists / truthy."
                      : "Content shows when value is empty / falsy."}
                </p>
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
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:scale-105"
              style={{ color: "var(--text-dim)" }}
              title="Edit field"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--accent-soft)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "transparent")
              }
            >
              <PencilIcon className="w-3.5 h-3.5" />
            </button>

            {deleteConfirm ? (
              <button
                onClick={() => onDelete(field.id)}
                className="flex items-center gap-1 text-[10px] font-bold px-2 h-7 rounded-lg transition-all animate-in fade-in"
                style={{
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  border:
                    "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                }}
              >
                <TrashIcon className="w-3 h-3" />
                Delete?
              </button>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:scale-105"
                style={{ color: "var(--text-dim)" }}
                title="Delete field"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--danger-bg)";
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--danger)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-dim)";
                }}
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── AddFieldForm ──────────────────────────────────────────────────
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
        className="flex items-center gap-2 w-full px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 group"
        style={{
          background: "transparent",
          border: "1.5px dashed var(--border-hover)",
          color: "var(--text-dim)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--accent-border)";
          (e.currentTarget as HTMLElement).style.color = "var(--accent-light)";
          (e.currentTarget as HTMLElement).style.background =
            "var(--accent-soft)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--border-hover)";
          (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-border)",
          }}
        >
          <PlusIcon
            className="w-3 h-3"
            style={{ color: "var(--accent-light)" }}
          />
        </div>
        <span className="font-medium text-[13px]">Add field manually</span>
      </button>
    );
  }

  return (
    <div
      className="rounded-xl p-3.5 space-y-3"
      style={{
        background: "var(--bg-muted)",
        border: "1.5px solid var(--accent-border)",
        boxShadow:
          "0 0 0 3px color-mix(in srgb, var(--accent-light) 8%, transparent)",
      }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--accent-light)" }}
        >
          Add new field
        </p>
        <button
          onClick={() => {
            setOpen(false);
            setLabel("");
          }}
          className="w-5 h-5 flex items-center justify-center rounded transition-colors"
          style={{ color: "var(--text-dim)" }}
        >
          <XIcon className="w-3 h-3" />
        </button>
      </div>

      <input
        ref={inputRef}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Field label, e.g.: Client Name"
        className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
        style={{
          background: "var(--bg-input)",
          border: "1.5px solid var(--border-subtle)",
          color: "var(--text)",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--accent-border)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 0 0 3px color-mix(in srgb, var(--accent-light) 8%, transparent)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--border-subtle)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      />

      {/* Type select — renders fixed dropdown, escapes overflow */}
      <div>
        <p
          className="text-[9px] font-medium uppercase tracking-wider mb-1.5"
          style={{ color: "var(--text-dim)" }}
        >
          Field type
        </p>
        <TypeSelect value={type} onChange={setType} />
      </div>

      {/* Syntax preview */}
      {label.trim() && (
        <div
          className="rounded-lg px-3 py-2 flex items-center gap-2"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span
            className="text-[9px] font-medium uppercase tracking-wider shrink-0"
            style={{ color: "var(--text-dim)" }}
          >
            Preview
          </span>
          <code
            className="text-[10px] font-mono truncate"
            style={{ color: "var(--accent-light)" }}
          >
            {syntaxFor(toName(label.trim()), type)}
          </code>
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={handleAdd}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
          style={{
            background: "var(--accent-strong-bg)",
            color: "var(--accent-pale)",
            border: "1px solid var(--accent-border)",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background =
              "var(--accent-highlight-bg)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background =
              "var(--accent-strong-bg)")
          }
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add Field
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setLabel("");
          }}
          className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
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

// ── FieldListPanel ────────────────────────────────────────────────
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
  const textFields = fields.filter(
    (f) => f.type === "text" || f.type === "date"
  ).length;
  const condFields = fields.filter(
    (f) => f.type === "condition" || f.type === "condition_inverse"
  ).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats */}
      <div
        className="shrink-0 px-4 py-3 space-y-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <p
          className="text-[9px] font-medium uppercase tracking-widest px-0.5"
          style={{ color: "var(--text-dim)" }}
        >
          Template Summary
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: "Total",
              value: totalFields,
              color: "var(--accent-light)",
              bg: "var(--accent-soft)",
              border: "var(--accent-border)",
              icon: HashIcon,
            },
            {
              label: "Loop",
              value: loopFields,
              color: "var(--field-loop, #4f46e5)",
              bg: "color-mix(in srgb, var(--field-loop, #4f46e5) 12%, transparent)",
              border:
                "color-mix(in srgb, var(--field-loop, #4f46e5) 25%, transparent)",
              icon: RepeatIcon,
            },
            {
              label: "Condition",
              value: condFields,
              color: "var(--field-condition, #db2777)",
              bg: "color-mix(in srgb, var(--field-condition, #db2777) 12%, transparent)",
              border:
                "color-mix(in srgb, var(--field-condition, #db2777) 25%, transparent)",
              icon: GitBranchIcon,
            },
          ].map(({ label, value, color, bg, border, icon: StatIcon }) => (
            <div
              key={label}
              className="flex flex-col gap-1 px-3 py-2 rounded-xl"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[16px] font-bold tabular-nums leading-none"
                  style={{ color }}
                >
                  {value}
                </span>
                <StatIcon
                  className="w-3.5 h-3.5 shrink-0 opacity-50"
                  style={{ color }}
                />
              </div>
              <span
                className="text-[9px] font-medium uppercase tracking-wider"
                style={{ color }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Fields section header */}
      <div className="shrink-0 px-4 pt-3 pb-1.5 flex items-center gap-2">
        <p
          className="text-[9px] font-bold uppercase tracking-widest flex-1"
          style={{ color: "var(--text-dim)" }}
        >
          Fields
        </p>
        {totalFields > 0 && (
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent-light)",
              border: "1px solid var(--accent-border)",
            }}
          >
            {totalFields}
          </span>
        )}
      </div>

      {/* Field list — custom scrollbar via CSS class */}
      <div className="field-panel-scroll flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {fields.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--bg-input)" }}
            >
              <ScanIcon
                className="w-5 h-5"
                style={{ color: "var(--text-dim)", opacity: 0.5 }}
              />
            </div>
            <div>
              <p
                className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                No fields yet
              </p>
              <p
                className="text-[10px] mt-1 leading-relaxed"
                style={{ color: "var(--text-dim)" }}
              >
                Add manually or select text
                <br />
                in the document on the right.
              </p>
            </div>
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
        className="shrink-0 px-3 py-3 space-y-2 max-sm:pb-0"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        {/* Progress hint */}
        {totalFields > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: "var(--success-bg)",
              border:
                "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
            }}
          >
            <CheckIcon
              className="w-3 h-3 shrink-0"
              style={{ color: "var(--success)" }}
            />
            <p
              className="text-[10px] font-medium"
              style={{ color: "var(--success)" }}
            >
              {totalFields} fields ready to confirm
            </p>
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{
            background: saving
              ? "var(--accent-soft)"
              : "var(--accent-strong-bg)",
            color: saving ? "var(--text-dim)" : "var(--accent-pale)",
            border: `1.5px solid ${saving ? "var(--border-subtle)" : "var(--accent-border)"}`,
            boxShadow: saving
              ? "none"
              : "0 2px 8px color-mix(in srgb, var(--accent-light) 15%, transparent)",
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              (e.currentTarget as HTMLElement).style.background =
                "var(--accent-highlight-bg)";
              (e.currentTarget as HTMLElement).style.transform =
                "translateY(-1px)";
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 3px 10px color-mix(in srgb, var(--accent-light) 20%, transparent)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = saving
              ? "var(--accent-soft)"
              : "var(--accent-strong-bg)";
            (e.currentTarget as HTMLElement).style.transform = "";
            (e.currentTarget as HTMLElement).style.boxShadow = saving
              ? "none"
              : "0 2px 8px color-mix(in srgb, var(--accent-light) 15%, transparent)";
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
              Confirm &amp; Continue
              <ChevronRightIcon className="w-4 h-4" />
            </>
          )}
        </button>

        <p
          className="text-[10px] text-center"
          style={{ color: "var(--text-dim)" }}
        >
          Fields will be saved to template
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

  useEffect(() => {
    if (!template?.fileUrl) return;
    fetch(template.fileUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => setDocxBuffer(buf))
      .catch(() => toast.error("Failed to load document preview."));
  }, [template?.fileUrl]);

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
        toast.success(`Placeholder "${syntaxFor(name, type)}" added.`);
        return [...prev, newField];
      });
    },
    []
  );

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
        } catch {
          // non-fatal
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
          throw new Error(saveJson.error ?? "Failed to upload DOCX.");
        }

        updatePayload.storageId = saveJson.storageId;
        updatePayload.fileUrl = saveJson.fileUrl;
        setDocxBuffer(modifiedBuffer);
      }

      await updateTemplate(updatePayload);
      toast.success(
        fields.length > 0
          ? `${fields.length} fields confirmed — fill document`
          : "Template confirmed — no fields"
      );
      router.push(`/templates/${templateId}/fill`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save changes."
      );
    } finally {
      setSaving(false);
    }
  };

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
          className="flex items-center gap-1 text-[12px] font-medium shrink-0 cursor-pointer transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color =
              "var(--accent-light)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")
          }
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
          className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 uppercase tracking-wide"
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
        className="shrink-0 px-4 sm:px-5 py-2.5 flex items-center gap-3"
        style={{
          background: "var(--warning-bg)",
          borderBottom:
            "1px solid color-mix(in srgb, var(--warning) 18%, transparent)",
        }}
      >
        <InfoIcon
          className="w-4 h-4 shrink-0"
          style={{ color: "var(--warning)" }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-[12px] font-medium leading-snug"
            style={{ color: "var(--warning)" }}
          >
            {totalFields > 0
              ? `${totalFields} fields detected automatically — review and confirm`
              : "No fields detected — add fields manually"}
          </p>
          <p
            className="text-[10px] mt-0.5 hidden sm:block"
            style={{ color: "var(--text-muted)" }}
          >
            Select text in the document to add a new field.
          </p>
        </div>
      </div>

      {/* Main split / tabs */}
      <div className="flex-1 overflow-hidden flex">
        {/* Desktop: side-by-side */}
        <div className="hidden sm:flex flex-1 overflow-hidden">
          <div
            className="w-[360px] shrink-0 flex flex-col overflow-hidden"
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

        {/* Mobile: tabs */}
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
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all"
                style={{
                  borderBottom: `2px solid ${
                    activeTab === tab.id ? "var(--accent-light)" : "transparent"
                  }`,
                  color:
                    activeTab === tab.id
                      ? "var(--accent-light)"
                      : "var(--text-dim)",
                  background:
                    activeTab === tab.id
                      ? "var(--accent-soft)"
                      : "var(--bg-sidebar)",
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.id === "fields" && totalFields > 0 && (
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full ml-0.5"
                    style={{
                      background:
                        activeTab === "fields"
                          ? "var(--accent-strong-bg)"
                          : "var(--bg-input)",
                      color:
                        activeTab === "fields"
                          ? "var(--accent-pale)"
                          : "var(--text-dim)",
                    }}
                  >
                    {totalFields}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden max-sm:pb-16">
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
