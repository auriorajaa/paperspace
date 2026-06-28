"use client";

import { XIcon, ChevronUpIcon, ChevronDownIcon, ChevronDownIcon as SelectChevron } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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
}

export const QUESTION_TYPES: { value: QuestionType; label: string; color: string }[] = [
  { value: "short_text", label: "Short text", color: "var(--field-text)" },
  { value: "paragraph", label: "Paragraph", color: "var(--field-text)" },
  { value: "email", label: "Email", color: "var(--field-email)" },
  { value: "number", label: "Number", color: "var(--field-number)" },
  { value: "date", label: "Date", color: "var(--field-date)" },
  { value: "dropdown", label: "Dropdown", color: "var(--field-text)" },
  { value: "radio", label: "Radio", color: "var(--field-text)" },
  { value: "checkbox", label: "Checkbox", color: "var(--field-text)" },
];

const TYPE_COLORS: Record<string, string> = {
  short_text: "var(--field-text)",
  paragraph: "var(--field-text)",
  email: "var(--field-email)",
  number: "var(--field-number)",
  date: "var(--field-date)",
  dropdown: "var(--field-text)",
  radio: "var(--field-text)",
  checkbox: "var(--field-text)",
};

export function QuestionBlock({
  question,
  index,
  total,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: FormQuestion;
  index: number;
  total: number;
  onUpdate: (q: FormQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const isChoiceType =
    question.type === "dropdown" ||
    question.type === "radio" ||
    question.type === "checkbox";

  const typeColor = TYPE_COLORS[question.type] || "var(--field-text)";

  return (
    <div
      className="rounded-xl p-4 space-y-3 transition-shadow"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-5 h-4 flex items-center justify-center rounded transition-colors disabled:opacity-30 hover:opacity-70"
            style={{ color: "var(--text-dim)" }}
            aria-label="Move up"
          >
            <ChevronUpIcon className="w-3.5 h-3.5" />
          </button>
          <span
            className="text-[10px] font-medium leading-none"
            style={{ color: "var(--text-dim)" }}
          >
            {index + 1}
          </span>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="w-5 h-4 flex items-center justify-center rounded transition-colors disabled:opacity-30 hover:opacity-70"
            style={{ color: "var(--text-dim)" }}
            aria-label="Move down"
          >
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <input
            value={question.title}
            onChange={(e) =>
              onUpdate({ ...question, title: e.target.value })
            }
            placeholder="Question title"
            className="w-full text-sm font-medium outline-none bg-transparent"
            style={{ color: "var(--text)" }}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: `color-mix(in srgb, ${typeColor} 15%, transparent)`,
                color: typeColor,
              }}
            >
              {QUESTION_TYPES.find((t) => t.value === question.type)?.label || question.type}
            </span>

            {question.required && (
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--danger)" }}
              >
                Required
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <select
              value={question.type}
              onChange={(e) =>
                onUpdate({
                  ...question,
                  type: e.target.value as QuestionType,
                  options:
                    isChoiceType &&
                    ["dropdown", "radio", "checkbox"].includes(e.target.value)
                      ? question.options ?? [""]
                      : undefined,
                })
              }
              className="appearance-none text-xs rounded-lg pl-2 pr-6 py-1.5 outline-none cursor-pointer"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <SelectChevron
              className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3"
              style={{ color: "var(--text-dim)" }}
            />
          </div>

          <label
            className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer transition-colors shrink-0"
            style={{ color: question.required ? "var(--danger)" : "var(--text-dim)" }}
            title={question.required ? "Mark as optional" : "Mark as required"}
          >
            <Checkbox
              checked={question.required}
              onCheckedChange={(checked) =>
                onUpdate({ ...question, required: !!checked })
              }
              className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
            />
          </label>

          <button
            onClick={onDelete}
            aria-label="Delete question"
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--danger)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-dim)")
            }
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isChoiceType && (
        <div className="pl-8 space-y-1.5">
          {(question.options ?? [""]).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => {
                  const opts = [...(question.options ?? [""])];
                  opts[oi] = e.target.value;
                  onUpdate({ ...question, options: opts });
                }}
                placeholder={`Option ${oi + 1}`}
                className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none"
                style={{
                  background: "var(--bg-muted)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              />
              {(question.options ?? []).length > 1 && (
                <button
                  onClick={() => {
                    const opts = (question.options ?? []).filter(
                      (_, i) => i !== oi
                    );
                    onUpdate({
                      ...question,
                      options: opts.length > 0 ? opts : [""],
                    });
                  }}
                  className="text-xs"
                  style={{ color: "var(--text-dim)" }}
                  aria-label="Remove option"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() =>
              onUpdate({
                ...question,
                options: [...(question.options ?? []), ""],
              })
            }
            className="text-xs font-medium px-2 py-1 rounded-lg transition-colors"
            style={{
              color: "var(--accent-light)",
              background: "var(--accent-bg)",
            }}
          >
            + Add option
          </button>
        </div>
      )}
    </div>
  );
}
