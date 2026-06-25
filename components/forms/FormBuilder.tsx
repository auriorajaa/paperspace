"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import {
  QuestionBlock,
  FormQuestion,
  QUESTION_TYPES,
} from "./QuestionBlock";

let _counter = 0;
function freshId(): string {
  _counter++;
  return `q_${Date.now()}_${_counter}`;
}

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

  return (
    <div className="space-y-3">
      {schema.map((q, i) => (
        <QuestionBlock
          key={q.id}
          question={q}
          index={i}
          total={schema.length}
          onUpdate={(updated) => handleUpdate(i, updated)}
          onDelete={() => handleDelete(i)}
          onMoveUp={() => handleMoveUp(i)}
          onMoveDown={() => handleMoveDown(i)}
        />
      ))}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <span
          className="text-xs font-medium self-center mr-1"
          style={{ color: "var(--text-dim)" }}
        >
          Add:
        </span>
        {QUESTION_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => addQuestion(t.value)}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px]"
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
            <PlusIcon className="w-3 h-3" />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
