"use client";

import { useState } from "react";
import type { FormQuestion } from "./QuestionBlock";

interface RendererProps {
  schema: FormQuestion[];
  title: string;
  description?: string;
  disabled?: boolean;
  onSubmit: (answers: { questionId: string; value: string }[]) => void;
  submitLabel?: string;
  themeColor?: string;
  headerImage?: string;
  showHeader?: boolean;
}

export function FormRenderer({
  schema,
  title,
  description,
  disabled = false,
  onSubmit,
  submitLabel = "Submit",
  themeColor,
  headerImage,
  showHeader = true,
}: RendererProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accent = themeColor || "var(--accent-light)";

  const handleChange = (questionId: string, value: string) => {
    setValues((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    for (const q of schema) {
      if (q.required) {
        const val = values[q.id]?.trim() ?? "";
        if (!val) {
          newErrors[q.id] = "This field is required";
        }
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const answers = schema.map((q) => ({
      questionId: q.id,
      value: values[q.id] ?? "",
    }));
    onSubmit(answers);
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div>
          {headerImage && (
            <div className="rounded-xl overflow-hidden mb-4 -mx-2 -mt-2 sm:-mx-4 sm:-mt-4">
              <img
                src={headerImage}
                alt="Form header"
                className="w-full h-40 sm:h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--text)" }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="text-sm mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              {description}
            </p>
          )}
        </div>
      )}

      {schema.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <label
            className="text-sm font-medium flex items-center gap-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {q.title}
            {q.required && (
              <span style={{ color: "var(--danger)" }}>*</span>
            )}
          </label>

          {q.type === "paragraph" ? (
            <textarea
              value={values[q.id] ?? ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              disabled={disabled}
              rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y min-h-[80px]"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: `1px solid ${errors[q.id] ? "var(--danger)" : "var(--border-subtle)"}`,
              }}
            />
          ) : q.type === "date" ? (
            <input
              type="date"
              value={values[q.id] ?? ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              disabled={disabled}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: `1px solid ${errors[q.id] ? "var(--danger)" : "var(--border-subtle)"}`,
              }}
            />
          ) : q.type === "number" ? (
            <input
              type="number"
              value={values[q.id] ?? ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              disabled={disabled}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: `1px solid ${errors[q.id] ? "var(--danger)" : "var(--border-subtle)"}`,
              }}
            />
          ) : q.type === "dropdown" ? (
            <select
              value={values[q.id] ?? ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              disabled={disabled}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: `1px solid ${errors[q.id] ? "var(--danger)" : "var(--border-subtle)"}`,
              }}
            >
              <option value="">-- Select --</option>
              {(q.options ?? []).filter((o) => o.trim()).map((opt, i) => (
                <option key={i} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : q.type === "radio" ? (
            <div className="space-y-1.5">
              {(q.options ?? []).filter((o) => o.trim()).map((opt, i) => (
                <label
                  key={i}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={values[q.id] === opt}
                    onChange={(e) => handleChange(q.id, e.target.value)}
                    disabled={disabled}
                    style={{ accentColor: accent }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : q.type === "checkbox" ? (
            <div className="space-y-1.5">
              {(q.options ?? []).filter((o) => o.trim()).map((opt, i) => {
                const selected = (values[q.id] ?? "").split("; ").filter(Boolean);
                const checked = selected.includes(opt);
                return (
                  <label
                    key={i}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <input
                      type="checkbox"
                      value={opt}
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? selected.filter((s) => s !== opt)
                          : [...selected, opt];
                        handleChange(q.id, next.join("; "));
                      }}
                      disabled={disabled}
                      style={{ accentColor: accent }}
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          ) : (
            <input
              type={
                q.type === "email"
                  ? "email"
                  : "text"
              }
              value={values[q.id] ?? ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              disabled={disabled}
              placeholder={q.type === "email" ? "you@example.com" : ""}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: `1px solid ${errors[q.id] ? "var(--danger)" : "var(--border-subtle)"}`,
              }}
            />
          )}

          {errors[q.id] && (
            <p
              className="text-xs"
              style={{ color: "var(--danger)" }}
            >
              {errors[q.id]}
            </p>
          )}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full text-sm font-semibold px-4 py-3 rounded-xl transition-all duration-150 min-h-[48px]"
        style={{
          background: accent,
          color: "#fff",
          opacity: disabled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!disabled)
            e.currentTarget.style.opacity = "0.9";
        }}
        onMouseLeave={(e) => {
          if (!disabled)
            e.currentTarget.style.opacity = "1";
        }}
      >
        {submitLabel || "Submit"}
      </button>
    </div>
  );
}
