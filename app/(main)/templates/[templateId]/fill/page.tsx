"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useRef } from "react";
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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import type { TemplateField } from "../../_components/FieldCard";
import { colors, fieldTypeColors } from "@/lib/design-tokens";

// ── Field Input ────────────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "condition" || field.type === "condition_inverse") {
    return (
      <div className="flex gap-2">
        {[
          { val: "true", label: "✓ Show block" },
          { val: "false", label: "✗ Hide block" },
        ].map(({ val, label }) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background:
                (value ?? "true") === val
                  ? val === "true"
                    ? "rgba(52,211,153,0.12)"
                    : "rgba(248,113,113,0.1)"
                  : "rgba(255,255,255,0.03)",
              color:
                (value ?? "true") === val
                  ? val === "true"
                    ? "#34d399"
                    : "#f87171"
                  : colors.textMuted,
              border: `1px solid ${
                (value ?? "true") === val
                  ? val === "true"
                    ? "rgba(52,211,153,0.25)"
                    : "rgba(248,113,113,0.25)"
                  : colors.border
              }`,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        placeholder="Enter number…"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${colors.border}`,
          color: colors.text,
        }}
        onFocus={(e) =>
          (e.currentTarget.style.border = `1px solid rgba(255,255,255,0.15)`)
        }
        onBlur={(e) =>
          (e.currentTarget.style.border = `1px solid ${colors.border}`)
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
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${colors.border}`,
          color: colors.text,
        }}
        onFocus={(e) =>
          (e.currentTarget.style.border = `1px solid rgba(255,255,255,0.15)`)
        }
        onBlur={(e) =>
          (e.currentTarget.style.border = `1px solid ${colors.border}`)
        }
      />
    );
  }

  // text + date — all free text
  return (
    <div className="space-y-1">
      <input
        type="text"
        placeholder={field.type === "date" ? "e.g. March 12, 2026" : ""}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${colors.border}`,
          color: colors.text,
        }}
        onFocus={(e) =>
          (e.currentTarget.style.border = `1px solid rgba(255,255,255,0.15)`)
        }
        onBlur={(e) =>
          (e.currentTarget.style.border = `1px solid ${colors.border}`)
        }
      />
      {field.type === "date" && (
        <p className="text-[10px]" style={{ color: colors.textDim }}>
          Any format — exactly as typed it will appear in the document.
        </p>
      )}
    </div>
  );
}

// ── Single Form ────────────────────────────────────────────────────────────────

function SingleForm({
  fields,
  templateId,
  templateName,
  fileUrl,
}: {
  fields: TemplateField[];
  templateId: Id<"templates">;
  templateName: string;
  fileUrl: string;
}) {
  const saveGenerated = useMutation(api.templates.saveGeneratedDocument);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loopRows, setLoopRows] = useState<
    Record<string, Record<string, string>[]>
  >({});
  const [generating, setGenerating] = useState(false);

  const simpleFields = fields.filter((f) => f.type !== "loop");
  const loopFields = fields.filter((f) => f.type === "loop");

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
      for (const f of simpleFields) {
        data[f.name] =
          f.type === "condition" || f.type === "condition_inverse"
            ? values[f.name] === "true"
            : (values[f.name] ?? "");
      }
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
      toast.success("Document downloaded");
      setValues({});
      setLoopRows({});
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.properties?.errors?.map((e: any) => e.message).join(", ") ??
          "Generation failed. Check your placeholders."
      );
    } finally {
      setGenerating(false);
    }
  };

  const filledCount = simpleFields.filter((f) =>
    f.type === "condition" || f.type === "condition_inverse"
      ? true
      : values[f.name]?.trim()
  ).length;

  if (simpleFields.length === 0 && loopFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.15)",
          }}
        >
          <FileTextIcon className="w-7 h-7" style={{ color: "#818cf8" }} />
        </div>
        <div>
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: colors.textSecondary }}
          >
            No fields detected
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{ color: colors.textDim }}
          >
            Open the editor, add{" "}
            <code
              className="font-mono px-1 rounded"
              style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}
            >
              {"{{placeholders}}"}
            </code>{" "}
            to your document, then click Save.
          </p>
        </div>
        <Link
          href={`/templates/${templateId}/edit`}
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl"
          style={{
            background: colors.accentBg,
            color: colors.accentPale,
            border: `1px solid ${colors.accentBorder}`,
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
      {/* ── Main form area ── */}
      <div className="flex-1 min-w-0 space-y-8">
        {/* Simple fields */}
        {simpleFields.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2
                className="text-sm font-semibold"
                style={{ color: colors.text }}
              >
                Fill in fields
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {simpleFields.map((field) => {
                const color = fieldTypeColors[field.type] ?? "#6b7280";
                return (
                  <div key={field.id} className="space-y-1.5">
                    <label
                      className="text-xs font-medium flex items-center gap-1.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {field.label}
                      {/* <span
                        className="text-[10px] px-1.5 py-px rounded-md font-normal ml-auto"
                        style={{ background: `${color}12`, color }}
                      >
                        {field.type}
                      </span> */}
                    </label>
                    <FieldInput
                      field={field}
                      value={values[field.name] ?? ""}
                      onChange={(v) =>
                        setValues((prev) => ({ ...prev, [field.name]: v }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Loop fields */}
        {loopFields.map((field) => {
          const rows = loopRows[field.name] ?? [];
          const subFields = field.subFields ?? [];
          return (
            <section key={field.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2
                      className="text-sm font-semibold"
                      style={{ color: colors.text }}
                    >
                      {field.label}
                    </h2>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(129,140,248,0.12)",
                        color: "#818cf8",
                        border: "1px solid rgba(129,140,248,0.2)",
                      }}
                    >
                      loop · {rows.length} row{rows.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: colors.textDim }}
                  >
                    Each row becomes one repeated block in the document.
                  </p>
                </div>
                <button
                  onClick={() => addRow(field.name, subFields)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl"
                  style={{
                    background: "rgba(129,140,248,0.12)",
                    color: "#818cf8",
                    border: "1px solid rgba(129,140,248,0.2)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(129,140,248,0.2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(129,140,248,0.12)")
                  }
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Add row
                </button>
              </div>

              {rows.length === 0 ? (
                <button
                  onClick={() => addRow(field.name, subFields)}
                  className="w-full flex flex-col items-center justify-center py-10 rounded-2xl border-2 border-dashed transition-all"
                  style={{ borderColor: "rgba(129,140,248,0.2)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(129,140,248,0.4)";
                    e.currentTarget.style.background = "rgba(129,140,248,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(129,140,248,0.2)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <PlusIcon
                    className="w-5 h-5 mb-2"
                    style={{ color: "#818cf8", opacity: 0.5 }}
                  />
                  <p className="text-xs" style={{ color: colors.textDim }}>
                    Click to add the first row
                  </p>
                </button>
              ) : (
                <div className="space-y-2">
                  {subFields.length > 0 && (
                    <div
                      className="grid gap-2 px-4 pb-1"
                      style={{
                        gridTemplateColumns: `32px repeat(${subFields.length}, 1fr) 28px`,
                      }}
                    >
                      <span />
                      {subFields.map((sf) => (
                        <p
                          key={sf.id}
                          className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: colors.textDim }}
                        >
                          {sf.label}
                        </p>
                      ))}
                      <span />
                    </div>
                  )}

                  {rows.map((row, rowIdx) => (
                    <div
                      key={rowIdx}
                      className="flex items-center gap-2 px-3 py-3 rounded-xl group"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <span
                        className="text-[10px] font-mono w-6 text-center shrink-0"
                        style={{ color: colors.textDim }}
                      >
                        {rowIdx + 1}
                      </span>
                      {subFields.length > 0 ? (
                        <div
                          className="flex-1 grid gap-2"
                          style={{
                            gridTemplateColumns: `repeat(${subFields.length}, 1fr)`,
                          }}
                        >
                          {subFields.map((sf) => (
                            <input
                              key={sf.name}
                              type="text"
                              placeholder={sf.label}
                              value={row[sf.name] ?? ""}
                              onChange={(e) =>
                                updateRow(
                                  field.name,
                                  rowIdx,
                                  sf.name,
                                  e.target.value
                                )
                              }
                              className="rounded-lg px-2.5 py-2 text-xs outline-none"
                              style={{
                                background: "rgba(255,255,255,0.05)",
                                border: `1px solid ${colors.border}`,
                                color: colors.text,
                              }}
                              onFocus={(e) =>
                                (e.currentTarget.style.border =
                                  "1px solid rgba(129,140,248,0.35)")
                              }
                              onBlur={(e) =>
                                (e.currentTarget.style.border = `1px solid ${colors.border}`)
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <p
                          className="flex-1 text-xs"
                          style={{ color: colors.textDim }}
                        >
                          No sub-fields.{" "}
                          <Link
                            href={`/templates/${templateId}/edit`}
                            style={{ color: "#818cf8" }}
                          >
                            Open editor
                          </Link>{" "}
                          and re-scan.
                        </p>
                      )}
                      <button
                        onClick={() => removeRow(field.name, rowIdx)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: colors.textDim }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(248,113,113,0.12)";
                          e.currentTarget.style.color = "#f87171";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = colors.textDim;
                        }}
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => addRow(field.name, subFields)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed text-xs transition-all"
                    style={{
                      borderColor: "rgba(129,140,248,0.15)",
                      color: colors.textDim,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(129,140,248,0.3)";
                      e.currentTarget.style.color = "#818cf8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(129,140,248,0.15)";
                      e.currentTarget.style.color = colors.textDim;
                    }}
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add another row
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* ── Sticky sidebar ── */}
      <div className="hidden lg:flex flex-col gap-4 w-64 shrink-0 sticky top-0">
        {/* Field summary sidebar */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <p
            className="text-xs font-semibold"
            style={{ color: colors.textSecondary }}
          >
            Fields overview
          </p>
          <div className="space-y-1.5">
            {fields.map((f) => {
              const isFilled =
                f.type === "loop"
                  ? (loopRows[f.name]?.length ?? 0) > 0
                  : f.type === "condition" || f.type === "condition_inverse"
                    ? true
                    : !!values[f.name]?.trim();
              return (
                <div key={f.id} className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: isFilled
                        ? "#34d399"
                        : "rgba(255,255,255,0.15)",
                    }}
                  />
                  <span
                    className="flex-1 text-[11px] truncate"
                    style={{
                      color: isFilled ? colors.textSecondary : colors.textMuted,
                    }}
                  >
                    {f.label}
                  </span>
                  {isFilled && (
                    <span className="text-[9px]" style={{ color: "#34d399" }}>
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all"
          style={{
            background: generating
              ? "rgba(99,102,241,0.1)"
              : "rgba(99,102,241,0.2)",
            color: generating ? colors.textMuted : "#a5b4fc",
            border: `1px solid ${generating ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.3)"}`,
            cursor: generating ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!generating) {
              e.currentTarget.style.background = "rgba(99,102,241,0.3)";
              e.currentTarget.style.boxShadow = "0 0 20px rgba(99,102,241,0.2)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(99,102,241,0.2)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {generating ? (
            <>
              <div
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: colors.accentLight }}
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
      </div>

      {/* Mobile generate button */}
      <div className="lg:hidden fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl transition-all"
          style={{
            background: "rgba(99,102,241,0.9)",
            color: "#fff",
            boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
            opacity: generating ? 0.5 : 1,
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
              Generate
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
}: {
  fields: TemplateField[];
  templateId: Id<"templates">;
  templateName: string;
  fileUrl: string;
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
  const xlsxRef = useRef<HTMLInputElement>(null);

  const simpleFields = fields.filter(
    (f) =>
      f.type !== "loop" &&
      f.type !== "condition" &&
      f.type !== "condition_inverse"
  );
  const fieldNames = simpleFields.map((f) => f.name);
  const unmapped = fieldNames.filter((n) => !headers.includes(n));

  const downloadExcelTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      simpleFields.map((f) => f.name),
      simpleFields.map((f) =>
        f.type === "date"
          ? "March 12, 2026"
          : f.type === "number"
            ? "1000"
            : `example_${f.name}`
      ),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${templateName}_data.xlsx`);
  };

  const handleXlsxUpload = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
        defval: "",
      });
      if (!data.length) {
        toast.error("No data found in the Excel file.");
        return;
      }
      setRows(data);
      setHeaders(Object.keys(data[0]));
      setStep(2);
    } catch (err) {
      toast.error("Couldn't read Excel file.");
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
      if (!res.ok) throw new Error("Failed to fetch template");
      const templateBuffer = await res.arrayBuffer();
      const processedBuffer = await preprocessTemplate(templateBuffer);
      const outputZip = new JSZip();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const data: Record<string, unknown> = {};
          for (const f of fields) {
            if (f.type === "condition" || f.type === "condition_inverse")
              data[f.name] = row[f.name] === "true";
            else if (f.type === "loop") data[f.name] = [];
            else data[f.name] = row[f.name] ?? "";
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
            .replace(/{{(\w+)}}/g, (_, key) => row[key] ?? "")
            .replace(/[<>:"/\\|?*]/g, "_");
          if (!filename.endsWith(".docx")) filename += ".docx";
          outputZip.file(filename, out);
        } catch (err: any) {
          errors.push(
            `Row ${i + 1}: ${err?.properties?.errors?.map((e: any) => e.message).join(", ") ?? err.message}`
          );
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
    } catch (err) {
      toast.error("Bulk generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex gap-6 items-start">
      {/* Left: instructions panel */}
      <div className="w-72 shrink-0 sticky top-0 space-y-3">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${colors.border}` }}
        >
          {[
            {
              n: 1,
              label: "Download template",
              desc: "Get the Excel file with correct column headers",
            },
            {
              n: 2,
              label: "Upload filled data",
              desc: "Upload your completed Excel file",
            },
            {
              n: 3,
              label: "Set filename & generate",
              desc: "Choose naming pattern and generate ZIP",
            },
          ].map(({ n, label, desc }) => (
            <div
              key={n}
              className="flex items-start gap-3 p-4 transition-colors"
              style={{
                background:
                  step === n ? "rgba(99,102,241,0.07)" : "transparent",
                borderBottom: n < 3 ? `1px solid ${colors.border}` : "none",
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                style={{
                  background:
                    step > n
                      ? "rgba(52,211,153,0.2)"
                      : step === n
                        ? "rgba(99,102,241,0.25)"
                        : "rgba(255,255,255,0.06)",
                  color:
                    step > n
                      ? "#34d399"
                      : step === n
                        ? "#a5b4fc"
                        : colors.textDim,
                  border: `1px solid ${step > n ? "rgba(52,211,153,0.3)" : step === n ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {step > n ? "✓" : n}
              </div>
              <div>
                <p
                  className="text-xs font-semibold"
                  style={{
                    color:
                      step === n
                        ? colors.text
                        : step > n
                          ? colors.textMuted
                          : colors.textDim,
                  }}
                >
                  {label}
                </p>
                <p
                  className="text-[10px] mt-0.5"
                  style={{ color: colors.textDim }}
                >
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl p-4 space-y-2"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: colors.textDim }}
          >
            Expected columns
          </p>
          <div className="space-y-1.5">
            {simpleFields.map((f) => {
              const c = fieldTypeColors[f.type] ?? "#6b7280";
              const mapped = headers.includes(f.name);
              return (
                <div key={f.id} className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background:
                        headers.length > 0
                          ? mapped
                            ? "#34d399"
                            : "#f87171"
                          : c,
                    }}
                  />
                  <code
                    className="text-[10px] font-mono flex-1 truncate"
                    style={{ color: colors.textSecondary }}
                  >
                    {f.name}
                  </code>
                  <span
                    className="text-[9px] px-1 py-px rounded"
                    style={{ background: `${c}12`, color: c }}
                  >
                    {f.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: step content */}
      <div className="flex-1 min-w-0">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3
                className="text-sm font-semibold mb-1"
                style={{ color: colors.text }}
              >
                Step 1 — Download the data template
              </h3>
              <p
                className="text-xs leading-relaxed"
                style={{ color: colors.textMuted }}
              >
                The Excel template has the correct column headers matching your
                template fields. Fill each row with data for one document. Date
                fields accept any text format.
              </p>
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${colors.border}` }}
            >
              <div
                className="px-4 py-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: colors.textDim }}
                >
                  Preview of {templateName}_data.xlsx
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                      {simpleFields.map((f) => (
                        <th
                          key={f.name}
                          className="px-3 py-2 text-left font-medium whitespace-nowrap"
                          style={{
                            color: fieldTypeColors[f.type] ?? colors.textMuted,
                          }}
                        >
                          {f.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2].map((row) => (
                      <tr
                        key={row}
                        style={{
                          borderBottom:
                            row < 2 ? `1px solid ${colors.border}` : "none",
                        }}
                      >
                        {simpleFields.map((f) => (
                          <td
                            key={f.name}
                            className="px-3 py-2 whitespace-nowrap"
                            style={{ color: colors.textDim }}
                          >
                            {f.type === "date"
                              ? "March 12, 2026"
                              : f.type === "number"
                                ? `${row * 1000}`
                                : `example_${f.name}_${row}`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadExcelTemplate}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-all"
                style={{
                  background: "rgba(52,211,153,0.1)",
                  color: "#34d399",
                  border: "1px solid rgba(52,211,153,0.2)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(52,211,153,0.18)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(52,211,153,0.1)")
                }
              >
                <DownloadIcon className="w-4 h-4" />
                Download {templateName}_data.xlsx
              </button>
              <button
                onClick={() => xlsxRef.current?.click()}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
                }
              >
                <UploadIcon className="w-4 h-4" />
                Upload filled Excel
              </button>
              <input
                ref={xlsxRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleXlsxUpload(f);
                }}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className="text-sm font-semibold mb-0.5"
                  style={{ color: colors.text }}
                >
                  Step 2 — Review your data
                </h3>
                <p className="text-xs" style={{ color: colors.textMuted }}>
                  {rows.length} row{rows.length !== 1 ? "s" : ""} loaded
                  {unmapped.length > 0
                    ? ` · ${unmapped.length} column${unmapped.length !== 1 ? "s" : ""} unmatched`
                    : " · all columns matched ✓"}
                </p>
              </div>
              <span
                className="text-[10px] font-medium px-2.5 py-1 rounded-full"
                style={{
                  background:
                    unmapped.length === 0
                      ? "rgba(52,211,153,0.12)"
                      : "rgba(251,191,36,0.12)",
                  color: unmapped.length === 0 ? "#34d399" : "#fbbf24",
                  border: `1px solid ${unmapped.length === 0 ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.25)"}`,
                }}
              >
                {unmapped.length === 0
                  ? `${fieldNames.length}/${fieldNames.length} matched`
                  : `${fieldNames.length - unmapped.length}/${fieldNames.length} matched`}
              </span>
            </div>

            {unmapped.length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{
                  background: "rgba(251,191,36,0.06)",
                  border: "1px solid rgba(251,191,36,0.15)",
                }}
              >
                <p className="text-[11px] mb-2" style={{ color: "#fbbf24" }}>
                  Missing columns — these fields will be empty:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unmapped.map((n) => (
                    <code
                      key={n}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                      style={{
                        background: "rgba(251,191,36,0.1)",
                        color: "#fbbf24",
                        border: "1px solid rgba(251,191,36,0.2)",
                      }}
                    >
                      {n}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <div
              className="rounded-xl overflow-auto max-h-64"
              style={{ border: `1px solid ${colors.border}` }}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <th
                      className="px-3 py-2 text-left w-10 font-medium"
                      style={{ color: colors.textDim }}
                    >
                      #
                    </th>
                    {headers.slice(0, 6).map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-medium whitespace-nowrap"
                        style={{
                          color: fieldNames.includes(h)
                            ? colors.accentLight
                            : colors.textMuted,
                        }}
                      >
                        {h}
                        {fieldNames.includes(h) && (
                          <span className="ml-1" style={{ color: "#34d399" }}>
                            ✓
                          </span>
                        )}
                      </th>
                    ))}
                    {headers.length > 6 && (
                      <th
                        className="px-3 py-2"
                        style={{ color: colors.textDim }}
                      >
                        +{headers.length - 6}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 6).map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: `1px solid ${colors.border}` }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(255,255,255,0.02)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        className="px-3 py-2"
                        style={{ color: colors.textDim }}
                      >
                        {i + 1}
                      </td>
                      {headers.slice(0, 6).map((h) => (
                        <td
                          key={h}
                          className="px-3 py-2 max-w-[140px] truncate"
                          style={{ color: colors.text }}
                        >
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 6 && (
              <p className="text-[11px]" style={{ color: colors.textDim }}>
                +{rows.length - 6} more rows not shown
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
                }}
              >
                ← Change file
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl transition-all"
                style={{
                  background: "rgba(99,102,241,0.18)",
                  color: "#a5b4fc",
                  border: "1px solid rgba(99,102,241,0.28)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(99,102,241,0.28)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(99,102,241,0.18)")
                }
              >
                Set filename & generate →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3
                className="text-sm font-semibold mb-0.5"
                style={{ color: colors.text }}
              >
                Step 3 — Set filename pattern
              </h3>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Define how each generated file will be named. Click a token to
                insert it.
              </p>
            </div>

            <div className="space-y-3">
              <input
                value={filenamePattern}
                onChange={(e) => setFilenamePattern(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.accentBorder}`)
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border = `1px solid ${colors.border}`)
                }
              />

              <div className="flex flex-wrap gap-1.5">
                {[
                  "{{row_number}}",
                  ...simpleFields.slice(0, 4).map((f) => `{{${f.name}}}`),
                ].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => setFilenamePattern((p) => p + token)}
                    className="text-[10px] font-mono px-2 py-1 rounded-lg cursor-pointer transition-colors"
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      color: "#818cf8",
                      border: "1px solid rgba(99,102,241,0.2)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(99,102,241,0.2)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(99,102,241,0.1)")
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
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <p
                    className="text-[10px] mb-1"
                    style={{ color: colors.textDim }}
                  >
                    Preview (row 1):
                  </p>
                  <code
                    className="text-[11px] font-mono"
                    style={{ color: colors.textSecondary }}
                  >
                    {filenamePattern
                      .replace(/{{row_number}}/g, "001")
                      .replace(/{{(\w+)}}/g, (_, k) => rows[0][k] ?? k)}
                    .docx
                  </code>
                </div>
              )}
            </div>

            {generating && (
              <div
                className="rounded-xl p-4 space-y-2"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="flex justify-between text-xs">
                  <span style={{ color: colors.textMuted }}>
                    {Math.round((progress / 100) * rows.length)} / {rows.length}{" "}
                    documents
                  </span>
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: colors.accentLight }}
                  >
                    {progress}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(90deg, #6366f1, #818cf8)",
                    }}
                  />
                </div>
              </div>
            )}

            {bulkErrors.length > 0 && (
              <div
                className="rounded-xl p-4 space-y-2"
                style={{
                  background: "rgba(248,113,113,0.06)",
                  border: "1px solid rgba(248,113,113,0.2)",
                }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{ color: "#f87171" }}
                >
                  {bulkErrors.length} row{bulkErrors.length !== 1 ? "s" : ""}{" "}
                  failed
                </p>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {bulkErrors.map((e, i) => (
                    <p
                      key={i}
                      className="text-[10px]"
                      style={{ color: colors.textMuted }}
                    >
                      {e}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                disabled={generating}
                className="flex items-center gap-1 text-xs font-medium px-4 py-2 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleBulkGenerate}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-all"
                style={{
                  background: generating
                    ? "rgba(99,102,241,0.1)"
                    : "rgba(99,102,241,0.2)",
                  color: generating ? colors.textMuted : "#a5b4fc",
                  border: `1px solid ${generating ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.3)"}`,
                }}
                onMouseEnter={(e) => {
                  if (!generating)
                    e.currentTarget.style.background = "rgba(99,102,241,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(99,102,241,0.2)";
                }}
              >
                {generating ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: colors.accentLight }}
                    />
                    Generating…
                  </>
                ) : (
                  <>
                    <DownloadIcon className="w-4 h-4" />
                    Generate {rows.length} document
                    {rows.length !== 1 ? "s" : ""} as ZIP
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplateFillPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as Id<"templates">;
  const template = useQuery(api.templates.getById, { id: templateId });

  if (template === undefined) {
    return (
      <div className="flex flex-col h-full" style={{ background: colors.bg }}>
        <div
          className="px-6 py-5 animate-pulse"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div
            className="h-3 rounded w-40 mb-3"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <div
            className="h-5 rounded w-56"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: colors.accentLight }}
          />
        </div>
      </div>
    );
  }

  if (template === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        style={{ background: colors.bg }}
      >
        <AlertCircleIcon className="w-8 h-8" style={{ color: colors.danger }} />
        <p className="text-sm font-semibold" style={{ color: colors.text }}>
          Template not found
        </p>
        <button
          onClick={() => router.push("/templates")}
          className="text-xs font-medium px-4 py-2 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
          }}
        >
          Back to Templates
        </button>
      </div>
    );
  }

  const fields = template.fields as TemplateField[];
  const tmplTags = (template as any).tags as string[] | undefined;

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      {/* Header */}
      <div
        className="px-6 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          {[
            { href: "/templates", label: "Templates" },
            { href: `/templates/${templateId}/edit`, label: template.name },
          ].map(({ href, label }, i) => (
            <span key={href} className="flex items-center gap-1.5">
              {i > 0 && (
                <span style={{ color: colors.textDim, fontSize: 11 }}>/</span>
              )}
              <Link
                href={href}
                className="text-[11px] transition-colors"
                style={{ color: colors.textMuted }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = colors.accentLight)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = colors.textMuted)
                }
              >
                {label}
              </Link>
            </span>
          ))}
          <span style={{ color: colors.textDim, fontSize: 11 }}>/</span>
          <span className="text-[11px]" style={{ color: colors.textSecondary }}>
            Fill
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.25)",
              }}
            >
              <FileTextIcon className="w-4 h-4" style={{ color: "#818cf8" }} />
            </div>
            <div>
              <h1
                className="text-base font-semibold"
                style={{ color: colors.text }}
              >
                {template.name}
              </h1>
              {template.description && (
                <p
                  className="text-xs mt-0.5"
                  style={{ color: colors.textMuted }}
                >
                  {template.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                  style={{
                    background: "rgba(99,102,241,0.12)",
                    color: "#818cf8",
                  }}
                >
                  {fields.length} field{fields.length !== 1 ? "s" : ""}
                </span>
                {[...new Set(fields.map((f) => f.type))].map((type) => {
                  const count = fields.filter((f) => f.type === type).length;
                  const c = fieldTypeColors[type] ?? "#6b7280";
                  return (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md"
                      style={{
                        background: `${c}12`,
                        color: c,
                        border: `1px solid ${c}20`,
                      }}
                    >
                      {count} {type}
                    </span>
                  );
                })}
                {tmplTags?.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md"
                    style={{
                      background: "rgba(129,140,248,0.1)",
                      color: "#818cf8",
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
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl shrink-0 transition-colors"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = colors.textSecondary)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = colors.textMuted)
            }
          >
            <PencilIcon className="w-3.5 h-3.5" />
            Edit
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Tabs defaultValue="single">
          <TabsList
            className="mb-6"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <TabsTrigger value="single" className="text-xs">
              Single document
            </TabsTrigger>
            <TabsTrigger value="bulk" className="text-xs">
              Bulk from Excel
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            <SingleForm
              fields={fields}
              templateId={template._id}
              templateName={template.name}
              fileUrl={template.fileUrl}
            />
          </TabsContent>
          <TabsContent value="bulk">
            <BulkForm
              fields={fields}
              templateId={template._id}
              templateName={template.name}
              fileUrl={template.fileUrl}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
