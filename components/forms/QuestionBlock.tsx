"use client";

import { XIcon, GripVerticalIcon } from "lucide-react";

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

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "paragraph", label: "Paragraph" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
];

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

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex flex-col items-center gap-0.5"
          style={{ color: "var(--text-dim)" }}
        >
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="disabled:opacity-30 hover:opacity-70 transition-opacity"
            aria-label="Move up"
            style={{ lineHeight: 0.8, fontSize: 10 }}
          >
            ▲
          </button>
          <span className="text-[11px] font-medium">{index + 1}</span>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="disabled:opacity-30 hover:opacity-70 transition-opacity"
            aria-label="Move down"
            style={{ lineHeight: 0.8, fontSize: 10 }}
          >
            ▼
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <input
            value={question.title}
            onChange={(e) =>
              onUpdate({ ...question, title: e.target.value })
            }
            placeholder="Question title"
            className="w-full text-sm font-medium outline-none bg-transparent"
            style={{ color: "var(--text)" }}
          />
        </div>

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
          className="text-xs rounded-lg px-2 py-1.5 outline-none"
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

        <label className="flex items-center gap-1.5 text-xs cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) =>
              onUpdate({ ...question, required: e.target.checked })
            }
            className="rounded"
            style={{ accentColor: "var(--accent-light)" }}
          />
          <span style={{ color: "var(--text-dim)" }}>Required</span>
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
