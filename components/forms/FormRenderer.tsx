// components\forms\FormRenderer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, CheckIcon, AlertCircleIcon } from "lucide-react";
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
  /** "pill" | "soft" | "square" — controls input corner radius */
  cornerStyle?: "pill" | "soft" | "square";
  fontFamily?: string;
  showProgress?: boolean;
}

function radiusFor(cornerStyle: RendererProps["cornerStyle"]) {
  switch (cornerStyle) {
    case "square":
      return "6px";
    case "pill":
      return "999px";
    default:
      return "12px";
  }
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
  cornerStyle = "soft",
  fontFamily,
  showProgress = true,
}: RendererProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accent = themeColor || "var(--accent-light)";
  const radius = radiusFor(cornerStyle);
  const inputRadius = cornerStyle === "pill" ? "16px" : radius; // pill is too round for multi-line/select fields

  const answeredCount = schema.filter((q) => {
    const v = values[q.id];
    return v !== undefined && v.trim() !== "";
  }).length;
  const progressPct =
    schema.length > 0 ? Math.round((answeredCount / schema.length) * 100) : 0;

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

  const validate = (q: FormQuestion, val: string): string | null => {
    if (q.required && !val.trim()) return "This field is required";
    if (!val.trim()) return null;
    if (q.type === "email" && val.trim()) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
      if (!ok) return "Please enter a valid email address";
    }
    if (q.type === "number" && val.trim()) {
      const num = Number(val);
      if (Number.isNaN(num)) return "Please enter a valid number";
      if (q.min !== undefined && num < q.min)
        return `Must be at least ${q.min}`;
      if (q.max !== undefined && num > q.max) return `Must be at most ${q.max}`;
    }
    return null;
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    for (const q of schema) {
      const val = values[q.id]?.trim() ?? "";
      const err = validate(q, val);
      if (err) newErrors[q.id] = err;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstKey = schema.find((q) => newErrors[q.id])?.id;
      if (firstKey) {
        document
          .getElementById(`field-${firstKey}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    const answers = schema.map((q) => ({
      questionId: q.id,
      value: values[q.id] ?? "",
    }));
    onSubmit(answers);
  };

  const fieldBorder = (id: string) =>
    `1px solid ${errors[id] ? "var(--danger)" : "var(--border-subtle)"}`;

  return (
    <div className="space-y-6" style={fontFamily ? { fontFamily } : undefined}>
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
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {description}
            </p>
          )}

          {showProgress && schema.length > 3 && (
            <div className="mt-4">
              <div
                className="h-1.5 w-full rounded-full overflow-hidden"
                style={{ background: "var(--bg-muted)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%`, background: accent }}
                />
              </div>
              <p
                className="text-[10.5px] mt-1.5"
                style={{ color: "var(--text-dim)" }}
              >
                {answeredCount} of {schema.length} answered
              </p>
            </div>
          )}
        </div>
      )}

      {schema.map((q) => (
        <div key={q.id} id={`field-${q.id}`} className="space-y-1.5">
          <label
            className="text-sm font-medium flex items-center gap-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {q.title}
            {q.required && <span style={{ color: "var(--danger)" }}>*</span>}
          </label>
          {q.description && (
            <p className="text-xs -mt-1" style={{ color: "var(--text-dim)" }}>
              {q.description}
            </p>
          )}

          {q.type === "paragraph" ? (
            <textarea
              value={values[q.id] ?? ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder={q.placeholder}
              className="w-full px-3 py-2 text-sm outline-none resize-y min-h-[80px] transition-colors"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: fieldBorder(q.id),
                borderRadius: inputRadius,
              }}
            />
          ) : q.type === "date" ? (
            <input
              type="date"
              value={values[q.id] ?? ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 text-sm outline-none transition-colors"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: fieldBorder(q.id),
                borderRadius: inputRadius,
              }}
            />
          ) : q.type === "number" ? (
            <input
              type="number"
              value={values[q.id] ?? ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              disabled={disabled}
              placeholder={q.placeholder}
              min={q.min}
              max={q.max}
              className="w-full px-3 py-2 text-sm outline-none transition-colors"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: fieldBorder(q.id),
                borderRadius: inputRadius,
              }}
            />
          ) : q.type === "dropdown" ? (
            <CustomDropdown
              value={values[q.id] ?? ""}
              options={(q.options ?? []).filter((o) => o.trim())}
              onChange={(v) => handleChange(q.id, v)}
              disabled={disabled}
              hasError={!!errors[q.id]}
              accent={accent}
              radius={inputRadius}
            />
          ) : q.type === "radio" ? (
            <div className="space-y-2">
              {(q.options ?? [])
                .filter((o) => o.trim())
                .map((opt, i) => {
                  const checked = values[q.id] === opt;
                  return (
                    <label
                      key={i}
                      className="flex items-center gap-2.5 text-sm cursor-pointer px-3 py-2 rounded-xl transition-colors"
                      style={{
                        color: "var(--text-secondary)",
                        background: checked ? "var(--bg-muted)" : "transparent",
                        border: `1px solid ${checked ? accent : "var(--border-subtle)"}`,
                      }}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={checked}
                        onChange={(e) => handleChange(q.id, e.target.value)}
                        disabled={disabled}
                        style={{ accentColor: accent }}
                      />
                      {opt}
                    </label>
                  );
                })}
            </div>
          ) : q.type === "checkbox" ? (
            <div className="space-y-2">
              {(q.options ?? [])
                .filter((o) => o.trim())
                .map((opt, i) => {
                  const selected = (values[q.id] ?? "")
                    .split("; ")
                    .filter(Boolean);
                  const checked = selected.includes(opt);
                  return (
                    <label
                      key={i}
                      className="flex items-center gap-2.5 text-sm cursor-pointer px-3 py-2 rounded-xl transition-colors"
                      style={{
                        color: "var(--text-secondary)",
                        background: checked ? "var(--bg-muted)" : "transparent",
                        border: `1px solid ${checked ? accent : "var(--border-subtle)"}`,
                      }}
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
              type={q.type === "email" ? "email" : "text"}
              value={values[q.id] ?? ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              disabled={disabled}
              placeholder={
                q.placeholder || (q.type === "email" ? "you@example.com" : "")
              }
              className="w-full px-3 py-2 text-sm outline-none transition-colors"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text)",
                border: fieldBorder(q.id),
                borderRadius: inputRadius,
              }}
            />
          )}

          {errors[q.id] && (
            <p
              className="text-xs flex items-center gap-1"
              style={{ color: "var(--danger)" }}
            >
              <AlertCircleIcon className="w-3 h-3" />
              {errors[q.id]}
            </p>
          )}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full text-sm font-semibold px-4 py-3 transition-all duration-150 min-h-[48px]"
        style={{
          background: accent,
          color: "#fff",
          opacity: disabled ? 0.6 : 1,
          borderRadius: radius,
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.opacity = "0.9";
        }}
        onMouseLeave={(e) => {
          if (!disabled) e.currentTarget.style.opacity = "1";
        }}
      >
        {submitLabel || "Submit"}
      </button>
    </div>
  );
}

// ── Custom styled dropdown (replaces native <select>) ──────────────────────

function CustomDropdown({
  value,
  options,
  onChange,
  disabled,
  hasError,
  accent,
  radius,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  accent: string;
  radius: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm outline-none transition-colors"
        style={{
          background: "var(--bg-muted)",
          color: value ? "var(--text)" : "var(--text-dim)",
          border: `1px solid ${hasError ? "var(--danger)" : "var(--border-subtle)"}`,
          borderRadius: radius,
        }}
      >
        <span className="truncate">{value || "-- Select --"}</span>
        <ChevronDownIcon
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{
            transform: open ? "rotate(180deg)" : "none",
            color: "var(--text-dim)",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl shadow-lg"
          style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {options.length === 0 ? (
            <div
              className="px-3 py-2 text-[12px]"
              style={{ color: "var(--text-dim)" }}
            >
              No options available
            </div>
          ) : (
            options.map((opt, i) => {
              const selected = opt === value;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors"
                  style={{
                    color: "var(--text-secondary)",
                    background: selected ? "var(--bg-muted)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected)
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--bg-muted)";
                  }}
                  onMouseLeave={(e) => {
                    if (!selected)
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                  }}
                >
                  <span className="truncate">{opt}</span>
                  {selected && (
                    <CheckIcon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: accent }}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
