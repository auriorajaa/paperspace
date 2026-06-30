// components\forms\FormBuilder.tsx
"use client";

import { PlusIcon, ClipboardListIcon, SparklesIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuestionBlock, FormQuestion, QUESTION_TYPES } from "./QuestionBlock";

let _counter = 0;
function freshId(): string {
  _counter++;
  return `q_${Date.now()}_${_counter}`;
}

const TEXT_TYPES = QUESTION_TYPES.filter((t) => t.group === "text");
const CHOICE_TYPES = QUESTION_TYPES.filter((t) => t.group === "choice");
const OTHER_TYPES = QUESTION_TYPES.filter((t) => t.group === "other");

export function FormBuilder({
  schema,
  onChange,
}: {
  schema: FormQuestion[];
  onChange: (schema: FormQuestion[]) => void;
}) {
  const handleUpdate = (index: number, q: FormQuestion) => {
    const next = [...schema];
    next[index] = q;
    onChange(next);
  };

  const handleDelete = (index: number) => {
    onChange(schema.filter((_, i) => i !== index));
  };

  const handleDuplicate = (index: number) => {
    const source = schema[index];
    const copy: FormQuestion = {
      ...source,
      id: freshId(),
      title: source.title ? `${source.title} (copy)` : "",
      options: source.options ? [...source.options] : undefined,
    };
    const next = [...schema];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...schema];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index === schema.length - 1) return;
    const next = [...schema];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const addQuestion = (type: FormQuestion["type"]) => {
    const q: FormQuestion = {
      id: freshId(),
      title: "",
      type,
      required: false,
      options:
        type === "dropdown" || type === "radio" || type === "checkbox"
          ? [""]
          : undefined,
    };
    onChange([...schema, q]);
  };

  const requiredCount = schema.filter((q) => q.required).length;

  return (
    <div className="space-y-3">
      {/* ── Schema stats bar ── */}
      {schema.length > 0 && (
        <div
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              <span
                className="tabular-nums font-bold"
                style={{ color: "var(--text)" }}
              >
                {schema.length}
              </span>{" "}
              question{schema.length !== 1 ? "s" : ""}
            </span>
            {requiredCount > 0 && (
              <>
                <span style={{ color: "var(--border-hover)" }}>·</span>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--danger, #ef4444)" }}
                >
                  <span className="tabular-nums font-bold">
                    {requiredCount}
                  </span>{" "}
                  required
                </span>
              </>
            )}
            {schema.length - requiredCount > 0 && (
              <>
                <span style={{ color: "var(--border-hover)" }}>·</span>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-dim)" }}
                >
                  <span className="tabular-nums font-bold">
                    {schema.length - requiredCount}
                  </span>{" "}
                  optional
                </span>
              </>
            )}
          </div>
          <span
            className="text-[10.5px] hidden sm:inline"
            style={{ color: "var(--text-dim)" }}
          >
            Click ↕ to reorder · ⧉ to duplicate
          </span>
        </div>
      )}

      {/* ── Question list ── */}
      <div className="space-y-3">
        {schema.map((q, i) => (
          <QuestionBlock
            key={q.id}
            question={q}
            index={i}
            total={schema.length}
            onUpdate={(updated) => handleUpdate(i, updated)}
            onDelete={() => handleDelete(i)}
            onDuplicate={() => handleDuplicate(i)}
            onMoveUp={() => handleMoveUp(i)}
            onMoveDown={() => handleMoveDown(i)}
          />
        ))}
      </div>

      {/* ── Empty state ── */}
      {schema.length === 0 && (
        <div
          className="rounded-2xl p-10 text-center flex flex-col items-center gap-3"
          style={{
            background: "var(--bg-muted)",
            border: "1px dashed var(--border-subtle)",
          }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <ClipboardListIcon
              className="w-5 h-5"
              style={{ color: "var(--text-dim)" }}
            />
          </div>
          <div>
            <p
              className="text-[13.5px] font-semibold mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Let's build your form
            </p>
            <p
              className="text-[11.5px] max-w-[280px] mx-auto"
              style={{ color: "var(--text-dim)" }}
            >
              Use the "Add question" button below to start adding fields. You
              can reorder, duplicate, or remove them anytime.
            </p>
          </div>
        </div>
      )}

      {/* ── Add question dropdown ── */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-[12px] font-semibold px-3.5 py-2.5 rounded-xl min-h-[40px] transition-all hover:opacity-90"
              style={{
                background: "var(--accent-strong-bg)",
                color: "var(--accent-pale)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Add question
              {/* <svg
                width="9"
                height="5"
                viewBox="0 0 9 5"
                fill="currentColor"
                style={{ opacity: 0.7 }}
              >
                <path d="M0 0l4.5 5L9 0z" />
              </svg> */}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "var(--text-dim)" }}
            >
              Text
            </DropdownMenuLabel>
            {TEXT_TYPES.map((t) => {
              const TIcon = t.Icon;
              return (
                <DropdownMenuItem
                  key={t.value}
                  onClick={() => addQuestion(t.value)}
                  className="flex items-center gap-2.5"
                >
                  <TIcon
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: t.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium leading-tight">
                      {t.label}
                    </p>
                    <p
                      className="text-[10px] leading-tight"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {t.placeholder}
                    </p>
                  </div>
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
            {CHOICE_TYPES.map((t) => {
              const TIcon = t.Icon;
              return (
                <DropdownMenuItem
                  key={t.value}
                  onClick={() => addQuestion(t.value)}
                  className="flex items-center gap-2.5"
                >
                  <TIcon
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: t.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium leading-tight">
                      {t.label}
                    </p>
                    <p
                      className="text-[10px] leading-tight"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {t.placeholder}
                    </p>
                  </div>
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
            {OTHER_TYPES.map((t) => {
              const TIcon = t.Icon;
              return (
                <DropdownMenuItem
                  key={t.value}
                  onClick={() => addQuestion(t.value)}
                  className="flex items-center gap-2.5"
                >
                  <TIcon
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: t.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium leading-tight">
                      {t.label}
                    </p>
                    <p
                      className="text-[10px] leading-tight"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {t.placeholder}
                    </p>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {schema.length === 0 && (
          <span
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--text-dim)" }}
          >
            {/* <SparklesIcon className="w-3 h-3" /> */}
            Tip: start with a Short text question for the respondent's name
          </span>
        )}
      </div>
    </div>
  );
}
