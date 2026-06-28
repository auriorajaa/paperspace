/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { format, formatDistanceToNow, isValid } from "date-fns";
import {
  ArrowLeftIcon,
  DownloadIcon,
  SearchIcon,
  InboxIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LayoutListIcon,
  TableIcon,
  AlertCircleIcon,
  XIcon,
  CheckIcon,
  MinusIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  userAgent?: string;
  ipHash?: string;
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
type ViewMode = "list" | "table";

interface Stats {
  total: number;
  withEmail: number;
  avgCompletion: number;
  latest: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeDate(ts: number): Date | null {
  try {
    const d = new Date(ts);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

function formatTs(ts: number, fmt: string): string {
  const d = safeDate(ts);
  return d ? format(d, fmt) : "Unknown date";
}

function formatRelative(ts: number): string {
  const d = safeDate(ts);
  if (!d) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

function getAnswer(response: FormResponse, questionId: string): string {
  return response.answers.find((a) => a.questionId === questionId)?.value ?? "";
}

function completionRate(
  response: FormResponse,
  schema: FormQuestion[]
): number {
  if (!schema.length) return 100;
  const answered = schema.filter((q) => {
    const v = getAnswer(response, q.id).trim();
    return v !== "";
  }).length;
  return Math.round((answered / schema.length) * 100);
}

function exportCsv(form: FormDoc, responses: FormResponse[]): void {
  try {
    const headers = form.schema.map((q) => `"${q.title.replace(/"/g, '""')}"`);
    const csvRows = [
      ["#", "Submitted at", "Respondent email", ...headers].join(","),
      ...responses.map((r, i) => {
        const cols = [
          String(i + 1),
          `"${formatTs(r.submittedAt, "yyyy-MM-dd HH:mm:ss")}"`,
          `"${(r.respondentEmail ?? "").replace(/"/g, '""')}"`,
          ...form.schema.map((q) => {
            const v = getAnswer(r, q.id);
            return `"${v.replace(/"/g, '""')}"`;
          }),
        ];
        return cols.join(",");
      }),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvRows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.title.replace(/[^a-z0-9]/gi, "_")}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("[exportCsv] failed:", err);
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

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

  // ── UI state ──
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  // list view: which response is expanded, and detail drawer response
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailIdx, setDetailIdx] = useState<number | null>(null);

  // ── Derived data ──
  const isLoading = !isLoaded || form === undefined || responses === undefined;
  const isAuthError = isLoaded && !isSignedIn;

  const sorted = useMemo<FormResponse[]>(() => {
    if (!responses) return [];
    const copy = [...responses];
    if (sortKey === "newest")
      copy.sort((a, b) => b.submittedAt - a.submittedAt);
    else if (sortKey === "oldest")
      copy.sort((a, b) => a.submittedAt - b.submittedAt);
    else if (sortKey === "email")
      copy.sort((a, b) =>
        (a.respondentEmail ?? "").localeCompare(b.respondentEmail ?? "")
      );
    return copy;
  }, [responses, sortKey]);

  const filtered = useMemo<FormResponse[]>(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (r) =>
        r.respondentEmail?.toLowerCase().includes(q) ||
        r.answers.some((a) => a.value?.toLowerCase().includes(q))
    );
  }, [sorted, search]);

  // ── Stats ──
  const stats = useMemo<Stats | null>(() => {
    if (!responses || !form) return null;
    const total = responses.length;
    const withEmail = responses.filter((r) => r.respondentEmail).length;
    const completionRates = responses.map((r) =>
      completionRate(r, form.schema)
    );
    const avgCompletion =
      completionRates.length > 0
        ? Math.round(
            completionRates.reduce((a, b) => a + b, 0) / completionRates.length
          )
        : 0;
    const latest =
      responses.length > 0
        ? Math.max(...responses.map((r) => r.submittedAt))
        : null;
    return { total, withEmail, avgCompletion, latest };
  }, [responses, form]);

  // ── Detail navigation ──
  const openDetail = useCallback((idx: number) => setDetailIdx(idx), []);
  const closeDetail = useCallback(() => setDetailIdx(null), []);
  const prevDetail = useCallback(
    () => setDetailIdx((i) => (i !== null && i > 0 ? i - 1 : i)),
    []
  );
  const nextDetail = useCallback(
    () =>
      setDetailIdx((i) => (i !== null && i < filtered.length - 1 ? i + 1 : i)),
    [filtered.length]
  );

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent-light)" }}
          />
        </div>
      </div>
    );
  }

  // ── Auth error ──
  if (isAuthError) {
    return (
      <ErrorScreen
        title="Not signed in"
        description="Sign in to view form responses."
      />
    );
  }

  // ── 404 ──
  if (form === null) {
    return (
      <ErrorScreen
        title="Form not found"
        description="This form may have been deleted or you don't have access."
        action={<BackToFormsLink />}
      />
    );
  }

  const detailResponse =
    detailIdx !== null ? (filtered[detailIdx] ?? null) : null;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* ── Page header ── */}
      <PageHeader
        form={form}
        formId={formId}
        responses={responses ?? []}
        filtered={filtered}
        stats={stats}
        search={search}
        onSearch={setSearch}
        sortKey={sortKey}
        onSort={setSortKey}
        viewMode={viewMode}
        onViewMode={setViewMode}
      />

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto relative">
        {!responses || responses.length === 0 ? (
          <EmptyState form={form} />
        ) : filtered.length === 0 ? (
          <SearchEmpty search={search} onClear={() => setSearch("")} />
        ) : viewMode === "list" ? (
          <ListView
            filtered={filtered}
            responses={responses ?? []}
            form={form}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
            onOpenDetail={openDetail}
          />
        ) : (
          <TableView
            filtered={filtered}
            form={form}
            onOpenDetail={openDetail}
          />
        )}
      </div>

      {/* ── Detail drawer (both views) ── */}
      {detailResponse !== null && detailIdx !== null && (
        <DetailDrawer
          response={detailResponse}
          form={form}
          index={detailIdx}
          total={filtered.length}
          onClose={closeDetail}
          onPrev={prevDetail}
          onNext={nextDetail}
          canPrev={detailIdx > 0}
          canNext={detailIdx < filtered.length - 1}
        />
      )}
    </div>
  );
}

// ─── Page header ─────────────────────────────────────────────────────────────

function PageHeader({
  form,
  formId,
  responses,
  filtered,
  stats,
  search,
  onSearch,
  sortKey,
  onSort,
  viewMode,
  onViewMode,
}: {
  form: FormDoc;
  formId: string;
  responses: FormResponse[];
  filtered: FormResponse[];
  stats: Stats | null;
  search: string;
  onSearch: (v: string) => void;
  sortKey: SortKey;
  onSort: (v: SortKey) => void;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
}) {
  return (
    <div
      className="shrink-0"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      {/* Top bar */}
      <div className="px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          <Link
            href="/forms"
            className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Forms
          </Link>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>/</span>
          <Link
            href={`/forms/${formId}/builder`}
            className="text-[11px] transition-opacity hover:opacity-70 max-w-[140px] truncate"
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

        {/* Title + export */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-[15px] sm:text-base font-semibold leading-tight"
              style={{ color: "var(--text)" }}
            >
              {responses.length === 0
                ? "No responses yet"
                : `${responses.length} response${responses.length !== 1 ? "s" : ""}`}
            </h1>
            {stats && responses.length > 0 && (
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-dim)" }}
              >
                {stats.avgCompletion}% avg. completion
                {stats.latest && <> · Last {formatRelative(stats.latest)}</>}
              </p>
            )}
          </div>
          {responses.length > 0 && (
            <button
              onClick={() => exportCsv(form, responses)}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl min-h-[36px] shrink-0 transition-opacity hover:opacity-80"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
              title="Export all responses as CSV"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: search + sort + view toggle */}
      {responses.length > 0 && (
        <div className="px-4 sm:px-6 pb-3 flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div
            className="flex items-center gap-2 flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg"
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
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search email or answers…"
              className="flex-1 bg-transparent outline-none text-[13px] min-w-0"
              style={{ color: "var(--text)" }}
            />
            {search && (
              <button
                onClick={() => onSearch("")}
                className="shrink-0 transition-opacity hover:opacity-70"
                style={{ color: "var(--text-dim)" }}
                aria-label="Clear search"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="text-[12px] px-2.5 py-1.5 rounded-lg outline-none appearance-none pr-6 cursor-pointer"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
            aria-label="Sort responses"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="email">By email</option>
          </select>

          {/* View toggle */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            {(["list", "table"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewMode(mode)}
                className="flex items-center justify-center w-8 h-8 transition-all"
                style={{
                  background:
                    viewMode === mode ? "var(--bg-card)" : "var(--bg-muted)",
                  color: viewMode === mode ? "var(--text)" : "var(--text-dim)",
                  borderRight:
                    mode === "list" ? "1px solid var(--border-subtle)" : "none",
                }}
                aria-label={mode === "list" ? "List view" : "Table view"}
                title={mode === "list" ? "List view" : "Table view"}
              >
                {mode === "list" ? (
                  <LayoutListIcon className="w-3.5 h-3.5" />
                ) : (
                  <TableIcon className="w-3.5 h-3.5" />
                )}
              </button>
            ))}
          </div>

          {/* Search match count */}
          {search && (
            <span
              className="text-[11px] shrink-0"
              style={{ color: "var(--text-dim)" }}
            >
              {filtered.length} of {responses.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  filtered,
  responses,
  form,
  expandedId,
  onToggle,
  onOpenDetail,
}: {
  filtered: FormResponse[];
  responses: FormResponse[];
  form: FormDoc;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onOpenDetail: (idx: number) => void;
}) {
  return (
    <div className="px-4 sm:px-6 py-4 max-w-3xl space-y-2">
      {filtered.map((r, idx) => {
        const globalIdx = responses.indexOf(r);
        const rate = completionRate(r, form.schema);
        const isExpanded = expandedId === r._id;

        return (
          <div
            key={r._id}
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--bg-card)",
              border: `1px solid ${isExpanded ? "var(--accent-border)" : "var(--border-subtle)"}`,
            }}
          >
            {/* Row header */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: isExpanded ? "var(--accent-bg)" : "transparent",
              }}
            >
              {/* Expand toggle */}
              <button
                onClick={() => onToggle(r._id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                aria-expanded={isExpanded}
              >
                {/* Response number */}
                <span
                  className="text-[11px] font-semibold w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: isExpanded
                      ? "var(--accent-strong-bg)"
                      : "var(--bg-muted)",
                    color: isExpanded
                      ? "var(--accent-pale)"
                      : "var(--text-dim)",
                  }}
                >
                  {globalIdx + 1}
                </span>

                {/* Primary info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[13px] font-medium truncate"
                      style={{
                        color: r.respondentEmail
                          ? "var(--text)"
                          : "var(--text-dim)",
                        fontStyle: r.respondentEmail ? "normal" : "italic",
                      }}
                    >
                      {r.respondentEmail ?? "Anonymous"}
                    </span>
                    <CompletionBadge rate={rate} />
                  </div>
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {formatTs(r.submittedAt, "MMM d, yyyy · h:mm a")}
                  </span>
                </div>

                {/* Chevron */}
                <div className="shrink-0" style={{ color: "var(--text-dim)" }}>
                  {isExpanded ? (
                    <ChevronUpIcon className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {/* View detail button */}
              <button
                onClick={() => onOpenDetail(idx)}
                className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
                style={{
                  background: "var(--bg-muted)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                }}
                title="Open detail view"
              >
                View
              </button>
            </div>

            {/* Expanded inline answers */}
            {isExpanded && (
              <div
                className="divide-y"
                style={{
                  borderTop: "1px solid var(--accent-border)",
                  // @ts-ignore
                  "--tw-divide-color": "var(--border-subtle)",
                }}
              >
                {form.schema.map((q) => {
                  const val = getAnswer(r, q.id);
                  return <AnswerRow key={q.id} question={q} value={val} />;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

function TableView({
  filtered,
  form,
  onOpenDetail,
}: {
  filtered: FormResponse[];
  form: FormDoc;
  onOpenDetail: (idx: number) => void;
}) {
  // Limit visible columns to avoid unreadable overflow; user can open detail for the rest
  const MAX_COLS = 5;
  const visibleQuestions = form.schema.slice(0, MAX_COLS);
  const hiddenCount = Math.max(0, form.schema.length - MAX_COLS);

  return (
    <div className="px-4 sm:px-6 py-4">
      {hiddenCount > 0 && (
        <p
          className="text-[11px] mb-3 px-1"
          style={{ color: "var(--text-dim)" }}
        >
          Showing {MAX_COLS} of {form.schema.length} fields.{" "}
          <span style={{ color: "var(--text-muted)" }}>
            Click "View" to see all answers.
          </span>
        </p>
      )}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border-subtle)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <th
                  className="text-left px-3 py-2.5 font-medium whitespace-nowrap"
                  style={{
                    color: "var(--text-dim)",
                    background: "var(--bg-muted)",
                    width: 32,
                  }}
                >
                  #
                </th>
                <th
                  className="text-left px-3 py-2.5 font-medium whitespace-nowrap"
                  style={{
                    color: "var(--text-dim)",
                    background: "var(--bg-muted)",
                    minWidth: 160,
                  }}
                >
                  Email
                </th>
                <th
                  className="text-left px-3 py-2.5 font-medium whitespace-nowrap"
                  style={{
                    color: "var(--text-dim)",
                    background: "var(--bg-muted)",
                    minWidth: 130,
                  }}
                >
                  Submitted
                </th>
                {visibleQuestions.map((q) => (
                  <th
                    key={q.id}
                    className="text-left px-3 py-2.5 font-medium"
                    style={{
                      color: "var(--text-dim)",
                      background: "var(--bg-muted)",
                      minWidth: 140,
                      maxWidth: 220,
                    }}
                    title={q.title}
                  >
                    <span className="block truncate max-w-[200px]">
                      {q.title}
                    </span>
                  </th>
                ))}
                <th
                  className="text-left px-3 py-2.5 font-medium"
                  style={{
                    color: "var(--text-dim)",
                    background: "var(--bg-muted)",
                    width: 60,
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr
                  key={r._id}
                  style={{
                    borderBottom:
                      idx < filtered.length - 1
                        ? "1px solid var(--border-subtle)"
                        : "none",
                  }}
                >
                  <td
                    className="px-3 py-2.5 tabular-nums"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2.5 max-w-[180px]">
                    {r.respondentEmail ? (
                      <span
                        className="truncate block"
                        style={{ color: "var(--text)" }}
                      >
                        {r.respondentEmail}
                      </span>
                    ) : (
                      <span
                        className="italic"
                        style={{ color: "var(--text-dim)" }}
                      >
                        Anonymous
                      </span>
                    )}
                  </td>
                  <td
                    className="px-3 py-2.5 tabular-nums whitespace-nowrap"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatTs(r.submittedAt, "MMM d, yyyy")}
                    <br />
                    <span style={{ color: "var(--text-dim)" }}>
                      {formatTs(r.submittedAt, "h:mm a")}
                    </span>
                  </td>
                  {visibleQuestions.map((q) => {
                    const val = getAnswer(r, q.id);
                    return (
                      <td
                        key={q.id}
                        className="px-3 py-2.5 max-w-[220px]"
                        title={val || undefined}
                      >
                        {val ? (
                          <span
                            className="block truncate"
                            style={{ color: "var(--text)" }}
                          >
                            {val}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-dim)" }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => onOpenDetail(idx)}
                      className="text-[11px] font-medium px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
                      style={{
                        color: "var(--accent-light)",
                        background: "var(--accent-bg)",
                        border: "1px solid var(--accent-border)",
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
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

  return (
    <>
      {/* Backdrop — z-[60] clears sidebar (z-40) and mobile header (z-50) */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — z-[70] sits above backdrop */}
      <div
        className="fixed inset-y-0 right-0 z-[70] flex flex-col w-full max-w-lg"
        style={{
          background: "var(--bg)",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <p
                className="text-[13px] font-semibold truncate"
                style={{ color: "var(--text)" }}
              >
                {response.respondentEmail ?? "Anonymous respondent"}
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                {formatTs(response.submittedAt, "MMM d, yyyy · h:mm a")} ·{" "}
                <CompletionBadge rate={rate} inline />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Prev / next */}
            <button
              onClick={onPrev}
              disabled={!canPrev}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity"
              style={{
                background: "var(--bg-muted)",
                color: canPrev ? "var(--text-muted)" : "var(--text-dim)",
                border: "1px solid var(--border-subtle)",
                opacity: canPrev ? 1 : 0.4,
              }}
              aria-label="Previous response"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
            <span
              className="text-[11px] tabular-nums px-1"
              style={{ color: "var(--text-dim)" }}
            >
              {index + 1} / {total}
            </span>
            <button
              onClick={onNext}
              disabled={!canNext}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity"
              style={{
                background: "var(--bg-muted)",
                color: canNext ? "var(--text-muted)" : "var(--text-dim)",
                border: "1px solid var(--border-subtle)",
                opacity: canNext ? 1 : 0.4,
              }}
              aria-label="Next response"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg ml-1 transition-opacity hover:opacity-70"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
              aria-label="Close"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Answers */}
        <div
          className="flex-1 overflow-y-auto divide-y"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {form.schema.map((q, qi) => {
            const val = getAnswer(response, q.id);
            return (
              <AnswerRow key={q.id} question={q} value={val} index={qi + 1} />
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Answer row ───────────────────────────────────────────────────────────────

function AnswerRow({
  question,
  value,
  index,
}: {
  question: FormQuestion;
  value: string;
  index?: number;
}) {
  const hasAnswer = value.trim() !== "";
  const isMissed = !hasAnswer && question.required;

  return (
    <div
      className="px-4 py-3 flex items-start gap-3"
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: isMissed ? "var(--warning-bg, #fef9ec)" : "transparent",
      }}
    >
      {/* Status icon */}
      <div className="shrink-0 mt-0.5">
        {isMissed ? (
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "var(--warning-bg, #fef3c7)" }}
            title="Required — not answered"
          >
            <MinusIcon
              className="w-2.5 h-2.5"
              style={{ color: "var(--warning, #d97706)" }}
            />
          </div>
        ) : hasAnswer ? (
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "var(--success-bg)" }}
            title="Answered"
          >
            <CheckIcon
              className="w-2.5 h-2.5"
              style={{ color: "var(--success)" }}
            />
          </div>
        ) : (
          <div
            className="w-4 h-4 rounded-full"
            style={{ background: "var(--bg-muted)" }}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Question label */}
        <p
          className="text-[11px] font-medium leading-snug mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          {index !== undefined && (
            <span
              className="inline-block mr-1.5 tabular-nums"
              style={{ color: "var(--text-dim)" }}
            >
              {index}.
            </span>
          )}
          {question.title}
          {question.required && (
            <span
              className="ml-0.5"
              style={{ color: "var(--warning, #d97706)" }}
            >
              *
            </span>
          )}
        </p>

        {/* Answer value */}
        {hasAnswer ? (
          <p
            className="text-[13px] leading-relaxed break-words"
            style={{ color: "var(--text)" }}
          >
            {value}
          </p>
        ) : (
          <p
            className="text-[12px] italic"
            style={{ color: "var(--text-dim)" }}
          >
            {isMissed ? "Required — not answered" : "No answer provided"}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Completion badge ─────────────────────────────────────────────────────────

function CompletionBadge({ rate, inline }: { rate: number; inline?: boolean }) {
  const color =
    rate === 100
      ? { bg: "var(--success-bg)", text: "var(--success)" }
      : rate >= 60
        ? { bg: "var(--warning-bg, #fef3c7)", text: "var(--warning, #d97706)" }
        : { bg: "var(--error-bg, #fee2e2)", text: "var(--error, #ef4444)" };

  if (inline) {
    return (
      <span style={{ color: color.text }} className="text-[11px] font-medium">
        {rate}% complete
      </span>
    );
  }

  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0"
      style={{ background: color.bg, color: color.text }}
    >
      {rate}%
    </span>
  );
}

// ─── Empty / error states ─────────────────────────────────────────────────────

function EmptyState({ form }: { form: FormDoc }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard
      .writeText(`${origin}/f/${form.publicId}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
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
          ? "Share the public link below to start collecting responses."
          : "Publish this form first, then share the link to start collecting responses."}
      </p>

      {form.status === "published" ? (
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-xl min-h-[40px] transition-all"
          style={{
            background: copied ? "var(--success-bg)" : "var(--accent-bg)",
            color: copied ? "var(--success)" : "var(--accent-light)",
            border: `1px solid ${copied ? "var(--success-border, var(--success-bg))" : "var(--accent-border)"}`,
          }}
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5" /> Copied!
            </>
          ) : (
            <>
              <DownloadIcon
                className="w-3.5 h-3.5"
                style={{ transform: "rotate(180deg)" }}
              />{" "}
              Copy public link
            </>
          )}
        </button>
      ) : (
        <Link
          href={`/forms/${form._id}/builder`}
          className="text-[13px] font-medium px-4 py-2.5 rounded-xl min-h-[40px] flex items-center transition-opacity hover:opacity-80"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          Go to builder
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
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
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
        Try a different email address or answer text.
      </p>
      <button
        onClick={onClear}
        className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
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

function ErrorScreen({
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

function BackToFormsLink() {
  return (
    <Link
      href="/forms"
      className="text-[13px] font-medium px-4 py-2 rounded-xl flex items-center gap-1.5 transition-opacity hover:opacity-80"
      style={{
        background: "var(--bg-muted)",
        color: "var(--text-muted)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <ArrowLeftIcon className="w-3.5 h-3.5" />
      Back to forms
    </Link>
  );
}
