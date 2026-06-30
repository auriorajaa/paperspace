// components\forms\QuestionBlock.tsx
"use client";

import {
  XIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  TypeIcon,
  AlignLeftIcon,
  MailIcon,
  HashIcon,
  CalendarIcon,
  ChevronDownSquareIcon,
  CircleDotIcon,
  CheckSquareIcon,
  AsteriskIcon,
  CopyIcon,
  Settings2Icon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type QuestionType =
  | "short_text"
  | "paragraph"
  | "email"
  | "number"
  | "date"
  | "dropdown"
  | "radio"
  | "checkbox";

export interface FormQuestion {
  id: string;
  title: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  /** Optional helper / description text shown under the question title */
  description?: string;
  /** Optional placeholder for text-like inputs (short_text, paragraph, email, number) */
  placeholder?: string;
  /** Optional min/max constraints for number inputs */
  min?: number;
  max?: number;
}

// ── Type metadata ─────────────────────────────────────────────────────────────

interface TypeMeta {
  value: QuestionType;
  label: string;
  color: string;
  Icon: React.ElementType;
  placeholder: string;
  group: "text" | "choice" | "other";
}

export const QUESTION_TYPES: TypeMeta[] = [
  {
    value: "short_text",
    label: "Short text",
    color: "var(--field-text, var(--accent-light))",
    Icon: TypeIcon,
    placeholder: "Short answer text",
    group: "text",
  },
  {
    value: "paragraph",
    label: "Paragraph",
    color: "var(--field-text, var(--accent-light))",
    Icon: AlignLeftIcon,
    placeholder: "Long answer text",
    group: "text",
  },
  {
    value: "email",
    label: "Email",
    color: "var(--field-email, #6366f1)",
    Icon: MailIcon,
    placeholder: "Email address",
    group: "text",
  },
  {
    value: "number",
    label: "Number",
    color: "var(--field-number, #f59e0b)",
    Icon: HashIcon,
    placeholder: "Numeric value",
    group: "other",
  },
  {
    value: "date",
    label: "Date",
    color: "var(--field-date, #10b981)",
    Icon: CalendarIcon,
    placeholder: "Date picker",
    group: "other",
  },
  {
    value: "dropdown",
    label: "Dropdown",
    color: "var(--field-text, var(--accent-light))",
    Icon: ChevronDownSquareIcon,
    placeholder: "Choose from list",
    group: "choice",
  },
  {
    value: "radio",
    label: "Multiple choice",
    color: "var(--field-text, var(--accent-light))",
    Icon: CircleDotIcon,
    placeholder: "Select one option",
    group: "choice",
  },
  {
    value: "checkbox",
    label: "Checkboxes",
    color: "var(--field-text, var(--accent-light))",
    Icon: CheckSquareIcon,
    placeholder: "Select all that apply",
    group: "choice",
  },
];

const TYPE_MAP = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t])
) as Record<QuestionType, TypeMeta>;

// ── QuestionBlock ─────────────────────────────────────────────────────────────

export function QuestionBlock({
  question,
  index,
  total,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  question: FormQuestion;
  index: number;
  total: number;
  onUpdate: (q: FormQuestion) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const isChoiceType =
    question.type === "dropdown" ||
    question.type === "radio" ||
    question.type === "checkbox";

  const isTextLike =
    question.type === "short_text" ||
    question.type === "paragraph" ||
    question.type === "email" ||
    question.type === "number";

  const meta = TYPE_MAP[question.type];
  const TypeIcon = meta.Icon;

  const handleTypeChange = (newType: QuestionType) => {
    const newIsChoice = ["dropdown", "radio", "checkbox"].includes(newType);
    const wasChoice = isChoiceType;
    onUpdate({
      ...question,
      type: newType,
      options: newIsChoice
        ? wasChoice
          ? (question.options ?? [""])
          : [""]
        : undefined,
    });
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-shadow group focus-within:shadow-sm"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* ── Top accent bar by type ── */}
      {/* <div
        className="h-[3px] w-full"
        style={{ background: meta.color }}
        aria-hidden
      /> */}

      <div className="p-4 sm:p-5 space-y-4">
        {/* ── Header row ── */}
        <div className="flex items-start gap-2.5">
          {/* Reorder handle + number */}
          <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
            <button
              onClick={onMoveUp}
              disabled={index === 0}
              className="w-5 h-4 flex items-center justify-center rounded transition-opacity disabled:opacity-20 hover:opacity-60"
              style={{ color: "var(--text-dim)" }}
              aria-label="Move up"
              type="button"
            >
              <ChevronUpIcon className="w-3 h-3" />
            </button>
            <span
              className="text-[10px] font-bold leading-none tabular-nums w-5 h-5 flex items-center justify-center rounded-md"
              style={{
                color: "var(--text-dim)",
                background: "var(--bg-muted)",
              }}
            >
              {index + 1}
            </span>
            <button
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="w-5 h-4 flex items-center justify-center rounded transition-opacity disabled:opacity-20 hover:opacity-60"
              style={{ color: "var(--text-dim)" }}
              aria-label="Move down"
              type="button"
            >
              <ChevronDownIcon className="w-3 h-3" />
            </button>
          </div>

          {/* Question title + description */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <input
              value={question.title}
              onChange={(e) => onUpdate({ ...question, title: e.target.value })}
              placeholder="Question title"
              className="w-full text-[13px] sm:text-sm font-semibold outline-none bg-transparent"
              style={{ color: "var(--text)" }}
            />
            <input
              value={question.description ?? ""}
              onChange={(e) =>
                onUpdate({ ...question, description: e.target.value })
              }
              placeholder="Add a description or instructions (optional)"
              className="w-full text-[11.5px] outline-none bg-transparent"
              style={{ color: "var(--text-muted)" }}
            />
            {/* Type label hint */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <TypeIcon
                className="w-3 h-3 shrink-0"
                style={{ color: meta.color }}
              />
              <span
                className="text-[10px] font-semibold"
                style={{ color: meta.color }}
              >
                {meta.label}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Type dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                  style={{
                    background: "var(--bg-muted)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                  }}
                  aria-label="Change question type"
                  title="Change type"
                >
                  <TypeIcon className="w-3 h-3" style={{ color: meta.color }} />
                  <span className="hidden sm:inline max-w-[64px] truncate">
                    {meta.label}
                  </span>
                  <ChevronDownIcon
                    className="w-3 h-3"
                    style={{ color: "var(--text-dim)" }}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--text-dim)" }}
                >
                  Text
                </DropdownMenuLabel>
                {QUESTION_TYPES.filter((t) => t.group === "text").map((t) => {
                  const TIcon = t.Icon;
                  return (
                    <DropdownMenuItem
                      key={t.value}
                      onClick={() => handleTypeChange(t.value)}
                      className="flex items-center gap-2"
                    >
                      <TIcon
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: t.color }}
                      />
                      <span className="flex-1">{t.label}</span>
                      {question.type === t.value && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: "var(--accent-light)" }}
                        />
                      )}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuLabel
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--text-dim)" }}
                >
                  Choice
                </DropdownMenuLabel>
                {QUESTION_TYPES.filter((t) => t.group === "choice").map((t) => {
                  const TIcon = t.Icon;
                  return (
                    <DropdownMenuItem
                      key={t.value}
                      onClick={() => handleTypeChange(t.value)}
                      className="flex items-center gap-2"
                    >
                      <TIcon
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: t.color }}
                      />
                      <span className="flex-1">{t.label}</span>
                      {question.type === t.value && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: "var(--accent-light)" }}
                        />
                      )}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuLabel
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--text-dim)" }}
                >
                  Other
                </DropdownMenuLabel>
                {QUESTION_TYPES.filter((t) => t.group === "other").map((t) => {
                  const TIcon = t.Icon;
                  return (
                    <DropdownMenuItem
                      key={t.value}
                      onClick={() => handleTypeChange(t.value)}
                      className="flex items-center gap-2"
                    >
                      <TIcon
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: t.color }}
                      />
                      <span className="flex-1">{t.label}</span>
                      {question.type === t.value && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: "var(--accent-light)" }}
                        />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Required toggle */}
            <button
              type="button"
              onClick={() =>
                onUpdate({ ...question, required: !question.required })
              }
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg transition-all"
              title={
                question.required ? "Mark as optional" : "Mark as required"
              }
              style={{
                background: question.required
                  ? "color-mix(in srgb, var(--danger, #ef4444) 12%, transparent)"
                  : "var(--bg-muted)",
                border: `1px solid ${question.required ? "color-mix(in srgb, var(--danger, #ef4444) 30%, transparent)" : "var(--border-subtle)"}`,
                color: question.required
                  ? "var(--danger, #ef4444)"
                  : "var(--text-dim)",
              }}
              aria-pressed={question.required}
            >
              <AsteriskIcon className="w-3 h-3" />
              <span className="hidden sm:inline">
                {question.required ? "Required" : "Optional"}
              </span>
            </button>

            {/* Duplicate */}
            {onDuplicate && (
              <button
                type="button"
                onClick={onDuplicate}
                aria-label="Duplicate question"
                title="Duplicate"
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all shrink-0 hover:opacity-80"
                style={{
                  color: "var(--text-dim)",
                  background: "var(--bg-muted)",
                }}
              >
                <CopyIcon className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete */}
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete question"
              title="Delete"
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all shrink-0"
              style={{ color: "var(--text-dim)", background: "transparent" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "var(--danger, #ef4444)";
                (e.currentTarget as HTMLElement).style.background =
                  "color-mix(in srgb, var(--danger, #ef4444) 10%, transparent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "var(--text-dim)";
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Answer preview ── */}
        <div className="pl-7">
          <AnswerPreview
            type={question.type}
            options={question.options}
            placeholder={question.placeholder}
          />
        </div>

        {/* ── Field configuration (placeholder / min-max) ── */}
        {isTextLike && (
          <div
            className="pl-7 pt-3 grid gap-3"
            style={{
              borderTop: "1px solid var(--border-subtle)",
              gridTemplateColumns:
                question.type === "number" ? "1fr 100px 100px" : "1fr",
            }}
          >
            <div className="space-y-1">
              <label
                className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1"
                style={{ color: "var(--text-dim)" }}
              >
                <Settings2Icon className="w-2.5 h-2.5" />
                Placeholder text
              </label>
              <input
                value={question.placeholder ?? ""}
                onChange={(e) =>
                  onUpdate({ ...question, placeholder: e.target.value })
                }
                placeholder={meta.placeholder}
                className="w-full text-[12px] rounded-lg px-2.5 py-1.5 outline-none"
                style={{
                  background: "var(--bg-muted)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              />
            </div>
            {question.type === "number" && (
              <>
                <div className="space-y-1">
                  <label
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Min
                  </label>
                  <input
                    type="number"
                    value={question.min ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        ...question,
                        min:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="w-full text-[12px] rounded-lg px-2.5 py-1.5 outline-none"
                    style={{
                      background: "var(--bg-muted)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Max
                  </label>
                  <input
                    type="number"
                    value={question.max ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        ...question,
                        max:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="w-full text-[12px] rounded-lg px-2.5 py-1.5 outline-none"
                    style={{
                      background: "var(--bg-muted)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Options editor for choice types ── */}
        {isChoiceType && (
          <div
            className="pl-7 space-y-1.5 pt-3"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--text-dim)" }}
            >
              Options
            </p>
            {(question.options ?? [""]).map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                {question.type === "radio" && (
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 shrink-0"
                    style={{ borderColor: "var(--border-hover)" }}
                    aria-hidden
                  />
                )}
                {question.type === "checkbox" && (
                  <span
                    className="w-3.5 h-3.5 rounded shrink-0"
                    style={{ border: "2px solid var(--border-hover)" }}
                    aria-hidden
                  />
                )}
                {question.type === "dropdown" && (
                  <span
                    className="text-[10px] font-medium w-4 text-right shrink-0 tabular-nums"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {oi + 1}.
                  </span>
                )}
                <input
                  value={opt}
                  onChange={(e) => {
                    const opts = [...(question.options ?? [""])];
                    opts[oi] = e.target.value;
                    onUpdate({ ...question, options: opts });
                  }}
                  placeholder={`Option ${oi + 1}`}
                  className="flex-1 text-[12px] rounded-lg px-2.5 py-1.5 outline-none"
                  style={{
                    background: "var(--bg-muted)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                  }}
                />
                {(question.options ?? []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const opts = (question.options ?? []).filter(
                        (_, i) => i !== oi
                      );
                      onUpdate({
                        ...question,
                        options: opts.length > 0 ? opts : [""],
                      });
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded transition-opacity hover:opacity-70 shrink-0"
                    style={{ color: "var(--text-dim)" }}
                    aria-label="Remove option"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  ...question,
                  options: [...(question.options ?? []), ""],
                })
              }
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors mt-1"
              style={{
                color: "var(--accent-light)",
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              + Add option
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Answer preview (read-only visual hint) ────────────────────────────────────

function AnswerPreview({
  type,
  options,
  placeholder,
}: {
  type: QuestionType;
  options?: string[];
  placeholder?: string;
}) {
  const base: React.CSSProperties = {
    background: "var(--bg-muted)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-dim)",
    borderRadius: 8,
    fontSize: 12,
    padding: "6px 10px",
    width: "100%",
    pointerEvents: "none",
    userSelect: "none",
  };

  if (type === "paragraph") {
    return (
      <div style={{ ...base, minHeight: 56, alignItems: "flex-start" }}>
        <span className="italic text-[11px]">
          {placeholder || "Long answer text…"}
        </span>
      </div>
    );
  }
  if (type === "date") {
    return (
      <div style={{ ...base, display: "flex", alignItems: "center", gap: 6 }}>
        <CalendarIcon style={{ width: 12, height: 12 }} />
        <span className="italic text-[11px]">MM / DD / YYYY</span>
      </div>
    );
  }
  if (type === "number") {
    return (
      <div style={{ ...base, display: "flex", alignItems: "center", gap: 6 }}>
        <HashIcon style={{ width: 12, height: 12 }} />
        <span className="italic text-[11px]">{placeholder || "0"}</span>
      </div>
    );
  }
  if (type === "email") {
    return (
      <div style={{ ...base, display: "flex", alignItems: "center", gap: 6 }}>
        <MailIcon style={{ width: 12, height: 12 }} />
        <span className="italic text-[11px]">
          {placeholder || "you@example.com"}
        </span>
      </div>
    );
  }
  if (type === "radio") {
    const opts = (options ?? []).filter((o) => o.trim()).slice(0, 3);
    if (!opts.length)
      return (
        <div style={{ ...base }}>
          <span className="italic text-[11px]">No options yet</span>
        </div>
      );
    return (
      <div className="space-y-1">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border-2 shrink-0"
              style={{ borderColor: "var(--border-hover)" }}
            />
            <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
              {o}
            </span>
          </div>
        ))}
        {(options?.filter((o) => o.trim()).length ?? 0) > 3 && (
          <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
            +{(options?.filter((o) => o.trim()).length ?? 0) - 3} more options
          </p>
        )}
      </div>
    );
  }
  if (type === "checkbox") {
    const opts = (options ?? []).filter((o) => o.trim()).slice(0, 3);
    if (!opts.length)
      return (
        <div style={{ ...base }}>
          <span className="italic text-[11px]">No options yet</span>
        </div>
      );
    return (
      <div className="space-y-1">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded shrink-0"
              style={{ border: "2px solid var(--border-hover)" }}
            />
            <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
              {o}
            </span>
          </div>
        ))}
        {(options?.filter((o) => o.trim()).length ?? 0) > 3 && (
          <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
            +{(options?.filter((o) => o.trim()).length ?? 0) - 3} more options
          </p>
        )}
      </div>
    );
  }
  if (type === "dropdown") {
    return (
      <div
        style={{
          ...base,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="italic text-[11px]">
          {(options ?? []).filter((o) => o.trim()).length > 0
            ? `${(options ?? []).filter((o) => o.trim()).length} option${(options ?? []).filter((o) => o.trim()).length !== 1 ? "s" : ""}`
            : "No options yet"}
        </span>
        <ChevronDownIcon style={{ width: 11, height: 11 }} />
      </div>
    );
  }
  // short_text fallback
  return (
    <div style={{ ...base }}>
      <span className="italic text-[11px]">
        {placeholder || "Short answer text…"}
      </span>
    </div>
  );
}
