// app\(main)\admin\content\page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  SearchIcon,
  FileTextIcon,
  LayoutTemplateIcon,
  ClipboardListIcon,
  ExternalLinkIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminContentRow } from "../types";

type Tab = "documents" | "templates" | "forms";

const TAB_LIST: { key: Tab; label: string; icon: typeof FileTextIcon }[] = [
  { key: "documents", label: "Papers", icon: FileTextIcon },
  { key: "templates", label: "Templates", icon: LayoutTemplateIcon },
  { key: "forms", label: "Forms", icon: ClipboardListIcon },
];

function fmtDate(value: number) {
  return format(value, "dd MMM yyyy HH:mm");
}

function getStatusLabel(row: AdminContentRow) {
  if (row.status) return row.status;
  if (row.isArchived) return "archived";
  return "active";
}

function getMetaLabel(tab: Tab, row: AdminContentRow) {
  if (tab === "templates") return (row.fieldsCount ?? 0) + " fields";
  if (tab === "forms") return (row.questionsCount ?? 0) + " questions";
  return row.organizationId ? "Organization" : "Personal";
}

export default function AdminContentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const initialTab: Tab =
    tabFromUrl === "templates" || tabFromUrl === "forms"
      ? tabFromUrl
      : "documents";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [rows, setRows] = useState<AdminContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [search, setSearch] = useState("");

  async function loadPage(t: Tab, c: string | null, append: boolean) {
    const params = new URLSearchParams({ tab: t, limit: "25" });
    if (c) params.set("cursor", c);

    const res = await fetch(`/api/admin/content?${params}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load content");

    return json as {
      rows: AdminContentRow[];
      continueCursor: string;
      isDone: boolean;
    };
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    setCursor(null);
    setIsDone(false);

    loadPage(tab, null, false)
      .then((json) => {
        if (!cancelled) {
          setRows(json.rows);
          setCursor(json.continueCursor);
          setIsDone(json.isDone);
        }
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to load content"
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function loadMore() {
    if (loadingMore || isDone) return;
    setLoadingMore(true);

    try {
      const json = await loadPage(tab, cursor, true);
      setRows((prev) => [...prev, ...json.rows]);
      setCursor(json.continueCursor);
      setIsDone(json.isDone);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    router.replace("/admin/content?tab=" + next, { scroll: false });
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      const title = (row.title ?? row.name ?? "").toLowerCase();
      const owner = row.ownerName.toLowerCase();
      const email = row.ownerEmail.toLowerCase();
      return (
        title.includes(query) || owner.includes(query) || email.includes(query)
      );
    });
  }, [rows, search]);

  const isEmpty = !loading && filteredRows.length === 0;

  return (
    <div className="mx-auto flex w-full flex-col gap-4 px-4 py-5 pb-[calc(1rem+env(safe-area-inset-bottom)+52px)] sm:gap-5 sm:py-6 sm:pb-6 md:px-8">
      <div>
        <h1
          className="text-lg font-semibold tracking-tight sm:text-2xl"
          style={{ color: "var(--text)" }}
        >
          Content
        </h1>
        <p
          className="mt-1 text-[13px] sm:text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Read-only overview of papers, templates, and forms across all users.
        </p>
      </div>

      {/* Toolbar — tabs row */}
      <div
        className="flex w-fit gap-0.5 overflow-x-auto rounded-xl p-0.5"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          scrollbarWidth: "none",
        }}
      >
        {TAB_LIST.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          const btnStyle = {
            background: active ? "var(--accent-bg)" : "transparent",
            color: active ? "var(--accent-light)" : "var(--text-muted)",
          };
          return (
            <button
              key={item.key}
              onClick={() => switchTab(item.key)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={btnStyle}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Toolbar — search row */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--text-dim)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or owner"
            className="h-9 w-full rounded-xl pl-8 pr-8 text-[13px] outline-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text)",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-dim)" }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <span
          className="shrink-0 text-[11px] sm:ml-auto"
          style={{ color: "var(--text-dim)" }}
        >
          {loading
            ? "Loading..."
            : `${filteredRows.length} shown${isDone ? "" : " (loaded " + rows.length + ")"}`}
        </span>
      </div>

      {/* Desktop Table */}
      <div
        className="hidden overflow-hidden rounded-xl md:block"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead style={{ color: "var(--text-muted)" }}>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-3 py-3 font-medium">Owner</th>
                <th className="px-3 py-3 font-medium">Created</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Meta</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <td className="px-4 py-3">
                      <div className="h-3.5 w-48 rounded bg-[var(--bg-muted)] animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-[var(--bg-muted)] animate-pulse" />
                        <div className="h-3 w-24 rounded bg-[var(--bg-muted)] animate-pulse" />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-3.5 w-20 rounded bg-[var(--bg-muted)] animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-5 w-14 rounded bg-[var(--bg-muted)] animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-3.5 w-16 rounded bg-[var(--bg-muted)] animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : isEmpty ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {"No " + tab + " found."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const avatar = row.ownerImageUrl ? (
                    <img
                      src={row.ownerImageUrl}
                      alt=""
                      className="h-6 w-6 rounded-md object-cover"
                    />
                  ) : (
                    <span
                      className="block h-6 w-6 rounded-md"
                      style={{ background: "var(--bg-muted)" }}
                    />
                  );

                  return (
                    <tr
                      key={row._id}
                      className="border-b"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <td
                        className="max-w-[280px] truncate px-4 py-3 font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {row.title ?? row.name}
                      </td>
                      <td className="px-3 py-3">
                        <a
                          href={"/admin/users/" + row.ownerId}
                          className="flex items-center gap-2 hover:underline"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {avatar}
                          <span className="block max-w-[160px] truncate text-sm">
                            {row.ownerName}
                          </span>
                        </a>
                      </td>
                      <td
                        className="px-3 py-3"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {fmtDate(row._creationTime)}
                      </td>
                      <td
                        className="px-3 py-3"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {getStatusLabel(row)}
                      </td>
                      <td
                        className="px-3 py-3"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {getMetaLabel(tab, row)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile View */}
      <div className="flex flex-col gap-2 md:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-3.5 animate-pulse"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="h-3.5 w-48 rounded bg-[var(--bg-muted)]" />
              <div className="mt-2 flex items-center gap-2">
                <div className="h-5 w-5 rounded-md bg-[var(--bg-muted)]" />
                <div className="h-3 w-24 rounded bg-[var(--bg-muted)]" />
                <div className="h-3 w-3 rounded bg-[var(--bg-muted)]" />
                <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="h-3 w-12 rounded bg-[var(--bg-muted)]" />
                <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
              </div>
            </div>
          ))
        ) : isEmpty ? (
          <p
            className="py-10 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {"No " + tab + " found."}
          </p>
        ) : (
          filteredRows.map((row) => {
            const avatar = row.ownerImageUrl ? (
              <img
                src={row.ownerImageUrl}
                alt=""
                className="h-5 w-5 rounded-md object-cover"
              />
            ) : (
              <span
                className="block h-5 w-5 rounded-md"
                style={{ background: "var(--bg-muted)" }}
              />
            );

            return (
              <div
                key={row._id}
                className="rounded-xl p-3.5"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <p
                  className="truncate text-[13px] font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  {row.title ?? row.name}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  {avatar}
                  <span
                    className="truncate text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {row.ownerName}
                  </span>
                  <span style={{ color: "var(--text-dim)" }}>·</span>
                  <span
                    className="shrink-0 text-[11px]"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {fmtDate(row._creationTime)}
                  </span>
                </div>
                <div
                  className="mt-2 flex items-center justify-between text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span>{getStatusLabel(row)}</span>

                  <a
                    href={"/admin/users/" + row.ownerId}
                    className="flex items-center gap-1"
                    style={{ color: "var(--accent-light)" }}
                  >
                    View owner <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Load More */}
      {!loading && !isDone && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full rounded-xl px-6 py-2.5 text-sm font-medium transition-all disabled:opacity-50 sm:w-auto"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
