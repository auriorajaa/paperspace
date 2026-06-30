// app\(main)\admin\activity\page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ActivityIcon,
  ClipboardListIcon,
  FileTextIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminActivityItem } from "../types";

const ICONS = {
  document: FileTextIcon,
  template: LayoutTemplateIcon,
  form: ClipboardListIcon,
  submission: ActivityIcon,
} as const;

function iconFor(type: AdminActivityItem["type"]) {
  return ICONS[type] ?? ActivityIcon;
}

function SkeletonActivityItem() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3 animate-pulse"
      style={{ background: "var(--bg-muted)" }}
    >
      <div className="h-9 w-9 shrink-0 rounded-lg bg-[var(--bg-muted)]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-48 rounded bg-[var(--bg-muted)]" />
        <div className="h-3 w-32 rounded bg-[var(--bg-muted)]" />
      </div>
      <div className="hidden h-3 w-16 rounded bg-[var(--bg-muted)] sm:block" />
    </div>
  );
}

export default function AdminActivityPage() {
  const [activity, setActivity] = useState<AdminActivityItem[] | null>(null);
  const loading = activity === null;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/activity")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load activity");
        if (!cancelled) setActivity(json.activity);
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to load activity"
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full flex-col gap-4 px-4 py-5 pb-[calc(1rem+env(safe-area-inset-bottom)+52px)] sm:gap-5 sm:py-6 sm:pb-6 md:px-8">
      <div>
        <h1
          className="text-lg font-semibold tracking-tight sm:text-2xl"
          style={{ color: "var(--text)" }}
        >
          Activity
        </h1>
        <p
          className="mt-1 text-[13px] sm:text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Recent platform-wide content and submission events.
        </p>
      </div>

      <section
        className="rounded-xl p-2.5 sm:p-3"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="space-y-2">
          {loading && (
            <div className="space-y-2">
              <SkeletonActivityItem />
              <SkeletonActivityItem />
              <SkeletonActivityItem />
              <SkeletonActivityItem />
              <SkeletonActivityItem />
              <SkeletonActivityItem />
            </div>
          )}

          {!loading && activity.length === 0 && (
            <p
              className="py-10 text-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No activity yet.
            </p>
          )}

          {!loading &&
            activity.map((item) => {
              const Icon = iconFor(item.type);
              const key = `${item.type}-${item.id}`;
              return (
                <Link
                  key={key}
                  href={`/admin/users/${item.ownerId}`}
                  className="flex items-center gap-3 rounded-xl p-2.5 transition-colors sm:p-3"
                  style={{ background: "var(--bg-muted)" }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "var(--bg-input)" }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: "var(--accent-light)" }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="truncate text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.type} by {item.ownerName}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[10.5px] sm:text-xs"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {formatDistanceToNow(item.at, { addSuffix: true })}
                  </span>
                </Link>
              );
            })}
        </div>
      </section>
    </div>
  );
}
