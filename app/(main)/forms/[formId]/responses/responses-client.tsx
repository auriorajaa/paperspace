/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { format, formatDistanceToNow, isValid } from "date-fns";
import {
  ArrowLeftIcon,
  DownloadIcon,
  SearchIcon,
  InboxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  AlertCircleIcon,
  XIcon,
  CheckIcon,
  MinusIcon,
  LinkIcon,
  ExternalLinkIcon,
  ChevronRightIcon as ArrowRightIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormQuestion {
  id: string;
  title: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface FormResponse {
  _id: string;
  formId: string;
  answers: { questionId: string; value: string }[];
  submittedAt: number;
  respondentEmail?: string;
}

interface FormDoc {
  _id: string;
  title: string;
  description?: string;
  schema: FormQuestion[];
  status: string;
  publicId: string;
  settings: {
    acceptResponses: boolean;
    confirmationMessage?: string;
    themeColor?: string;
  };
}

type SortKey = "newest" | "oldest" | "email";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  email: "By email",
};

interface Stats {
  total: number;
  withEmail: number;
  avgCompletion: number;
  latest: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeDate(ts: number): Date | null {
  try {
    const d = new Date(ts);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

function fmt(ts: number, f: string): string {
  const d = safeDate(ts);
  return d ? format(d, f) : "—";
}

function fmtRelative(ts: number): string {
  const d = safeDate(ts);
  if (!d) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

function getAnswer(r: FormResponse, questionId: string): string {
  return r.answers.find((a) => a.questionId === questionId)?.value ?? "";
}

function completionRate(r: FormResponse, schema: FormQuestion[]): number {
  if (!schema.length) return 100;
  const answered = schema.filter(
    (q) => getAnswer(r, q.id).trim() !== ""
  ).length;
  return Math.round((answered / schema.length) * 100);
}

function doExportCsv(form: FormDoc, responses: FormResponse[]): void {
  try {
    const headers = form.schema.map((q) => `"${q.title.replace(/"/g, '""')}"`);
    const csv = [
      ["#", "Submitted at", "Email", ...headers].join(","),
      ...responses.map((r, i) =>
        [
          i + 1,
          `"${fmt(r.submittedAt, "yyyy-MM-dd HH:mm:ss")}"`,
          `"${(r.respondentEmail ?? "").replace(/"/g, '""')}"`,
          ...form.schema.map(
            (q) => `"\t${getAnswer(r, q.id).replace(/"/g, '""')}"`
          ),
        ].join(",")
      ),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.title.replace(/[^a-z0-9]/gi, "_")}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("[exportCsv]", e);
  }
}

// ─── Portal ───────────────────────────────────────────────────────────────────
// Mounts into document.body, fully escaping any parent stacking context
// (sidebar CSS transitions create new stacking contexts that trap fixed children)

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResponsesPageClient() {
  const params = useParams();
  const formId = params.formId as Id<"internalForms">;
  const { isLoaded, isSignedIn } = useAuth();

  const form = useQuery(
    api.internalForms.getById,
    isLoaded && isSignedIn ? { id: formId } : "skip"
  ) as FormDoc | null | undefined;

  const responses = useQuery(
    api.internalFormResponses.getByFormId,
    isLoaded && isSignedIn ? { formId } : "skip"
  ) as FormResponse[] | undefined;

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [detailIdx, setDetailIdx] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const isLoading = !isLoaded || form === undefined || responses === undefined;

  const sorted = useMemo<FormResponse[]>(() => {
    if (!responses) return [];
    const c = [...responses];
    if (sortKey === "newest") c.sort((a, b) => b.submittedAt - a.submittedAt);
    else if (sortKey === "oldest")
      c.sort((a, b) => a.submittedAt - b.submittedAt);
    else
      c.sort((a, b) =>
        (a.respondentEmail ?? "").localeCompare(b.respondentEmail ?? "")
      );
    return c;
  }, [responses, sortKey]);

  const filtered = useMemo<FormResponse[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        r.respondentEmail?.toLowerCase().includes(q) ||
        r.answers.some((a) => a.value?.toLowerCase().includes(q))
    );
  }, [sorted, search]);

  const stats = useMemo<Stats | null>(() => {
    if (!responses?.length || !form) return null;
    const rates = responses.map((r) => completionRate(r, form.schema));
    return {
      total: responses.length,
      withEmail: responses.filter((r) => r.respondentEmail).length,
      avgCompletion: Math.round(
        rates.reduce((a, b) => a + b, 0) / rates.length
      ),
      latest: Math.max(...responses.map((r) => r.submittedAt)),
    };
  }, [responses, form]);

  // Keyboard navigation when detail panel is open
  useEffect(() => {
    if (detailIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetailIdx(null);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setDetailIdx((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setDetailIdx((i) =>
          i !== null && i < filtered.length - 1 ? i + 1 : i
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailIdx, filtered.length]);

  const copyLink = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard
      .writeText(`${origin}/f/${form?.publicId ?? ""}`)
      .then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      })
      .catch(() => {});
  }, [form?.publicId]);

  // ── States ──

  if (isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent-light)" }}
        />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <Fullscreen
        title="Not signed in"
        description="Please sign in to view form responses."
      />
    );
  }

  if (form === null) {
    return (
      <Fullscreen
        title="Form not found"
        description="This form may have been deleted or you don't have access to it."
        action={<BackLink />}
      />
    );
  }

  const hasResponses = (responses?.length ?? 0) > 0;
  const detailResponse =
    detailIdx !== null ? (filtered[detailIdx] ?? null) : null;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* ══ Header ══════════════════════════════════════════════════════════ */}
      <div
        className="shrink-0 px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Link
            href="/forms"
            className="text-[11px] flex items-center gap-1"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Forms
          </Link>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <Link
            href={`/forms/${formId}/builder`}
            className="text-[11px] max-w-[140px] truncate"
            style={{ color: "var(--text-muted)" }}
            title={form.title}
          >
            {form.title}
          </Link>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Responses
          </span>
        </div>

        {/* Title + actions */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1
              className="text-[15px] sm:text-base font-semibold leading-snug"
              style={{ color: "var(--text)" }}
            >
              {!hasResponses
                ? "No responses yet"
                : `${responses!.length} response${responses!.length !== 1 ? "s" : ""}`}
            </h1>
            {stats && (
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-dim)" }}
              >
                {stats.avgCompletion}% avg. completion
                {stats.withEmail > 0 && <> · {stats.withEmail} with email</>}
                {stats.latest && <> · Last {fmtRelative(stats.latest)}</>}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {form.status === "published" && (
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-2 rounded-xl min-h-[36px] transition-all hover:opacity-80"
                style={{
                  background: copiedLink
                    ? "var(--success-bg)"
                    : "var(--bg-muted)",
                  color: copiedLink ? "var(--success)" : "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {copiedLink ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy link</span>
                  </>
                )}
              </button>
            )}
            {hasResponses && (
              <button
                onClick={() => doExportCsv(form, responses!)}
                className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-2 rounded-xl min-h-[36px] transition-all hover:opacity-80"
                style={{
                  background: "var(--bg-muted)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        {hasResponses && (
          <div className="flex items-center gap-2 pb-3">
            <div
              className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-2 rounded-lg"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <SearchIcon
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: "var(--text-dim)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or answer…"
                className="flex-1 bg-transparent outline-none text-[13px] min-w-0"
                style={{ color: "var(--text)" }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="shrink-0 hover:opacity-70"
                  style={{ color: "var(--text-dim)" }}
                >
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium shrink-0 min-h-[36px] whitespace-nowrap"
                  style={{
                    background: "var(--bg-muted)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                  }}
                >
                  {SORT_LABELS[sortKey]}
                  <ChevronDownIcon className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <DropdownMenuItem key={key} onClick={() => setSortKey(key)}>
                    <CheckIcon
                      className="w-3 h-3 mr-2"
                      style={{
                        color: "var(--accent-light)",
                        opacity: sortKey === key ? 1 : 0,
                      }}
                    />
                    {SORT_LABELS[key]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {search && (
              <span
                className="text-[11px] shrink-0 tabular-nums"
                style={{ color: "var(--text-dim)" }}
              >
                {filtered.length}/{responses!.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ══ Body ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {!hasResponses ? (
          <EmptyState form={form} />
        ) : filtered.length === 0 ? (
          <SearchEmpty search={search} onClear={() => setSearch("")} />
        ) : (
          <>
            {/* Desktop: scrollable table */}
            <div className="hidden sm:flex flex-1 flex-col min-h-0 overflow-hidden px-4 sm:px-6">
              <DesktopTable
                filtered={filtered}
                form={form}
                activeIdx={detailIdx}
                onRowClick={(idx) =>
                  setDetailIdx(detailIdx === idx ? null : idx)
                }
              />
            </div>

            {/* Mobile: card list */}
            <div className="sm:hidden flex-1 overflow-y-auto">
              <MobileCards
                filtered={filtered}
                form={form}
                onCardClick={(idx) => setDetailIdx(idx)}
              />
            </div>
          </>
        )}
      </div>

      {/* ══ Detail panel via Portal ══════════════════════════════════════════ */}
      {detailResponse !== null && detailIdx !== null && (
        <Portal>
          <DetailPanel
            response={detailResponse}
            form={form}
            index={detailIdx}
            total={filtered.length}
            onClose={() => setDetailIdx(null)}
            onPrev={() =>
              setDetailIdx((i) => (i !== null && i > 0 ? i - 1 : i))
            }
            onNext={() =>
              setDetailIdx((i) =>
                i !== null && i < filtered.length - 1 ? i + 1 : i
              )
            }
            canPrev={detailIdx > 0}
            canNext={detailIdx < filtered.length - 1}
          />
        </Portal>
      )}
    </div>
  );
}

// ─── Desktop table ────────────────────────────────────────────────────────────

const MAX_COLS = 4;

function DesktopTable({
  filtered,
  form,
  activeIdx,
  onRowClick,
}: {
  filtered: FormResponse[];
  form: FormDoc;
  activeIdx: number | null;
  onRowClick: (idx: number) => void;
}) {
  const cols = form.schema.slice(0, MAX_COLS);
  const extra = Math.max(0, form.schema.length - MAX_COLS);

  return (
    <div className="flex-1 overflow-auto">
      <table
        className="w-full text-[12px] my-3 border "
        style={{
          minWidth: 560,
          borderRadius: "12px", // rounded-xl
          // border: "1px solid #d1d5db", // border + border-gray-300
          borderCollapse: "separate",
          borderSpacing: "0",
          overflow: "hidden",
        }}
      >
        {/* Sticky header */}
        <thead
          className="sticky top-0 z-10"
          style={{ background: "var(--bg-muted)" }}
        >
          <tr style={{ borderBottom: "2px solid var(--border-subtle)" }}>
            <th
              className="w-10 px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide"
              style={{ color: "var(--text-dim)" }}
            >
              #
            </th>
            <th
              className="px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide"
              style={{ color: "var(--text-dim)", minWidth: 160 }}
            >
              Email
            </th>
            <th
              className="px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide"
              style={{ color: "var(--text-dim)", width: 116 }}
            >
              Submitted
            </th>
            {cols.map((q) => (
              <th
                key={q.id}
                className="px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide"
                style={{ color: "var(--text-dim)", maxWidth: 180 }}
                title={q.title}
              >
                <span className="block truncate max-w-[160px]">{q.title}</span>
              </th>
            ))}
            <th
              className="w-16 px-3 py-2.5 text-right font-semibold text-[11px] uppercase tracking-wide"
              style={{ color: "var(--text-dim)" }}
            >
              {extra > 0 ? `+${extra} more` : "Done"}
            </th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((r, idx) => {
            const active = activeIdx === idx;
            const rate = completionRate(r, form.schema);
            return (
              <tr
                key={r._id}
                onClick={() => onRowClick(idx)}
                className="cursor-pointer"
                style={{
                  background: active ? "var(--accent-bg)" : "transparent",
                  borderBottom: "1px solid var(--border-subtle)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--bg-muted)";
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                }}
              >
                <td
                  className="px-3 py-3 tabular-nums font-medium text-[12px]"
                  style={{ color: "var(--text)" }}
                >
                  {idx + 1}
                </td>
                <td className="px-3 py-3 max-w-[180px]">
                  {r.respondentEmail ? (
                    <span
                      className="block truncate font-medium text-[13px]"
                      style={{ color: "var(--text)" }}
                      title={r.respondentEmail}
                    >
                      {r.respondentEmail}
                    </span>
                  ) : (
                    <span
                      className="italic text-[12px]"
                      style={{ color: "var(--text-dim)" }}
                    >
                      Anonymous
                    </span>
                  )}
                </td>
                <td
                  className="px-3 py-3 whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span className="block text-[12px] tabular-nums">
                    {fmt(r.submittedAt, "MMM d, yyyy")}
                  </span>
                  <span
                    className="block text-[11px] tabular-nums"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {fmt(r.submittedAt, "h:mm a")}
                  </span>
                </td>
                {cols.map((q) => {
                  const val = getAnswer(r, q.id);
                  return (
                    <td key={q.id} className="px-3 py-3 max-w-[180px]">
                      {val ? (
                        <span
                          className="block truncate text-[13px]"
                          style={{ color: "var(--text)" }}
                          title={val}
                        >
                          {val}
                        </span>
                      ) : (
                        <span
                          className="text-[12px]"
                          style={{ color: "var(--text-dim)" }}
                        >
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right">
                  <Badge rate={rate} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {extra > 0 && (
        <div
          className="px-3 py-2.5 text-center text-[11px] sticky bottom-0"
          style={{
            background: "var(--bg-muted)",
            borderTop: "1px solid var(--border-subtle)",
            color: "var(--text-dim)",
          }}
        >
          Showing {MAX_COLS} of {form.schema.length} questions · click a row to
          view all answers
        </div>
      )}
    </div>
  );
}

// ─── Mobile card list ─────────────────────────────────────────────────────────

function MobileCards({
  filtered,
  form,
  onCardClick,
}: {
  filtered: FormResponse[];
  form: FormDoc;
  onCardClick: (idx: number) => void;
}) {
  // On mobile show 2 answer previews max
  const previewCols = form.schema.slice(0, 2);

  return (
    <div className="px-4 py-3 space-y-2">
      {filtered.map((r, idx) => {
        const rate = completionRate(r, form.schema);
        return (
          <button
            key={r._id}
            onClick={() => onCardClick(idx)}
            className="w-full text-left rounded-xl overflow-hidden transition-all active:scale-[0.99]"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Card header */}
            <div
              className="flex items-center justify-between px-3 pt-3 pb-2"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 tabular-nums"
                  style={{
                    background: "var(--bg-muted)",
                    color: "var(--text-dim)",
                  }}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  {r.respondentEmail ? (
                    <p
                      className="text-[13px] font-semibold truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {r.respondentEmail}
                    </p>
                  ) : (
                    <p
                      className="text-[12px] italic"
                      style={{ color: "var(--text-dim)" }}
                    >
                      Anonymous
                    </p>
                  )}
                  <p
                    className="text-[10px] tabular-nums"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {fmt(r.submittedAt, "MMM d, yyyy · h:mm a")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge rate={rate} />
                <ArrowRightIcon
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--text-dim)" }}
                />
              </div>
            </div>

            {/* Answer previews */}
            {previewCols.length > 0 && (
              <div className="px-3 py-2.5 space-y-1.5">
                {previewCols.map((q) => {
                  const val = getAnswer(r, q.id);
                  return (
                    <div key={q.id}>
                      <p
                        className="text-[10px] font-medium truncate"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {q.title}
                      </p>
                      <p
                        className="text-[12px] truncate"
                        style={{
                          color: val.trim() ? "var(--text)" : "var(--text-dim)",
                          fontStyle: val.trim() ? "normal" : "italic",
                        }}
                      >
                        {val.trim() || "No answer"}
                      </p>
                    </div>
                  );
                })}
                {form.schema.length > 2 && (
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--text-dim)" }}
                  >
                    +{form.schema.length - 2} more fields · tap to view all
                  </p>
                )}
              </div>
            )}
          </button>
        );
      })}

      {/* Bottom spacer for mobile nav bar */}
      <div className="h-16" />
    </div>
  );
}

// ─── Detail panel (Portal) ────────────────────────────────────────────────────
// createPortal → document.body fully escapes sidebar stacking context

function DetailPanel({
  response,
  form,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  response: FormResponse;
  form: FormDoc;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const rate = completionRate(response, form.schema);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const rateColor =
    rate === 100
      ? "var(--success)"
      : rate >= 60
        ? "var(--warning, #d97706)"
        : "var(--error, #ef4444)";

  // Inline styles everywhere to guarantee no Tailwind purge issues
  // and no interference from any parent CSS cascade.
  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* ── Panel ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Response detail"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          width: "min(480px, 100vw)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* ── Panel header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {response.respondentEmail ?? "Anonymous respondent"}
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                color: "var(--text-dim)",
              }}
            >
              {fmt(response.submittedAt, "MMM d, yyyy · h:mm a")}
              &nbsp;·&nbsp;
              <span style={{ color: rateColor, fontWeight: 600 }}>
                {rate}% complete
              </span>
            </p>
          </div>

          {/* nav + close */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <IconBtn
              onClick={onPrev}
              disabled={!canPrev}
              label="Previous response"
            >
              <ChevronLeftIcon style={{ width: 13, height: 13 }} />
            </IconBtn>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-dim)",
                minWidth: 40,
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {index + 1} / {total}
            </span>
            <IconBtn onClick={onNext} disabled={!canNext} label="Next response">
              <ChevronRightIcon style={{ width: 13, height: 13 }} />
            </IconBtn>
            <div
              style={{
                width: 1,
                height: 18,
                background: "var(--border-subtle)",
                margin: "0 4px",
              }}
            />
            <IconBtn onClick={onClose} label="Close panel">
              <XIcon style={{ width: 13, height: 13 }} />
            </IconBtn>
          </div>
        </div>

        {/* ── Keyboard hint ── */}
        <div
          style={{
            padding: "5px 16px",
            background: "var(--bg-muted)",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, color: "var(--text-dim)" }}>
            ← → to navigate &nbsp;·&nbsp; Esc to close
          </p>
        </div>

        {/* ── Answers ── */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {form.schema.map((q, qi) => {
            const val = getAnswer(response, q.id);
            const has = val.trim() !== "";
            const missed = !has && q.required;

            return (
              <div
                key={q.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: missed
                    ? "color-mix(in srgb, var(--warning, #d97706) 7%, transparent)"
                    : "transparent",
                }}
              >
                {/* Status dot */}
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {missed ? (
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background:
                          "color-mix(in srgb, var(--warning, #d97706) 18%, transparent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MinusIcon
                        style={{
                          width: 9,
                          height: 9,
                          color: "var(--warning, #d97706)",
                        }}
                      />
                    </div>
                  ) : has ? (
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "var(--success-bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckIcon
                        style={{ width: 9, height: 9, color: "var(--success)" }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "var(--bg-muted)",
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: "0 0 3px",
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--text-muted)",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-dim)",
                        marginRight: 3,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {qi + 1}.
                    </span>
                    {q.title}
                    {q.required && (
                      <span
                        style={{
                          color: "var(--warning, #d97706)",
                          marginLeft: 2,
                        }}
                      >
                        *
                      </span>
                    )}
                  </p>
                  {has ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "var(--text)",
                        lineHeight: 1.55,
                        wordBreak: "break-word",
                      }}
                    >
                      {val}
                    </p>
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "var(--text-dim)",
                        fontStyle: "italic",
                      }}
                    >
                      {missed
                        ? "Required — not answered"
                        : "No answer provided"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Bottom padding for mobile safe area */}
          <div style={{ height: 24 }} />
        </div>
      </div>
    </>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function IconBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 7,
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-muted)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function Badge({ rate }: { rate: number }) {
  const [bg, color] =
    rate === 100
      ? ["var(--success-bg)", "var(--success)"]
      : rate >= 60
        ? [
            "color-mix(in srgb,var(--warning,#d97706) 14%,transparent)",
            "var(--warning,#d97706)",
          ]
        : [
            "color-mix(in srgb,var(--error,#ef4444) 12%,transparent)",
            "var(--error,#ef4444)",
          ];

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 5px",
        borderRadius: 5,
        background: bg,
        color,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {rate}%
    </span>
  );
}

// ─── Empty / error states ─────────────────────────────────────────────────────

function EmptyState({ form }: { form: FormDoc }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const o = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard
      .writeText(`${o}/f/${form.publicId}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "var(--bg-muted)" }}
      >
        <InboxIcon className="w-5 h-5" style={{ color: "var(--text-dim)" }} />
      </div>
      <p
        className="text-[14px] font-semibold mb-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        No responses yet
      </p>
      <p
        className="text-[12px] leading-relaxed max-w-xs mb-5"
        style={{ color: "var(--text-dim)" }}
      >
        {form.status === "published"
          ? "Share the public link to start collecting responses."
          : "Publish this form first, then share it to start collecting responses."}
      </p>
      {form.status === "published" ? (
        <button
          onClick={copy}
          className="flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-xl transition-all"
          style={{
            background: copied ? "var(--success-bg)" : "var(--accent-bg)",
            color: copied ? "var(--success)" : "var(--accent-light)",
            border: `1px solid ${copied ? "var(--success-bg)" : "var(--accent-border)"}`,
          }}
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5" /> Copied!
            </>
          ) : (
            <>
              <LinkIcon className="w-3.5 h-3.5" /> Copy public link
            </>
          )}
        </button>
      ) : (
        <Link
          href={`/forms/${form._id}/builder`}
          className="text-[13px] font-medium px-4 py-2.5 rounded-xl flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <ExternalLinkIcon className="w-3.5 h-3.5" /> Go to builder
        </Link>
      )}
    </div>
  );
}

function SearchEmpty({
  search,
  onClear,
}: {
  search: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
      <SearchIcon
        className="w-6 h-6 mb-3"
        style={{ color: "var(--text-dim)" }}
      />
      <p
        className="text-[13px] font-medium mb-1"
        style={{ color: "var(--text-secondary)" }}
      >
        No matches for "{search}"
      </p>
      <p className="text-[12px] mb-4" style={{ color: "var(--text-dim)" }}>
        Try an email address or any word from an answer.
      </p>
      <button
        onClick={onClear}
        className="text-[12px] font-medium px-3 py-1.5 rounded-lg hover:opacity-70 transition-opacity"
        style={{
          background: "var(--bg-muted)",
          color: "var(--text-muted)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        Clear search
      </button>
    </div>
  );
}

function Fullscreen({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center"
      style={{ background: "var(--bg)" }}
    >
      <AlertCircleIcon
        className="w-8 h-8"
        style={{ color: "var(--text-dim)" }}
      />
      <p
        className="text-[14px] font-semibold"
        style={{ color: "var(--text-secondary)" }}
      >
        {title}
      </p>
      <p
        className="text-[12px] max-w-xs leading-relaxed"
        style={{ color: "var(--text-dim)" }}
      >
        {description}
      </p>
      {action}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/forms"
      className="text-[13px] font-medium px-4 py-2 rounded-xl flex items-center gap-1.5 hover:opacity-80 transition-opacity"
      style={{
        background: "var(--bg-muted)",
        color: "var(--text-muted)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to forms
    </Link>
  );
}
