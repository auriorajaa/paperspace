// app\(main)\admin\page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ActivityIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderIcon,
  LayoutTemplateIcon,
  UsersIcon,
  ArrowUpRightIcon,
  AlertTriangleIcon,
  CloudIcon,
  LinkIcon,
} from "lucide-react";
import type { AdminStats } from "./types";

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: typeof UsersIcon;
  href?: string;
  tone?: "default" | "accent";
}) {
  const body = (
    <div
      className="group relative flex min-w-0 flex-col gap-2 rounded-xl p-3.5 transition-all duration-150 sm:p-4"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${tone === "accent" ? "var(--accent-border)" : "var(--border-subtle)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className="truncate text-[11px] font-medium sm:text-[11.5px]"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </p>
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg sm:h-7 sm:w-7"
          style={{
            background:
              tone === "accent" ? "var(--accent-bg)" : "var(--bg-input)",
          }}
        >
          <Icon
            className="h-3.5 w-3.5"
            style={{ color: "var(--accent-light)" }}
          />
        </div>
      </div>
      <p
        className="truncate text-xl font-semibold tabular-nums sm:text-2xl"
        style={{ color: "var(--text)" }}
      >
        {value.toLocaleString()}
      </p>
      {href && (
        <ArrowUpRightIcon
          className="absolute right-3 top-3 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60"
          style={{ color: "var(--text-dim)" }}
        />
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block min-w-0">
      {body}
    </Link>
  ) : (
    body
  );
}

function SkeletonCard() {
  return (
    <div
      className="flex min-w-0 flex-col gap-2 rounded-xl p-3.5 animate-pulse sm:p-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-20 rounded bg-[var(--bg-muted)]" />
        <div className="h-6 w-6 rounded-lg bg-[var(--bg-muted)] sm:h-7 sm:w-7" />
      </div>
      <div className="h-6 w-16 rounded bg-[var(--bg-muted)] sm:h-7" />
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = !stats && !error;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/stats")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load stats");
        if (!cancelled) setStats(json);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const inactiveSoon = useMemo(
    () => (stats?.recentUsers ?? []).filter((u) => u.inactiveDays >= 90).length,
    [stats]
  );

  if (error) {
    return (
      <div className="w-full overflow-x-hidden px-4 py-6 sm:py-10 md:px-8">
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <AlertTriangleIcon className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 overflow-x-hidden px-4 py-5 sm:gap-6 sm:py-6 md:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1
            className="text-lg font-semibold tracking-tight sm:text-2xl"
            style={{ color: "var(--text)" }}
          >
            System dashboard
          </h1>
          <p
            className="mt-1 text-[13px] sm:text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            A live snapshot of users, content, and cleanup health across
            Paperspace.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium sm:w-fit"
          style={{
            background: "var(--accent-strong-bg)",
            color: "var(--accent-pale)",
          }}
        >
          Manage users
        </Link>
      </div>

      {inactiveSoon > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(245,158,11,0.1)",
            color: "#f59e0b",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <AlertTriangleIcon className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="min-w-0">
            {inactiveSoon} recently-created user{inactiveSoon !== 1 ? "s" : ""}{" "}
            are already past 90 days of inactivity.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Users"
              value={stats?.usersCount ?? 0}
              icon={UsersIcon}
              href="/admin/users"
              tone="accent"
            />
            <StatCard
              label="Papers"
              value={stats?.documentsCount ?? 0}
              icon={FileTextIcon}
              href="/admin/content?tab=documents"
            />
            <StatCard
              label="Collections"
              value={stats?.collectionsCount ?? 0}
              icon={FolderIcon}
            />
            <StatCard
              label="Templates"
              value={stats?.templatesCount ?? 0}
              icon={LayoutTemplateIcon}
              href="/admin/content?tab=templates"
            />
            <StatCard
              label="Forms"
              value={stats?.formsCount ?? 0}
              icon={ClipboardListIcon}
              href="/admin/content?tab=forms"
            />
            {/* <StatCard
              label="Submissions"
              value={stats?.submissionsCount ?? 0}
              icon={ActivityIcon}
              href="/admin/activity"
            /> */}
          </>
        )}
      </div>

      {loading ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_360px]">
          <div
            className="min-w-0 rounded-xl p-4 animate-pulse"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="h-5 w-48 rounded bg-[var(--bg-muted)]" />
            <div className="mt-1 h-4 w-64 rounded bg-[var(--bg-muted)]" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
          <div
            className="min-w-0 rounded-xl p-4 animate-pulse"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="h-5 w-28 rounded bg-[var(--bg-muted)]" />
            <div className="mt-1 h-4 w-32 rounded bg-[var(--bg-muted)]" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl p-2"
                  style={{ background: "var(--bg-muted)" }}
                >
                  <div className="h-9 w-9 rounded-lg bg-[var(--bg-muted)]" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3.5 w-32 rounded bg-[var(--bg-muted)]" />
                    <div className="h-3 w-24 rounded bg-[var(--bg-muted)]" />
                  </div>
                  <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_360px]">
          <section
            className="min-w-0 rounded-xl p-3.5 sm:p-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <h2
                  className="text-[15px] font-semibold sm:text-base"
                  style={{ color: "var(--text)" }}
                >
                  Storage-driving tables
                </h2>
                <p
                  className="text-[13px] sm:text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Counts that grow fastest and matter most for cleanup and cost.
                </p>
              </div>
              <Link
                href="/admin/content"
                className="shrink-0 text-sm font-medium"
                style={{ color: "var(--accent-light)" }}
              >
                Browse content
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              <StatCard
                label="Generated docs"
                value={stats?.generatedDocumentsCount ?? 0}
                icon={FileTextIcon}
              />
              <StatCard
                label="Form connections"
                value={stats?.formConnectionsCount ?? 0}
                icon={LinkIcon}
              />
              <StatCard
                label="Google accounts"
                value={stats?.googleAccountsCount ?? 0}
                icon={CloudIcon}
              />
              <StatCard
                label="Users with data"
                value={stats?.totalUsersWithData ?? 0}
                icon={UsersIcon}
                href="/admin/users"
              />
            </div>
          </section>

          <section
            className="min-w-0 rounded-xl p-3.5 sm:p-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <h2
                  className="text-[15px] font-semibold sm:text-base"
                  style={{ color: "var(--text)" }}
                >
                  Recent signups
                </h2>
                <p
                  className="truncate text-[13px] sm:text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {stats?.recentUsers?.length
                    ? `${stats.recentUsers.length} latest users`
                    : "No recent signups yet"}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {(stats?.recentUsers ?? []).map((user) => (
                <Link
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  className="flex min-w-0 items-center gap-3 rounded-xl p-2 transition-colors"
                  style={{ background: "var(--bg-muted)" }}
                >
                  <img
                    src={user.imageUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {user.name}
                    </p>
                    <p
                      className="truncate text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {user.email}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[11px]"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {formatDistanceToNow(user.createdAt, { addSuffix: true })}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
