"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  ChevronLeftIcon,
  AlertCircleIcon,
  DownloadIcon,
  UploadIcon,
  PencilIcon,
  FileTextIcon,
  PlusIcon,
  XIcon,
  TagIcon,
  InfoIcon,
  CheckIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  TableIcon,
  HashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  FileSpreadsheetIcon,
  RefreshCwIcon,
  GripVerticalIcon,
  EyeOffIcon,
  EyeIcon,
  CircleCheckIcon,
  CircleIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import type { TemplateField } from "../../_components/FieldCard";
import { fieldTypeColors } from "@/lib/design-tokens";
import { useAuth } from "@clerk/nextjs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConditionGroup {
  conditionField: TemplateField;
  innerFields: TemplateField[];
}

// ── Business logic helpers ────────────────────────────────────────────────────

/**
 * Given template preview text and a condition field name,
 * return the list of {{field}} names found inside the condition block.
 */
function getConditionInnerFieldNames(
  previewText: string,
  conditionName: string
): Set<string> {
  const result = new Set<string>();
  // Match {{#conditionName}} ... {{/conditionName}} or {{^conditionName}} ... {{/conditionName}}
  const openRe = new RegExp(
    `\\{\\{[#^]\\s*${conditionName}\\s*\\}\\}([\\s\\S]*?)\\{\\{/\\s*${conditionName}\\s*\\}\\}`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(previewText)) !== null) {
    const inner = m[1];
    const fieldRe = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(inner)) !== null) {
      result.add(fm[1].toLowerCase().replace(/[^a-z0-9_]/g, ""));
    }
  }
  return result;
}

/**
 * Build the complete field hierarchy:
 * - trueSimpleFields: standalone fields (not inside any loop or condition)
 * - loopFields: loop fields (already have sub-fields)
 * - conditionGroups: each condition + its inner fields
 */
function buildFieldHierarchy(
  fields: TemplateField[],
  previewText: string
): {
  trueSimpleFields: TemplateField[];
  loopFields: TemplateField[];
  conditionGroups: ConditionGroup[];
} {
  // 1. Collect all sub-field names from loops (to exclude from simple fields)
  const loopSubNames = new Set(
    fields
      .filter((f) => f.type === "loop")
      .flatMap((f) => (f.subFields ?? []).map((sf) => sf.name))
  );

  // 2. Find condition fields and their inner field names
  const conditionFields = fields.filter(
    (f) => f.type === "condition" || f.type === "condition_inverse"
  );
  const loopFields = fields.filter((f) => f.type === "loop");

  // For each condition, find inner field names from the template text
  const conditionGroups: ConditionGroup[] = [];
  const conditionInnerNames = new Set<string>();

  if (previewText) {
    for (const cf of conditionFields) {
      const innerNames = getConditionInnerFieldNames(previewText, cf.name);
      innerNames.forEach((n) => conditionInnerNames.add(n));
      const innerFields = fields.filter(
        (f) =>
          innerNames.has(f.name) &&
          f.type !== "loop" &&
          f.type !== "condition" &&
          f.type !== "condition_inverse"
      );
      conditionGroups.push({ conditionField: cf, innerFields });
    }
  } else {
    // No preview text — just show condition fields with no inner grouping
    for (const cf of conditionFields) {
      conditionGroups.push({ conditionField: cf, innerFields: [] });
    }
  }

  // 3. Simple fields = all text/date/number/email fields that are NOT
  //    - sub-fields of a loop
  //    - inner fields of a condition block
  const trueSimpleFields = fields.filter(
    (f) =>
      f.type !== "loop" &&
      f.type !== "condition" &&
      f.type !== "condition_inverse" &&
      !loopSubNames.has(f.name) &&
      !conditionInnerNames.has(f.name)
  );

  return { trueSimpleFields, loopFields, conditionGroups };
}

// ── Progress pill ─────────────────────────────────────────────────────────────

function ProgressPill({ filled, total }: { filled: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--bg-input)", minWidth: 60 }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background:
              pct === 100
                ? "linear-gradient(90deg, var(--success), color-mix(in srgb, var(--success) 70%, white))"
                : "linear-gradient(90deg, var(--primary), var(--accent-light))",
          }}
        />
      </div>
      <span
        className="text-[11px] font-medium tabular-nums shrink-0"
        style={{ color: pct === 100 ? "var(--success)" : "var(--text-muted)" }}
      >
        {filled}/{total}
      </span>
    </div>
  );
}

// ── Field Input ───────────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
  accent = "var(--accent-border)",
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
  accent?: string;
}) {
  const baseInput = {
    background: "var(--bg-muted)",
    border: `1px solid var(--border-subtle)`,
    color: "var(--text)",
  };

  if (field.type === "condition" || field.type === "condition_inverse") {
    return (
      <div className="flex gap-2">
        {[
          {
            val: "true",
            label: "Show block",
            icon: <EyeIcon className="w-3 h-3" />,
          },
          {
            val: "false",
            label: "Hide block",
            icon: <EyeOffIcon className="w-3 h-3" />,
          },
        ].map(({ val, label, icon }) => {
          const active = (value ?? "true") === val;
          const isShow = val === "true";
          return (
            <button
              key={val}
              type="button"
              onClick={() => onChange(val)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: active
                  ? isShow
                    ? "var(--success-bg)"
                    : "var(--danger-bg)"
                  : "var(--bg-muted)",
                color: active
                  ? isShow
                    ? "var(--success)"
                    : "var(--danger)"
                  : "var(--text-muted)",
                border: `1px solid ${active ? (isShow ? "color-mix(in srgb, var(--success) 25%, transparent)" : "color-mix(in srgb, var(--danger) 20%, transparent)") : "var(--border-subtle)"}`,
              }}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        placeholder="0"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none"
        style={baseInput}
        onFocus={(e) => (e.currentTarget.style.border = `1px solid ${accent}`)}
        onBlur={(e) =>
          (e.currentTarget.style.border = `1px solid var(--border-subtle)`)
        }
      />
    );
  }

  if (field.type === "email") {
    return (
      <input
        type="email"
        placeholder="name@example.com"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none"
        style={baseInput}
        onFocus={(e) => (e.currentTarget.style.border = `1px solid ${accent}`)}
        onBlur={(e) =>
          (e.currentTarget.style.border = `1px solid var(--border-subtle)`)
        }
      />
    );
  }

  // text + date
  return (
    <div className="space-y-1">
      <input
        type="text"
        placeholder={
          field.type === "date"
            ? "e.g. 12 Maret 2026"
            : `Enter ${field.label.toLowerCase()}…`
        }
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none"
        style={baseInput}
        onFocus={(e) => (e.currentTarget.style.border = `1px solid ${accent}`)}
        onBlur={(e) =>
          (e.currentTarget.style.border = `1px solid var(--border-subtle)`)
        }
      />
      {field.type === "date" && (
        <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
          Any format — will appear exactly as typed
        </p>
      )}
    </div>
  );
}

// ── Field item (label + input) ────────────────────────────────────────────────

function FieldItem({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
}) {
  const color = fieldTypeColors[field.type] ?? "var(--text-muted)";
  const isFilled =
    field.type === "condition" || field.type === "condition_inverse"
      ? true
      : !!value?.trim();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label
          className="text-[12px] font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {field.label}
        </label>
        <div className="ml-auto flex items-center gap-1">
          {/* Filled indicator */}
          {isFilled ? (
            <CircleCheckIcon
              className="w-3 h-3"
              style={{ color: "var(--success)" }}
            />
          ) : null}
          {/* Type badge for non-text fields */}
          {field.type !== "text" && (
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded-md"
              style={{
                background: `${color}12`,
                color,
                border: `1px solid ${color}20`,
              }}
            >
              {field.type}
            </span>
          )}
        </div>
      </div>
      <FieldInput field={field} value={value} onChange={onChange} />
    </div>
  );
}

// ── Loop section ──────────────────────────────────────────────────────────────

function LoopSection({
  field,
  rows,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
}: {
  field: TemplateField;
  rows: Record<string, string>[];
  onAddRow: () => void;
  onUpdateRow: (idx: number, key: string, val: string) => void;
  onRemoveRow: (idx: number) => void;
}) {
  const subFields = field.subFields ?? [];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid var(--accent-border)` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{
          background: "var(--accent-bg)",
          borderBottom:
            rows.length > 0 ? "1px solid var(--accent-border)" : "none",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-soft)" }}
          >
            <TableIcon
              className="w-3.5 h-3.5"
              style={{ color: "var(--accent-light)" }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p
                className="text-[13px] font-semibold"
                style={{ color: "var(--text)" }}
              >
                {field.label}
              </p>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent-light)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                {rows.length} row{rows.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
              Each row creates one repeated block in the document
            </p>
          </div>
        </div>
        <button
          onClick={onAddRow}
          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-xl shrink-0 transition-all"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent-light)",
            border: "1px solid var(--accent-border)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--accent-mid)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--accent-soft)")
          }
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add row</span>
        </button>
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <button
          onClick={onAddRow}
          className="w-full flex flex-col items-center justify-center py-10 transition-all"
          style={{ background: "transparent" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--accent-bg)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
            style={{
              background: "var(--accent-bg)",
              border: "2px dashed var(--accent-border)",
            }}
          >
            <PlusIcon
              className="w-4 h-4"
              style={{ color: "var(--accent-light)", opacity: 0.6 }}
            />
          </div>
          <p
            className="text-[12px] font-medium"
            style={{ color: "var(--accent-light)", opacity: 0.7 }}
          >
            Add the first row
          </p>
          {subFields.length > 0 && (
            <p
              className="text-[11px] mt-1"
              style={{ color: "var(--text-dim)" }}
            >
              Columns: {subFields.map((sf) => sf.label).join(", ")}
            </p>
          )}
        </button>
      ) : (
        <div
          className="divide-y"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {/* Column headers — desktop */}
          {subFields.length > 0 && (
            <div
              className="hidden sm:grid gap-3 px-4 py-2"
              style={{
                gridTemplateColumns: `28px repeat(${subFields.length}, 1fr) 28px`,
                background: "var(--bg-muted)",
              }}
            >
              <span />
              {subFields.map((sf) => (
                <p
                  key={sf.id}
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-dim)" }}
                >
                  {sf.label}
                </p>
              ))}
              <span />
            </div>
          )}

          {/* Rows */}
          {rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="flex items-start sm:items-center gap-2 sm:gap-3 px-4 py-3 group"
              style={{ background: "var(--bg-muted)" }}
            >
              <span
                className="text-[10px] font-mono w-6 text-center shrink-0 mt-2.5 sm:mt-0"
                style={{ color: "var(--text-dim)" }}
              >
                {rowIdx + 1}
              </span>

              {subFields.length > 0 ? (
                /* Desktop: grid, Mobile: stack */
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {subFields.map((sf) => (
                    <div key={sf.name} className="space-y-1 sm:space-y-0">
                      {/* Mobile label */}
                      <p
                        className="text-[10px] font-medium sm:hidden"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {sf.label}
                      </p>
                      <input
                        type="text"
                        placeholder={sf.label}
                        value={row[sf.name] ?? ""}
                        onChange={(e) =>
                          onUpdateRow(rowIdx, sf.name, e.target.value)
                        }
                        className="w-full rounded-lg px-2.5 py-2 text-[12px] outline-none"
                        style={{
                          background: "var(--bg-muted)",
                          border: `1px solid var(--border-subtle)`,
                          color: "var(--text)",
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.border =
                            "1px solid var(--accent-border)")
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.border = `1px solid var(--border-subtle)`)
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  className="flex-1 text-[12px]"
                  style={{ color: "var(--text-dim)" }}
                >
                  No sub-fields.{" "}
                  <Link
                    href={`/templates/${field.id}/edit`}
                    style={{ color: "var(--accent-light)" }}
                  >
                    Re-scan in editor.
                  </Link>
                </p>
              )}

              <button
                onClick={() => onRemoveRow(rowIdx)}
                className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center transition-all shrink-0"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--danger-bg)";
                  e.currentTarget.style.color = "var(--danger)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-dim)";
                }}
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Add more */}
          <button
            onClick={onAddRow}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[12px] transition-all min-h-[44px]"
            style={{
              color: "var(--text-dim)",
              background: "var(--accent-bg)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-soft)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--accent-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent-bg)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text-dim)";
            }}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add another row
          </button>
        </div>
      )}
    </div>
  );
}

// ── Condition section ─────────────────────────────────────────────────────────

function ConditionSection({
  group,
  conditionValue,
  fieldValues,
  onConditionChange,
  onFieldChange,
}: {
  group: ConditionGroup;
  conditionValue: string;
  fieldValues: Record<string, string>;
  onConditionChange: (v: string) => void;
  onFieldChange: (name: string, v: string) => void;
}) {
  const { conditionField, innerFields } = group;
  const isShown = conditionValue !== "false";

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${isShown ? "var(--field-condition)" : "var(--border-subtle)"}`,
        borderColor: isShown
          ? "var(--field-condition)"
          : "var(--border-subtle)",
      }}
    >
      {/* Toggle header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: isShown
            ? "color-mix(in srgb, var(--field-condition) 8%, transparent)"
            : "var(--bg-muted)",
          borderBottom:
            isShown && innerFields.length > 0
              ? "1px solid color-mix(in srgb, var(--field-condition) 15%, transparent)"
              : "none",
        }}
      >
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: isShown
              ? "color-mix(in srgb, var(--field-condition) 12%, transparent)"
              : "var(--bg-muted)",
          }}
        >
          <ToggleLeftIcon
            className="w-3.5 h-3.5"
            style={{
              color: isShown ? "var(--field-condition)" : "var(--text-dim)",
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[13px] font-semibold"
            style={{ color: isShown ? "var(--text)" : "var(--text-muted)" }}
          >
            {conditionField.label}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            {isShown
              ? innerFields.length > 0
                ? `This section will appear in the document`
                : "This block will be shown"
              : "This block will be hidden in the document"}
          </p>
        </div>
        {/* Toggle buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {[
            {
              val: "true",
              label: "Show",
              icon: <EyeIcon className="w-3 h-3" />,
            },
            {
              val: "false",
              label: "Hide",
              icon: <EyeOffIcon className="w-3 h-3" />,
            },
          ].map(({ val, label, icon }) => {
            const active = (conditionValue ?? "true") === val;
            const isShow = val === "true";
            return (
              <button
                key={val}
                onClick={() => onConditionChange(val)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all min-h-[44px]"
                style={{
                  background: active
                    ? isShow
                      ? "var(--success-bg)"
                      : "var(--danger-bg)"
                    : "var(--bg-muted)",
                  color: active
                    ? isShow
                      ? "var(--success)"
                      : "var(--danger)"
                    : "var(--text-dim)",
                  border: `1px solid ${active ? (isShow ? "color-mix(in srgb, var(--success) 25%, transparent)" : "color-mix(in srgb, var(--danger) 20%, transparent)") : "var(--border-subtle)"}`,
                }}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inner fields — only when shown and fields exist */}
      {isShown && innerFields.length > 0 && (
        <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {innerFields.map((f) => (
            <FieldItem
              key={f.id}
              field={f}
              value={fieldValues[f.name] ?? ""}
              onChange={(v) => onFieldChange(f.name, v)}
            />
          ))}
        </div>
      )}

      {/* Hidden message */}
      {!isShown && (
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ background: "var(--bg-muted)" }}
        >
          <EyeOffIcon
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: "var(--text-dim)" }}
          />
          <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            The contents of this section will not appear in the generated
            document.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Generate button ───────────────────────────────────────────────────────────

function GenerateButton({
  onClick,
  loading,
  disabled,
}: {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-semibold transition-all"
      style={{
        background:
          loading || disabled ? "var(--accent-bg)" : "var(--accent-strong-bg)",
        color: loading || disabled ? "var(--text-muted)" : "var(--accent-pale)",
        border: `1px solid ${loading || disabled ? "var(--accent-border)" : "var(--accent-border)"}`,
        cursor: loading || disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!loading && !disabled) {
          e.currentTarget.style.background = "var(--accent-mid)";
          e.currentTarget.style.boxShadow = "0 0 20px var(--accent-bg)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--accent-strong-bg)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {loading ? (
        <>
          <div
            className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent-light)" }}
          />
          Generating…
        </>
      ) : (
        <>
          <DownloadIcon className="w-4 h-4" />
          Generate & Download
        </>
      )}
    </button>
  );
}

// ── Fields overview sidebar ───────────────────────────────────────────────────

function FieldsOverviewSidebar({
  trueSimpleFields,
  loopFields,
  conditionGroups,
  values,
  loopRows,
}: {
  trueSimpleFields: TemplateField[];
  loopFields: TemplateField[];
  conditionGroups: ConditionGroup[];
  values: Record<string, string>;
  loopRows: Record<string, Record<string, string>[]>;
}) {
  const allItems: { label: string; filled: boolean; type?: string }[] = [
    ...trueSimpleFields.map((f) => ({
      label: f.label,
      filled:
        f.type === "condition" || f.type === "condition_inverse"
          ? true
          : !!values[f.name]?.trim(),
      type: f.type !== "text" ? f.type : undefined,
    })),
    ...loopFields.map((f) => ({
      label: f.label,
      filled: (loopRows[f.name]?.length ?? 0) > 0,
      type: "loop",
    })),
    ...conditionGroups.map(({ conditionField, innerFields }) => ({
      label: conditionField.label,
      filled: true,
      type: "condition",
    })),
  ];

  const filled = allItems.filter((i) => i.filled).length;

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{
          background: "var(--bg-card)",
          border: `1px solid var(--border-subtle)`,
        }}
      >
        <div className="flex items-center justify-between">
          <p
            className="text-[12px] font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Progress
          </p>
          <span
            className="text-[11px] font-medium"
            style={{
              color:
                filled === allItems.length
                  ? "var(--success)"
                  : "var(--text-muted)",
            }}
          >
            {filled}/{allItems.length} ready
          </span>
        </div>
        <ProgressPill filled={filled} total={allItems.length} />

        <div className="space-y-1.5 pt-1">
          {allItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: item.filled
                    ? item.type === "loop"
                      ? "var(--accent-light)"
                      : item.type === "condition"
                        ? "var(--field-condition)"
                        : "var(--success)"
                    : "var(--border-hover)",
                }}
              />
              <span
                className="flex-1 text-[11px] truncate"
                style={{
                  color: item.filled
                    ? "var(--text-secondary)"
                    : "var(--text-muted)",
                }}
              >
                {item.label}
              </span>
              {item.filled ? (
                <CheckIcon
                  className="w-3 h-3 shrink-0"
                  style={{ color: "var(--success)", opacity: 0.7 }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Single Form ───────────────────────────────────────────────────────────────

function SingleForm({
  fields,
  templateId,
  templateName,
  fileUrl,
  previewText,
}: {
  fields: TemplateField[];
  templateId: Id<"templates">;
  templateName: string;
  fileUrl: string;
  previewText?: string;
}) {
  const saveGenerated = useMutation(api.templates.saveGeneratedDocument);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loopRows, setLoopRows] = useState<
    Record<string, Record<string, string>[]>
  >({});
  const [generating, setGenerating] = useState(false);

  const { trueSimpleFields, loopFields, conditionGroups } = buildFieldHierarchy(
    fields,
    previewText ?? ""
  );

  // Helpers
  const addRow = (fieldName: string, subFields: TemplateField["subFields"]) => {
    const blank: Record<string, string> = {};
    (subFields ?? []).forEach((sf) => (blank[sf.name] = ""));
    setLoopRows((prev) => ({
      ...prev,
      [fieldName]: [...(prev[fieldName] ?? []), blank],
    }));
  };
  const updateRow = (
    fieldName: string,
    rowIdx: number,
    key: string,
    val: string
  ) => {
    setLoopRows((prev) => {
      const rows = [...(prev[fieldName] ?? [])];
      rows[rowIdx] = { ...rows[rowIdx], [key]: val };
      return { ...prev, [fieldName]: rows };
    });
  };
  const removeRow = (fieldName: string, rowIdx: number) => {
    setLoopRows((prev) => {
      const rows = [...(prev[fieldName] ?? [])];
      rows.splice(rowIdx, 1);
      return { ...prev, [fieldName]: rows };
    });
  };

  // Progress
  const allFieldsForProgress = [
    ...trueSimpleFields,
    ...loopFields,
    ...conditionGroups.map((g) => g.conditionField),
  ];
  const filledCount = [
    ...trueSimpleFields.filter((f) =>
      f.type === "condition" || f.type === "condition_inverse"
        ? true
        : !!values[f.name]?.trim()
    ),
    ...loopFields.filter((f) => (loopRows[f.name]?.length ?? 0) > 0),
    ...conditionGroups, // always "filled" since toggle exists
  ].length;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { preprocessTemplate } =
        await import("@/lib/template-preprocessor");
      const PizZip = (await import("pizzip")).default;
      const Docxtemplater = (await import("docxtemplater")).default;

      const res = await fetch(
        `/api/onlyoffice-file?url=${encodeURIComponent(fileUrl)}`
      );
      if (!res.ok) throw new Error("Failed to fetch template");
      const buffer = await res.arrayBuffer();
      const processed = await preprocessTemplate(buffer);

      const data: Record<string, unknown> = {};

      // Simple fields
      for (const f of trueSimpleFields) {
        data[f.name] =
          f.type === "condition" || f.type === "condition_inverse"
            ? values[f.name] === "true"
            : (values[f.name] ?? "");
      }

      // Condition toggles and their inner fields
      for (const { conditionField, innerFields } of conditionGroups) {
        data[conditionField.name] =
          (values[conditionField.name] ?? "true") === "true";
        for (const f of innerFields) {
          data[f.name] = values[f.name] ?? "";
        }
      }

      // Loop rows
      for (const f of loopFields) {
        data[f.name] = loopRows[f.name] ?? [];
      }

      const zip = new PizZip(processed);
      const doc = new Docxtemplater(zip, {
        delimiters: { start: "{{", end: "}}" },
        paragraphLoop: true,
        linebreaks: true,
      });
      doc.render(data);

      const out = doc.getZip().generate({ type: "arraybuffer" });
      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateName}_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      await saveGenerated({
        templateId,
        title: `${templateName} — generated`,
        fieldValues: values,
        format: "docx",
        isBulk: false,
      });
      toast.success("Document downloaded successfully");
      setValues({});
      setLoopRows({});
    } catch (err: any) {
      console.error(err);
      const errMsg =
        err?.properties?.errors?.map((e: any) => e.message).join(", ") ??
        err?.message ??
        "Generation failed. Check your placeholders.";
      toast.error(errMsg);
    } finally {
      setGenerating(false);
    }
  };

  // Empty state
  if (
    trueSimpleFields.length === 0 &&
    loopFields.length === 0 &&
    conditionGroups.length === 0
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
          }}
        >
          <FileTextIcon
            className="w-7 h-7"
            style={{ color: "var(--accent-light)" }}
          />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <p
            className="text-[14px] font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            No fields detected
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--text-dim)" }}
          >
            Open the template editor, add{" "}
            <code
              className="font-mono text-[11px] px-1 rounded"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent-light)",
              }}
            >
              {"{{placeholders}}"}
            </code>{" "}
            to your document, then click Save to scan.
          </p>
        </div>
        <Link
          href={`/templates/${templateId}/edit`}
          className="flex items-center gap-1.5 text-[12px] font-medium px-4 py-2.5 rounded-xl"
          style={{
            background: "var(--accent-bg)",
            color: "var(--accent-pale)",
            border: `1px solid var(--accent-border)`,
          }}
        >
          <PencilIcon className="w-3.5 h-3.5" />
          Open editor
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 space-y-6 pb-24 lg:pb-6">
        {/* Simple fields */}
        {trueSimpleFields.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <HashIcon
                className="w-3.5 h-3.5"
                style={{ color: "var(--text-dim)" }}
              />
              <h2
                className="text-[13px] font-semibold"
                style={{ color: "var(--text)" }}
              >
                Fill in fields
              </h2>
              <span
                className="text-[11px]"
                style={{ color: "var(--text-dim)" }}
              >
                {
                  trueSimpleFields.filter((f) => !!values[f.name]?.trim())
                    .length
                }{" "}
                of {trueSimpleFields.length} filled
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {trueSimpleFields.map((field) => (
                <FieldItem
                  key={field.id}
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={(v) =>
                    setValues((prev) => ({ ...prev, [field.name]: v }))
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Loop fields */}
        {loopFields.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <TableIcon
                className="w-3.5 h-3.5"
                style={{ color: "var(--text-dim)" }}
              />
              <h2
                className="text-[13px] font-semibold"
                style={{ color: "var(--text)" }}
              >
                Repeating sections
              </h2>
            </div>
            <div className="space-y-4">
              {loopFields.map((field) => (
                <LoopSection
                  key={field.id}
                  field={field}
                  rows={loopRows[field.name] ?? []}
                  onAddRow={() => addRow(field.name, field.subFields)}
                  onUpdateRow={(idx, key, val) =>
                    updateRow(field.name, idx, key, val)
                  }
                  onRemoveRow={(idx) => removeRow(field.name, idx)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Condition groups */}
        {conditionGroups.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <ToggleLeftIcon
                className="w-3.5 h-3.5"
                style={{ color: "var(--text-dim)" }}
              />
              <h2
                className="text-[13px] font-semibold"
                style={{ color: "var(--text)" }}
              >
                Conditional sections
              </h2>
            </div>
            <div className="space-y-3">
              {conditionGroups.map(({ conditionField, innerFields }) => (
                <ConditionSection
                  key={conditionField.id}
                  group={{ conditionField, innerFields }}
                  conditionValue={values[conditionField.name] ?? "true"}
                  fieldValues={values}
                  onConditionChange={(v) =>
                    setValues((prev) => ({ ...prev, [conditionField.name]: v }))
                  }
                  onFieldChange={(name, v) =>
                    setValues((prev) => ({ ...prev, [name]: v }))
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Desktop sidebar ── */}
      <div className="hidden lg:flex flex-col gap-4 w-60 xl:w-64 shrink-0 sticky top-6">
        <FieldsOverviewSidebar
          trueSimpleFields={trueSimpleFields}
          loopFields={loopFields}
          conditionGroups={conditionGroups}
          values={values}
          loopRows={loopRows}
        />
        <GenerateButton onClick={handleGenerate} loading={generating} />
      </div>

      {/* ── Mobile floating generate ── */}
      <div className="lg:hidden fixed bottom-[calc(52px+env(safe-area-inset-bottom)+10px)] md:bottom-6 left-4 right-4 z-40">
        {" "}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-[13px] font-semibold shadow-2xl transition-all"
          style={{
            background: generating
              ? "var(--accent-strong-bg)"
              : "var(--primary)",
            color: "var(--primary-foreground)",
            boxShadow: generating ? "none" : "0 8px 32px var(--accent-bg)",
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <DownloadIcon className="w-4 h-4" />
              Generate & Download
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Bulk Form ─────────────────────────────────────────────────────────────────

function BulkForm({
  fields,
  templateId,
  templateName,
  fileUrl,
  previewText,
}: {
  fields: TemplateField[];
  templateId: Id<"templates">;
  templateName: string;
  fileUrl: string;
  previewText?: string;
}) {
  const saveGenerated = useMutation(api.templates.saveGeneratedDocument);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filenamePattern, setFilenamePattern] = useState(
    `${templateName}_{{row_number}}`
  );
  const [progress, setProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const xlsxRef = useRef<HTMLInputElement>(null);

  // Only flat (non-loop, non-condition) fields are bulk-fillable
  const { trueSimpleFields } = buildFieldHierarchy(fields, previewText ?? "");
  const bulkFields = trueSimpleFields.filter(
    (f) => f.type !== "condition" && f.type !== "condition_inverse"
  );
  const fieldNames = bulkFields.map((f) => f.name);
  const unmapped = fieldNames.filter((n) => !headers.includes(n));

  const downloadExcelTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([
        bulkFields.map((f) => f.name),
        bulkFields.map((f) =>
          f.type === "date"
            ? "12 Maret 2026"
            : f.type === "number"
              ? "1000"
              : f.type === "email"
                ? "contoh@email.com"
                : `contoh_${f.name}`
        ),
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${templateName}_data.xlsx`);
      toast.success("Template downloaded");
    } catch {
      toast.error("Failed to generate Excel template.");
    }
  };

  const processExcelFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      if (!wb.SheetNames.length) {
        toast.error("The Excel file appears to be empty.");
        return;
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
        defval: "",
        raw: false,
      });
      if (!data.length) {
        toast.error(
          "No data rows found. Make sure your Excel has data below the header row."
        );
        return;
      }
      setRows(data);
      setHeaders(Object.keys(data[0]));
      setStep(2);
      toast.success(`${data.length} row${data.length !== 1 ? "s" : ""} loaded`);
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message?.includes("File is password protected")
          ? "This Excel file is password-protected. Remove the password first."
          : "Couldn't read the Excel file. Make sure it's a valid .xlsx or .xls file."
      );
    }
  };

  const handleBulkGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setBulkErrors([]);
    const errors: string[] = [];

    try {
      const { preprocessTemplate } =
        await import("@/lib/template-preprocessor");
      const PizZip = (await import("pizzip")).default;
      const Docxtemplater = (await import("docxtemplater")).default;
      const JSZip = (await import("jszip")).default;

      const res = await fetch(
        `/api/onlyoffice-file?url=${encodeURIComponent(fileUrl)}`
      );
      if (!res.ok)
        throw new Error(
          "Failed to fetch template file. Check your connection."
        );
      const templateBuffer = await res.arrayBuffer();
      const processedBuffer = await preprocessTemplate(templateBuffer);
      const outputZip = new JSZip();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const data: Record<string, unknown> = {};
          for (const f of fields) {
            if (f.type === "condition" || f.type === "condition_inverse") {
              data[f.name] = row[f.name] === "true";
            } else if (f.type === "loop") {
              data[f.name] = [];
            } else {
              data[f.name] = row[f.name] ?? "";
            }
          }
          const zip = new PizZip(processedBuffer);
          const doc = new Docxtemplater(zip, {
            delimiters: { start: "{{", end: "}}" },
            paragraphLoop: true,
            linebreaks: true,
          });
          doc.render(data);

          const out = doc.getZip().generate({ type: "arraybuffer" });
          let filename = filenamePattern
            .replace(/{{row_number}}/g, String(i + 1).padStart(3, "0"))
            .replace(/{{(\w+)}}/g, (_, key) => String(row[key] ?? ""))
            .replace(/[<>:"/\\|?*]/g, "_")
            .trim();
          if (!filename)
            filename = `document_${String(i + 1).padStart(3, "0")}`;
          if (!filename.endsWith(".docx")) filename += ".docx";
          outputZip.file(filename, out);
        } catch (err: any) {
          const msg =
            err?.properties?.errors?.map((e: any) => e.message).join(", ") ??
            err?.message ??
            "Unknown error";
          errors.push(`Row ${i + 1}: ${msg}`);
        }
        setProgress(Math.round(((i + 1) / rows.length) * 100));
      }

      if (errors.length) {
        setBulkErrors(errors);
        outputZip.file("_errors.txt", errors.join("\n"));
      }

      const zipBlob = await outputZip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateName}_bulk_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      await saveGenerated({
        templateId,
        title: `${templateName} — bulk (${rows.length} rows)`,
        fieldValues: {},
        format: "docx",
        isBulk: true,
        bulkCount: rows.length,
      });

      const ok = rows.length - errors.length;
      if (ok > 0) toast.success(`Generated ${ok} of ${rows.length} documents`);
      if (!errors.length) setStep(1);
    } catch (err: any) {
      toast.error(err?.message ?? "Bulk generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Step 1: Download ─────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="w-full space-y-6">
        {/* Intro */}
        <div
          className="flex items-start gap-3 p-4 rounded-2xl"
          style={{
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
          }}
        >
          <SparklesIcon
            className="w-4 h-4 mt-0.5 shrink-0"
            style={{ color: "var(--accent-light)" }}
          />
          <div>
            <p
              className="text-[13px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Generate multiple documents at once
            </p>
            <p
              className="text-[12px] mt-0.5 leading-relaxed"
              style={{ color: "var(--text-dim)" }}
            >
              Fill an Excel spreadsheet with one row per document, then upload
              it here. We&apos;ll generate all documents and package them into a
              single ZIP file.
            </p>

            <div
              className="mt-3 pt-2 flex items-start gap-2 text-[11px] border-t"
              style={{
                borderColor: "var(--accent-border)",
              }}
            >
              <InfoIcon
                className="w-3 h-3 mt-0.5 shrink-0"
                style={{ color: "var(--text-dim)" }}
              />
              <p style={{ color: "var(--primary)" }}>
                <strong>Note:</strong> Only standard fields (text, number,
                email, date) can be filled via Excel. Conditional sections and
                repeating tables are <strong>not supported</strong> in bulk
                mode.
              </p>
            </div>
          </div>
        </div>

        {/* Steps overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              n: "1",
              label: "Download template",
              desc: "Get the Excel file with correct columns",
              color: "var(--success)",
              active: true,
            },
            {
              n: "2",
              label: "Fill the data",
              desc: "One row = one document",
              color: "var(--accent-light)",
              active: false,
            },
            {
              n: "3",
              label: "Upload & generate",
              desc: "We create all documents at once",
              color: "var(--accent-pale)",
              active: false,
            },
          ].map(({ n, label, desc, color, active }) => (
            <div
              key={n}
              className="flex items-start gap-3 p-3.5 rounded-xl"
              style={{
                background: active
                  ? `color-mix(in srgb, ${color} 8%, transparent)`
                  : "var(--bg-muted)",
                border: `1px solid ${active ? `color-mix(in srgb, ${color} 20%, transparent)` : "var(--border-subtle)"}`,
              }}
            >
              <span
                className="text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: `color-mix(in srgb, ${color} 15%, transparent)`,
                  color,
                  border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                }}
              >
                {n}
              </span>
              <div>
                <p
                  className="text-[12px] font-semibold"
                  style={{
                    color: active
                      ? "var(--text-secondary)"
                      : "var(--text-muted)",
                  }}
                >
                  {label}
                </p>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Column preview */}
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--text-dim)" }}
          >
            Your Excel file needs these {bulkFields.length} columns
          </p>
          <div
            className="rounded-xl border overflow-x-auto"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <table className="min-w-full text-[11px]">
              <thead>
                <tr
                  style={{
                    background: "var(--bg-muted)",
                    borderBottom: `1px solid var(--border-subtle)`,
                  }}
                >
                  {bulkFields.map((f) => (
                    <th
                      key={f.name}
                      className="px-3 py-2 text-left font-mono font-semibold whitespace-nowrap"
                      style={{
                        color: "var(--accent-light)",
                        borderRight: `1px solid var(--border-subtle)`,
                      }}
                    >
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1].map((rowIdx) => (
                  <tr
                    key={rowIdx}
                    style={{
                      borderBottom:
                        rowIdx === 0
                          ? `1px solid var(--border-subtle)`
                          : "none",
                    }}
                  >
                    {bulkFields.map((f) => (
                      <td
                        key={f.name}
                        className="px-3 py-2 whitespace-nowrap"
                        style={{
                          color: "var(--text-dim)",
                          borderRight: `1px solid var(--border-subtle)`,
                        }}
                      >
                        {f.type === "date"
                          ? `12 Maret ${2025 + rowIdx}`
                          : f.type === "number"
                            ? `${(rowIdx + 1) * 1000}`
                            : f.type === "email"
                              ? `user${rowIdx + 1}@mail.com`
                              : `contoh_${rowIdx + 1}`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Download template card */}
          <button
            onClick={downloadExcelTemplate}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl transition-all text-center"
            style={{
              background: "var(--success-bg)",
              border: `1px solid color-mix(in srgb, var(--success) 20%, transparent)`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "color-mix(in srgb, var(--success) 12%, transparent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--success-bg)")
            }
          >
            <DownloadIcon
              className="w-8 h-8"
              style={{ color: "var(--success)" }}
            />
            <div>
              <p
                className="text-[14px] font-semibold"
                style={{ color: "var(--success)" }}
              >
                Download Template
              </p>
              <p
                className="text-[11px] mt-1"
                style={{ color: "var(--text-dim)" }}
              >
                {templateName}_data.xlsx
              </p>
            </div>
          </button>

          {/* Upload drop zone */}
          <div
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all text-center"
            style={{
              borderColor: dragOver
                ? "var(--accent-border)"
                : "var(--border-subtle)",
              background: dragOver ? "var(--accent-bg)" : "var(--bg-muted)",
            }}
            onClick={() => xlsxRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) processExcelFile(file);
            }}
          >
            <FileSpreadsheetIcon
              className="w-8 h-8"
              style={{
                color: dragOver ? "var(--accent-light)" : "var(--text-dim)",
              }}
            />
            <div>
              <p
                className="text-[14px] font-semibold"
                style={{
                  color: dragOver ? "var(--accent-light)" : "var(--text-muted)",
                }}
              >
                {dragOver ? "Drop to upload" : "Upload filled Excel"}
              </p>
              <p
                className="text-[11px] mt-1"
                style={{ color: "var(--text-dim)" }}
              >
                .xlsx or .xls
              </p>
            </div>
          </div>
        </div>
        <input
          ref={xlsxRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processExcelFile(f);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  // ── Step 2: Review ───────────────────────────────────────────────────────

  if (step === 2) {
    return (
      <div className="w-full space-y-5 px-4 md:px-6">
        {/* Status bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3
              className="text-[14px] font-semibold"
              style={{ color: "var(--text)" }}
            >
              Review your data
            </h3>
            <p
              className="text-[12px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {rows.length} row{rows.length !== 1 ? "s" : ""} loaded
              {unmapped.length === 0
                ? " · all columns matched ✓"
                : ` · ${unmapped.length} column${unmapped.length !== 1 ? "s" : ""} not found in Excel`}
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl"
            style={{
              background:
                unmapped.length === 0
                  ? "var(--success-bg)"
                  : "var(--warning-bg)",
              color:
                unmapped.length === 0 ? "var(--success)" : "var(--warning)",
              border: `1px solid ${unmapped.length === 0 ? "color-mix(in srgb, var(--success) 20%, transparent)" : "color-mix(in srgb, var(--warning) 20%, transparent)"}`,
            }}
          >
            {unmapped.length === 0 ? (
              <>
                <CheckIcon className="w-3 h-3" />
                {fieldNames.length}/{fieldNames.length} matched
              </>
            ) : (
              <>
                {fieldNames.length - unmapped.length}/{fieldNames.length}{" "}
                matched
              </>
            )}
          </div>
        </div>

        {/* Unmapped warning */}
        {unmapped.length > 0 && (
          <div
            className="flex items-start gap-2.5 p-3.5 rounded-xl"
            style={{
              background: "var(--warning-bg)",
              border:
                "1px solid color-mix(in srgb, var(--warning) 15%, transparent)",
            }}
          >
            <AlertCircleIcon
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: "var(--warning)" }}
            />
            <div>
              <p
                className="text-[12px] font-medium mb-1.5"
                style={{ color: "var(--warning)" }}
              >
                These columns are missing from your Excel — they will be blank:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unmapped.map((n) => (
                  <code
                    key={n}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                    style={{
                      background:
                        "color-mix(in srgb, var(--warning) 10%, transparent)",
                      color: "var(--warning)",
                      border:
                        "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
                    }}
                  >
                    {n}
                  </code>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data preview */}
        <div
          className="rounded-xl overflow-auto"
          style={{ border: `1px solid var(--border-subtle)`, maxHeight: 280 }}
        >
          <table className="w-full text-[12px] min-w-max">
            <thead>
              <tr
                style={{
                  background: "var(--bg-muted)",
                  borderBottom: `1px solid var(--border-subtle)`,
                }}
              >
                <th
                  className="px-3 py-2 text-left w-10 font-medium"
                  style={{ color: "var(--text-dim)" }}
                >
                  #
                </th>
                {headers.slice(0, 7).map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-medium whitespace-nowrap"
                    style={{
                      color: fieldNames.includes(h)
                        ? "var(--accent-light)"
                        : "var(--text-muted)",
                    }}
                  >
                    {h}
                    {fieldNames.includes(h) && (
                      <span
                        className="ml-1 text-[10px]"
                        style={{ color: "var(--success)" }}
                      >
                        ✓
                      </span>
                    )}
                  </th>
                ))}
                {headers.length > 7 && (
                  <th
                    className="px-3 py-2 text-left"
                    style={{ color: "var(--text-dim)" }}
                  >
                    +{headers.length - 7} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: `1px solid var(--border-subtle)` }}
                >
                  <td
                    className="px-3 py-2"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {i + 1}
                  </td>
                  {headers.slice(0, 7).map((h) => (
                    <td
                      key={h}
                      className="px-3 py-2 max-w-[160px] truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {row[h] || (
                        <span style={{ color: "var(--text-dim)" }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 8 && (
          <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            Showing 8 of {rows.length} rows
          </p>
        )}

        <div className="flex gap-2.5">
          <button
            onClick={() => {
              setStep(1);
              setRows([]);
              setHeaders([]);
            }}
            className="flex items-center gap-1.5 text-[12px] font-medium px-4 py-2 rounded-xl"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            ← Change file
          </button>
          <button
            onClick={() => setStep(3)}
            className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium py-2 rounded-xl transition-all"
            style={{
              background: "var(--accent-strong-bg)",
              color: "var(--accent-pale)",
              border: "1px solid var(--accent-border)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--accent-mid)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--accent-strong-bg)")
            }
          >
            Continue → Set filenames & generate
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Generate ─────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-5 px-4 md:px-6">
      <div>
        <h3
          className="text-[14px] font-semibold"
          style={{ color: "var(--text)" }}
        >
          Set filename pattern
        </h3>
        <p
          className="text-[12px] mt-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          Each document will be named using this pattern. Click a token to
          insert it.
        </p>
      </div>

      <div className="space-y-2.5">
        <input
          value={filenamePattern}
          onChange={(e) => setFilenamePattern(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-[13px] font-mono outline-none"
          style={{
            background: "var(--bg-muted)",
            border: `1px solid var(--border-subtle)`,
            color: "var(--text)",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.border = `1px solid var(--accent-border)`)
          }
          onBlur={(e) =>
            (e.currentTarget.style.border = `1px solid var(--border-subtle)`)
          }
        />

        <div className="flex flex-wrap gap-1.5">
          {[
            "{{row_number}}",
            ...bulkFields.slice(0, 5).map((f) => `{{${f.name}}}`),
          ].map((token) => (
            <button
              key={token}
              onClick={() => setFilenamePattern((p) => p + token)}
              className="text-[10px] font-mono px-2 py-1 rounded-lg"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-light)",
                border: "1px solid var(--accent-border)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--accent-soft)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--accent-bg)")
              }
            >
              {token}
            </button>
          ))}
        </div>

        {rows.length > 0 && (
          <div
            className="rounded-xl p-3"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            <p
              className="text-[10px] mb-1"
              style={{ color: "var(--text-dim)" }}
            >
              Preview (row 1):
            </p>
            <code
              className="text-[12px] font-mono"
              style={{ color: "var(--text-secondary)" }}
            >
              {(filenamePattern
                .replace(/{{row_number}}/g, "001")
                .replace(/{{(\w+)}}/g, (_, k) => String(rows[0][k] ?? k)) ||
                "document_001") + ".docx"}
            </code>
          </div>
        )}
      </div>

      {/* Summary */}
      <div
        className="flex items-center gap-4 p-4 rounded-xl"
        style={{
          background: "var(--accent-bg)",
          border: "1px solid var(--accent-border)",
        }}
      >
        <FileTextIcon
          className="w-8 h-8 shrink-0"
          style={{ color: "var(--accent-light)", opacity: 0.6 }}
        />
        <div>
          <p
            className="text-[13px] font-semibold"
            style={{ color: "var(--text)" }}
          >
            Ready to generate {rows.length} document
            {rows.length !== 1 ? "s" : ""}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            Will be packaged into a single .zip file for download
          </p>
        </div>
      </div>

      {/* Progress */}
      {generating && (
        <div
          className="rounded-xl p-4 space-y-2.5"
          style={{
            background: "var(--bg-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          <div className="flex justify-between text-[12px]">
            <span style={{ color: "var(--text-muted)" }}>
              {Math.round((progress / 100) * rows.length)} / {rows.length}{" "}
              documents
            </span>
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--accent-light)" }}
            >
              {progress}%
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-input)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, var(--primary), var(--accent-light))",
              }}
            />
          </div>
        </div>
      )}

      {/* Errors */}
      {bulkErrors.length > 0 && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{
            background: "var(--danger-bg)",
            border:
              "1px solid color-mix(in srgb, var(--danger) 18%, transparent)",
          }}
        >
          <p
            className="text-[12px] font-semibold"
            style={{ color: "var(--danger)" }}
          >
            {bulkErrors.length} row{bulkErrors.length !== 1 ? "s" : ""} failed —
            included in _errors.txt inside the ZIP
          </p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {bulkErrors.map((e, i) => (
              <p
                key={i}
                className="text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                {e}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2.5">
        <button
          onClick={() => setStep(2)}
          disabled={generating}
          className="flex items-center gap-1 text-[12px] font-medium px-4 py-2 rounded-xl"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          ← Back
        </button>
        <button
          onClick={handleBulkGenerate}
          disabled={generating}
          className="flex-1 flex items-center justify-center gap-2 text-[13px] font-semibold py-2.5 rounded-xl transition-all"
          style={{
            background: generating
              ? "var(--accent-bg)"
              : "var(--accent-strong-bg)",
            color: generating ? "var(--text-muted)" : "var(--accent-pale)",
            border: `1px solid ${generating ? "var(--accent-border)" : "var(--accent-border)"}`,
          }}
          onMouseEnter={(e) => {
            if (!generating)
              e.currentTarget.style.background = "var(--accent-mid)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--accent-strong-bg)";
          }}
        >
          {generating ? (
            <>
              <div
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--accent-light)" }}
              />
              Generating…
            </>
          ) : (
            <>
              <DownloadIcon className="w-4 h-4" />
              Generate {rows.length} document{rows.length !== 1 ? "s" : ""} as
              ZIP
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplateFillPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as Id<"templates">;
  const { isLoaded, isSignedIn } = useAuth();

  const template = useQuery(
    api.templates.getById,
    isLoaded && isSignedIn ? { id: templateId } : "skip"
  );

  if (template === undefined) {
    return (
      <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
        <div
          className="px-4 sm:px-6 py-5 animate-pulse"
          style={{ borderBottom: `1px solid var(--border-subtle)` }}
        >
          <div
            className="h-3 rounded w-40 mb-3"
            style={{ background: "var(--bg-input)" }}
          />
          <div
            className="h-5 rounded w-56"
            style={{ background: "var(--bg-input)" }}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent-light)" }}
            />
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Loading template…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (template === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "var(--bg-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          <AlertCircleIcon
            className="w-6 h-6"
            style={{ color: "var(--text-dim)" }}
          />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <p
            className="text-[14px] font-semibold"
            style={{ color: "var(--text)" }}
          >
            Template not found
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            This template may have been deleted or you don&apos;t have access to
            it.
          </p>
        </div>
        <button
          onClick={() => router.push("/templates")}
          className="text-[12px] font-medium px-4 py-2.5 rounded-xl"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-secondary)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          ← Back to Templates
        </button>
      </div>
    );
  }

  const fields = template.fields as TemplateField[];
  const previewText = (template as any).previewText as string | undefined;
  const tmplTags = (template as any).tags as string[] | undefined;

  // Pre-compute hierarchy for header stats
  const { trueSimpleFields, loopFields, conditionGroups } = buildFieldHierarchy(
    fields,
    previewText ?? ""
  );
  const totalSections =
    trueSimpleFields.length + loopFields.length + conditionGroups.length;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <div
        className="flex flex-col justify-between shrink-0 px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5"
        style={{ borderBottom: `1px solid var(--border-subtle)` }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {[
            { href: "/templates", label: "Templates" },
            { href: `/templates/${templateId}/edit`, label: template.name },
          ].map(({ href, label }, i) => (
            <span key={href} className="flex items-center gap-1.5">
              {i > 0 && (
                <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
                  /
                </span>
              )}
              <Link
                href={href}
                className="text-[11px] transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--accent-light)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-muted)")
                }
              >
                {label}
              </Link>
            </span>
          ))}
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Fill
          </span>
        </div>

        {/* Template info */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <FileTextIcon
                className="w-4 h-4"
                style={{ color: "var(--accent-light)" }}
              />
            </div>
            <div className="min-w-0">
              <h1
                className="text-[15px] font-semibold truncate"
                style={{ color: "var(--text)" }}
              >
                {template.name}
              </h1>
              {template.description && (
                <p
                  className="text-[12px] mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {template.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Field breakdown badges */}
                {trueSimpleFields.length > 0 && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{
                      background:
                        "color-mix(in srgb, var(--field-text) 10%, transparent)",
                      color: "var(--field-text)",
                    }}
                  >
                    {trueSimpleFields.length} field
                    {trueSimpleFields.length !== 1 ? "s" : ""}
                  </span>
                )}
                {loopFields.length > 0 && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{
                      background:
                        "color-mix(in srgb, var(--accent-light) 10%, transparent)",
                      color: "var(--accent-light)",
                    }}
                  >
                    {loopFields.length} table
                    {loopFields.length !== 1 ? "s" : ""}
                  </span>
                )}
                {conditionGroups.length > 0 && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{
                      background:
                        "color-mix(in srgb, var(--field-condition) 10%, transparent)",
                      color: "var(--field-condition)",
                    }}
                  >
                    {conditionGroups.length} condition
                    {conditionGroups.length !== 1 ? "s" : ""}
                  </span>
                )}
                {tmplTags?.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md"
                    style={{
                      background: "var(--accent-bg)",
                      color: "var(--text-dim)",
                    }}
                  >
                    <TagIcon className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Link
            href={`/templates/${templateId}/edit`}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl shrink-0 transition-colors"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            <PencilIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit template</span>
          </Link>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <Tabs defaultValue="single">
          <TabsList
            className="mb-6"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            <TabsTrigger value="single" className="text-[12px]">
              Single document
            </TabsTrigger>
            <TabsTrigger value="bulk" className="text-[12px]">
              Bulk from Excel
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            <SingleForm
              fields={fields}
              templateId={template._id}
              templateName={template.name}
              fileUrl={template.fileUrl}
              previewText={previewText}
            />
          </TabsContent>
          <TabsContent value="bulk">
            <BulkForm
              fields={fields}
              templateId={template._id}
              templateName={template.name}
              fileUrl={template.fileUrl}
              previewText={previewText}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
