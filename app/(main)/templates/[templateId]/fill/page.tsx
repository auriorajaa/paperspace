"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useRef, useMemo } from "react";
import {
  ChevronLeftIcon,
  AlertCircleIcon,
  DownloadIcon,
  UploadIcon,
  PencilIcon,
  FileTextIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import type { TemplateField } from "../../_components/FieldCard";

// ── Single Generate ───────────────────────────────────────────────────────────

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
  // loopRows: { [fieldName]: Array<Record<subFieldName, string>> }
  const [loopRows, setLoopRows] = useState<
    Record<string, Record<string, string>[]>
  >({});
  const [generating, setGenerating] = useState(false);

  const simpleFields = fields.filter((f) => f.type !== "loop");
  const loopFields = fields.filter((f) => f.type === "loop");

  // Add a blank row to a loop field
  const addRow = (fieldName: string, subFields: TemplateField["subFields"]) => {
    const blank: Record<string, string> = {};
    (subFields ?? []).forEach((sf) => (blank[sf.name] = ""));
    setLoopRows((prev) => ({
      ...prev,
      [fieldName]: [...(prev[fieldName] ?? []), blank],
    }));
  };

  // Update a specific cell in a loop row
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

  // Remove a row from a loop field
  const removeRow = (fieldName: string, rowIdx: number) => {
    setLoopRows((prev) => {
      const rows = [...(prev[fieldName] ?? [])];
      rows.splice(rowIdx, 1);
      return { ...prev, [fieldName]: rows };
    });
  };

  const handleGenerate = async () => {
    // Validate required simple fields
    const missing = simpleFields
      .filter(
        (f) =>
          f.required &&
          f.type !== "condition" &&
          f.type !== "condition_inverse" &&
          !values[f.name]?.trim()
      )
      .map((f) => f.label);

    if (missing.length) {
      toast.error(`Fill in required fields: ${missing.join(", ")}`);
      return;
    }

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

      // Build data object
      const data: Record<string, unknown> = {};

      // Simple fields
      for (const f of simpleFields) {
        if (f.type === "condition" || f.type === "condition_inverse") {
          data[f.name] = values[f.name] === "true";
        } else {
          data[f.name] = values[f.name] ?? "";
        }
      }

      // Loop fields — use the rows the user filled in
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
      const detail = err?.properties?.errors
        ?.map((e: any) => e.message)
        .join(", ");
      toast.error(
        detail ?? "Generation failed. Check your template placeholders."
      );
    } finally {
      setGenerating(false);
    }
  };

  if (simpleFields.length === 0 && loopFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <FileTextIcon className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No fields detected</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Go back to the editor, add{" "}
          <code className="font-mono bg-muted px-1 rounded">
            {"{{placeholders}}"}
          </code>{" "}
          to your document, then click Save.
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/templates/${templateId}/edit`}>
            <PencilIcon className="w-3.5 h-3.5 mr-1.5" />
            Open editor
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* ── Simple fields ── */}
      {simpleFields.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Fields</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {simpleFields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={`f-${field.id}`} className="text-xs">
                  {field.label}
                  {field.required &&
                    field.type !== "condition" &&
                    field.type !== "condition_inverse" && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  <span className="ml-1.5 text-[10px] text-muted-foreground font-normal uppercase tracking-wide">
                    {field.type}
                  </span>
                </Label>

                {field.type === "condition" ||
                field.type === "condition_inverse" ? (
                  <div className="flex gap-2">
                    {["true", "false"].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() =>
                          setValues((v) => ({ ...v, [field.name]: val }))
                        }
                        className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          (values[field.name] ?? "true") === val
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {val === "true" ? "Show" : "Hide"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Input
                    id={`f-${field.id}`}
                    type={
                      field.type === "date"
                        ? "date"
                        : field.type === "number"
                          ? "number"
                          : field.type === "email"
                            ? "email"
                            : "text"
                    }
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                    value={values[field.name] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: e.target.value }))
                    }
                    className="h-9 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Loop fields ── */}
      {loopFields.map((field) => {
        const rows = loopRows[field.name] ?? [];
        const subFields = field.subFields ?? [];

        return (
          <section key={field.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  {field.label}
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600">
                    loop · {rows.length} row{rows.length !== 1 ? "s" : ""}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Each row becomes one repeated block in the document.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addRow(field.name, subFields)}
                className="gap-1.5 shrink-0"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Add row
              </Button>
            </div>

            {rows.length === 0 ? (
              /* Empty state */
              <div
                onClick={() => addRow(field.name, subFields)}
                className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/20 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-5 h-5 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">
                  Click to add the first row
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Sub-field column headers */}
                {subFields.length > 0 && (
                  <div
                    className="grid gap-2 px-3"
                    style={{
                      gridTemplateColumns: `repeat(${subFields.length}, 1fr) 32px`,
                    }}
                  >
                    {subFields.map((sf) => (
                      <p
                        key={sf.id}
                        className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
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
                    className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/10 group"
                  >
                    <span className="text-[10px] text-muted-foreground font-mono w-5 shrink-0 text-center">
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
                          <Input
                            key={sf.name}
                            type={
                              sf.type === "number"
                                ? "number"
                                : sf.type === "date"
                                  ? "date"
                                  : "text"
                            }
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
                            className="h-8 text-sm"
                          />
                        ))}
                      </div>
                    ) : (
                      /* Loop has no defined sub-fields — show a freeform key-value adder */
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">
                          Row {rowIdx + 1} — no sub-fields defined.{" "}
                          <Link
                            href={`/templates/${templateId}/edit`}
                            className="text-primary hover:underline"
                          >
                            Go to editor
                          </Link>{" "}
                          and re-scan to detect columns.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => removeRow(field.name, rowIdx)}
                      className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all shrink-0"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add another row */}
                <button
                  onClick={() => addRow(field.name, subFields)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-muted/20 transition-colors text-xs text-muted-foreground"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Add another row
                </button>
              </div>
            )}
          </section>
        );
      })}

      {/* ── Generate button ── */}
      <Button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full gap-2"
        size="lg"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <DownloadIcon className="w-4 h-4" />
            Generate & Download
          </>
        )}
      </Button>
    </div>
  );
}

// ── Bulk Generate ─────────────────────────────────────────────────────────────

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
    (f) => f.type !== "loop" && f.type !== "condition"
  );

  const downloadExcelTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      simpleFields.map((f) => f.name),
      simpleFields.map((f) => `example_${f.name}`),
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
      console.error(err);
      toast.error(
        "Couldn't read Excel file. Make sure it's a valid .xlsx file."
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
      if (!res.ok) throw new Error("Failed to fetch template");
      const templateBuffer = await res.arrayBuffer();
      const processedBuffer = await preprocessTemplate(templateBuffer);

      const outputZip = new JSZip();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const data: Record<string, unknown> = {};
          for (const f of fields) {
            if (f.type === "condition") data[f.name] = row[f.name] === "true";
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
          const msg =
            err?.properties?.errors?.map((e: any) => e.message).join(", ") ??
            err.message;
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
    } catch (err) {
      console.error(err);
      toast.error("Bulk generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const fieldNames = simpleFields.map((f) => f.name);
  const unmapped = fieldNames.filter((n) => !headers.includes(n));

  // Step 1
  if (step === 1)
    return (
      <div className="space-y-4 max-w-md">
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              1
            </div>
            <p className="text-sm font-medium">Download the data template</p>
          </div>
          <p className="text-xs text-muted-foreground pl-8">
            Fill each row with data for one document. Column headers must match
            field names exactly.
          </p>
          <div className="pl-8">
            <Button
              size="sm"
              variant="outline"
              onClick={downloadExcelTemplate}
              className="gap-1.5"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              Download {templateName}_data.xlsx
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              2
            </div>
            <p className="text-sm font-medium">Upload filled Excel</p>
          </div>
          <div className="pl-8">
            <Button
              size="sm"
              variant="outline"
              onClick={() => xlsxRef.current?.click()}
              className="gap-1.5"
            >
              <UploadIcon className="w-3.5 h-3.5" />
              Choose .xlsx file
            </Button>
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
      </div>
    );

  // Step 2: preview + mapping
  if (step === 2)
    return (
      <div className="space-y-4 max-w-lg">
        {/* Mapping */}
        <div className="rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {fieldNames.length - unmapped.length}/{fieldNames.length} fields
              matched
            </p>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                unmapped.length === 0
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {unmapped.length === 0
                ? "All matched ✓"
                : `${unmapped.length} unmatched`}
            </span>
          </div>
          {unmapped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Missing:{" "}
              {unmapped.map((n) => (
                <code
                  key={n}
                  className="font-mono bg-muted px-1 rounded mx-0.5 text-[11px]"
                >
                  {n}
                </code>
              ))}
            </p>
          )}
        </div>

        {/* Data preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {rows.length} row{rows.length !== 1 ? "s" : ""} loaded
          </p>
          <div className="rounded-xl border border-border overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-3 py-2 text-left text-muted-foreground font-medium w-10">
                    #
                  </th>
                  {headers.slice(0, 5).map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-muted-foreground font-medium"
                    >
                      {h}
                    </th>
                  ))}
                  {headers.length > 5 && (
                    <th className="px-3 py-2 text-muted-foreground">
                      +{headers.length - 5}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    {headers.slice(0, 5).map((h) => (
                      <td key={h} className="px-3 py-2 truncate max-w-[120px]">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && (
            <p className="text-xs text-muted-foreground">
              Showing first 5 of {rows.length} rows
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep(1)}
            className="gap-1"
          >
            ← Change file
          </Button>
          <Button onClick={() => setStep(3)} className="flex-1">
            Set filename & generate →
          </Button>
        </div>
      </div>
    );

  // Step 3: filename + generate
  return (
    <div className="space-y-5 max-w-md">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Filename pattern</Label>
        <Input
          value={filenamePattern}
          onChange={(e) => setFilenamePattern(e.target.value)}
          className="h-9 text-sm font-mono"
        />
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>
            Available:{" "}
            <code className="font-mono bg-muted px-1 rounded text-[11px]">
              {"{{row_number}}"}
            </code>
            {simpleFields.slice(0, 2).map((f) => (
              <code
                key={f.name}
                className="font-mono bg-muted px-1 rounded text-[11px] ml-1"
              >
                {`{{${f.name}}}`}
              </code>
            ))}
          </p>
          {rows.length > 0 && (
            <p>
              Preview:{" "}
              <code className="font-mono bg-muted px-1 rounded text-[11px]">
                {filenamePattern
                  .replace(/{{row_number}}/g, "001")
                  .replace(/{{(\w+)}}/g, (_, k) => rows[0][k] ?? k)}
                .docx
              </code>
            </p>
          )}
        </div>
      </div>

      {/* Progress */}
      {generating && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {Math.round((progress / 100) * rows.length)} / {rows.length}{" "}
              documents
            </span>
            <span className="font-medium tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Errors */}
      {bulkErrors.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-xs font-medium text-destructive">
            {bulkErrors.length} row{bulkErrors.length !== 1 ? "s" : ""} failed
          </p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {bulkErrors.slice(0, 5).map((e, i) => (
              <p key={i} className="text-[10px] text-muted-foreground">
                {e}
              </p>
            ))}
          </div>
          {bulkErrors.length > 5 && (
            <p className="text-[10px] text-muted-foreground">
              +{bulkErrors.length - 5} more — see _errors.txt in the ZIP
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStep(2)}
          disabled={generating}
        >
          ← Back
        </Button>
        <Button
          onClick={handleBulkGenerate}
          disabled={generating}
          className="flex-1 gap-1.5"
        >
          {generating ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <DownloadIcon className="w-3.5 h-3.5" />
              Generate {rows.length} documents
            </>
          )}
        </Button>
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
      <div className="flex flex-col h-full">
        <div className="px-6 py-5 border-b border-border animate-pulse">
          <div className="h-5 bg-muted rounded w-48" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (template === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircleIcon className="w-8 h-8 text-destructive" />
        <p className="text-sm font-semibold">Template not found</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/templates")}
        >
          Back to Templates
        </Button>
      </div>
    );
  }

  const fields = template.fields as TemplateField[];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/templates"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Templates
          </Link>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <Link
            href={`/templates/${templateId}/edit`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {template.name}
          </Link>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <span className="text-xs text-foreground">Fill</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold">{template.name}</h1>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {template.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {fields.length} field{fields.length !== 1 ? "s" : ""} detected
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            asChild
            className="gap-1.5 shrink-0"
          >
            <Link href={`/templates/${templateId}/edit`}>
              <PencilIcon className="w-3.5 h-3.5" />
              Edit template
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Tabs defaultValue="single">
          <TabsList className="mb-6">
            <TabsTrigger value="single">Single document</TabsTrigger>
            <TabsTrigger value="bulk">Bulk from Excel</TabsTrigger>
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
