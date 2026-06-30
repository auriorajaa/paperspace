// app\(main)\admin\users\page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CheckIcon,
  MinusIcon,
  SearchIcon,
  ShieldIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { ADMIN_EMAIL } from "@/lib/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdminUser } from "../types";

type UsersResponse = { users: AdminUser[]; totalCount: number };
type DeleteTarget =
  | { id: string; label: string }
  | { id: "bulk"; label: string }
  | null;

function fmt(value: number | null | undefined) {
  if (!value) return "Never";
  return format(value, "dd MMM yyyy");
}

function RoleBadge({ role }: { role: string | null }) {
  if (role !== "admin") return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
      style={{
        background: "var(--accent-bg)",
        color: "var(--accent-light)",
        border: "1px solid var(--accent-border)",
      }}
    >
      <ShieldIcon className="h-2.5 w-2.5" /> Admin
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modern checkbox — matches the templates page's SelectCheckbox
// ─────────────────────────────────────────────────────────────────────────────

function SelectCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      aria-checked={checked}
      role="checkbox"
      className="flex shrink-0 items-center justify-center rounded-md transition-all disabled:opacity-40"
      style={{
        width: 16,
        height: 16,
        background:
          checked || indeterminate
            ? "var(--accent-strong-bg)"
            : "var(--bg-input)",
        border: `1.5px solid ${
          checked || indeterminate
            ? "var(--accent-border)"
            : "var(--border-hover)"
        }`,
      }}
    >
      {indeterminate ? (
        <MinusIcon
          style={{ width: 9, height: 9, color: "var(--accent-pale)" }}
        />
      ) : checked ? (
        <CheckIcon
          style={{ width: 9, height: 9, color: "var(--accent-pale)" }}
        />
      ) : null}
    </button>
  );
}

const PAGE_SIZE = 25;

function SkeletonRow() {
  return (
    <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
      <td className="px-4 py-3">
        <div className="h-4 w-4 rounded bg-[var(--bg-muted)] animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--bg-muted)] animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-[var(--bg-muted)] animate-pulse" />
            <div className="h-3 w-24 rounded bg-[var(--bg-muted)] animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="h-3.5 w-20 rounded bg-[var(--bg-muted)] animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="h-5 w-14 rounded bg-[var(--bg-muted)] animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3.5 w-8 rounded bg-[var(--bg-muted)] animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3.5 w-8 rounded bg-[var(--bg-muted)] animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3.5 w-8 rounded bg-[var(--bg-muted)] animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3.5 w-20 rounded bg-[var(--bg-muted)] animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="ml-auto h-8 w-16 rounded bg-[var(--bg-muted)] animate-pulse" />
      </td>
    </tr>
  );
}

function SkeletonMobileCard() {
  return (
    <div
      className="rounded-xl p-3.5 animate-pulse"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-[var(--bg-muted)]" />
        <div className="flex flex-1 items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-[var(--bg-muted)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-[var(--bg-muted)]" />
            <div className="h-3 w-24 rounded bg-[var(--bg-muted)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const { user: currentUser } = useUser();
  const isSuperAdmin = currentUser?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const loadUsers = useCallback(
    async (search = query, pageNum = page) => {
      setLoading(true);
      const offset = pageNum * PAGE_SIZE;
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (search.trim()) params.set("query", search.trim());
        const res = await fetch(`/api/admin/users/list?${params}`);
        const json = (await res.json()) as UsersResponse & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load users");
        setUsers(json.users);
        setTotalCount(json.totalCount);
        setSelected(new Set());
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load users"
        );
      } finally {
        setLoading(false);
      }
    },
    [query, page]
  );

  useEffect(() => {
    loadUsers("", 0);
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => b.inactiveDays - a.inactiveDays),
    [users]
  );
  const selectedUsers = sortedUsers.filter((user) => selected.has(user.id));
  const allSelected =
    !loading && selected.size > 0 && selected.size === sortedUsers.length;
  const someSelected = selected.size > 0 && selected.size < sortedUsers.length;

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(sortedUsers.map((u) => u.id))
    );
  };

  const deleteOne = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to delete user");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const ids =
        deleteTarget.id === "bulk"
          ? selectedUsers.map((user) => user.id)
          : [deleteTarget.id];
      const results = await Promise.allSettled(ids.map(deleteOne));
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(
          ids.length === 1 ? "User deleted" : `${ids.length} users deleted`
        );
      } else if (succeeded > 0) {
        toast.success(`${succeeded} user${succeeded === 1 ? "" : "s"} deleted, ${failed} failed`);
      } else {
        toast.error("Failed to delete users");
      }
      setDeleteTarget(null);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col gap-4 px-4 py-5 pb-[calc(1rem+env(safe-area-inset-bottom)+52px)] sm:gap-5 sm:py-6 sm:pb-6 md:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-lg font-semibold tracking-tight sm:text-2xl"
            style={{ color: "var(--text)" }}
          >
            Users
          </h1>
          <p
            className="mt-1 text-[13px] sm:text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sorted by inactivity. Accounts hit the cleanup threshold at 120
            days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={() =>
                setDeleteTarget({
                  id: "bulk",
                  label: `${selected.size} selected users`,
                })
              }
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium sm:flex-none"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
            >
              <Trash2Icon className="h-4 w-4" />
              Delete selected
            </button>
          )}
          <button
            onClick={() => loadUsers()}
            className="h-9 shrink-0 rounded-lg px-3 text-sm font-medium"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          loadUsers(query);
        }}
      >
        <div className="relative flex-1">
          <SearchIcon
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--text-dim)" }}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            className="h-10 w-full rounded-xl pl-9 pr-8 text-[13px] outline-none sm:text-sm"
            style={{
              background: "var(--bg-input)",
              color: "var(--text)",
              border: "1px solid var(--border-subtle)",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                loadUsers("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-dim)" }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          className="h-10 shrink-0 rounded-xl px-4 text-sm font-medium"
          style={{
            background: "var(--accent-strong-bg)",
            color: "var(--accent-pale)",
          }}
        >
          Search
        </button>
      </form>

      <div
        className="flex items-center gap-2 px-1 text-[13px] sm:text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        <UsersIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        {users.length.toLocaleString()} shown of {totalCount.toLocaleString()}
      </div>

      {/* Desktop table */}
      <div
        className="hidden overflow-hidden rounded-xl md:block"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead style={{ color: "var(--text-muted)" }}>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <th className="w-10 px-4 py-3">
                  <SelectCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={loading}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Last sign in</th>
                <th className="px-3 py-3 font-medium">Inactive</th>
                <th className="px-3 py-3 font-medium">Papers</th>
                <th className="px-3 py-3 font-medium">Templates</th>
                <th className="px-3 py-3 font-medium">Forms</th>
                <th className="px-3 py-3 font-medium">Created</th>
                <th className="px-3 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : sortedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => {
                  const isSelected = selected.has(user.id);
                  return (
                    <tr
                      key={user.id}
                      className="border-b transition-colors"
                      style={{
                        borderColor: "var(--border-subtle)",
                        background: isSelected
                          ? "var(--accent-bg)"
                          : "transparent",
                      }}
                    >
                      <td className="px-4 py-3">
                        <SelectCheckbox
                          checked={isSelected}
                          onChange={() => toggleSelected(user.id)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="flex items-center gap-3"
                        >
                          <img
                            src={user.imageUrl}
                            alt=""
                            className="h-9 w-9 rounded-lg object-cover"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="block truncate font-medium"
                                style={{ color: "var(--text)" }}
                              >
                                {user.name}
                              </span>
                              <RoleBadge role={user.role} />
                            </span>
                            <span
                              className="block truncate text-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {user.email}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td
                        className="px-3 py-3"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {fmt(user.lastSignInAt)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="rounded-md px-2 py-1 text-xs font-medium"
                          style={{
                            background:
                              user.inactiveDays >= 120
                                ? "rgba(239,68,68,0.12)"
                                : "var(--bg-muted)",
                            color:
                              user.inactiveDays >= 120
                                ? "#ef4444"
                                : "var(--text-secondary)",
                          }}
                        >
                          {user.inactiveDays} days
                        </span>
                      </td>
                      <td
                        className="px-3 py-3"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {user.counts.documents}
                      </td>
                      <td
                        className="px-3 py-3"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {user.counts.templates}
                      </td>
                      <td
                        className="px-3 py-3"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {user.counts.forms}
                      </td>
                      <td
                        className="px-3 py-3"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {fmt(user.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(isSuperAdmin || user.role !== "admin") && (
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                id: user.id,
                                label: user.email || user.name,
                              })
                            }
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium"
                            style={{
                              background: "rgba(239,68,68,0.12)",
                              color: "#ef4444",
                            }}
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <SkeletonMobileCard key={i} />
          ))
        ) : sortedUsers.length === 0 ? (
          <p
            className="py-10 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No users found.
          </p>
        ) : (
          sortedUsers.map((user) => {
            const isSelected = selected.has(user.id);
            return (
              <div
                key={user.id}
                className="rounded-xl p-3.5 transition-colors"
                style={{
                  background: isSelected
                    ? "var(--accent-bg)"
                    : "var(--bg-card)",
                  border: `1px solid ${
                    isSelected ? "var(--accent-border)" : "var(--border-subtle)"
                  }`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <SelectCheckbox
                    checked={isSelected}
                    onChange={() => toggleSelected(user.id)}
                  />
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                  >
                    <img
                      src={user.imageUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="block truncate text-[13px] font-medium"
                          style={{ color: "var(--text)" }}
                        >
                          {user.name}
                        </span>
                        <RoleBadge role={user.role} />
                      </span>
                      <span
                        className="block truncate text-[11px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {user.email}
                      </span>
                    </div>
                  </Link>
                </div>
                <div
                  className="mt-2.5 grid grid-cols-4 gap-2 text-center text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <div>
                    <p
                      className="font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {user.counts.documents}
                    </p>
                    <p style={{ color: "var(--text-dim)" }}>Papers</p>
                  </div>
                  <div>
                    <p
                      className="font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {user.counts.templates}
                    </p>
                    <p style={{ color: "var(--text-dim)" }}>Templates</p>
                  </div>
                  <div>
                    <p
                      className="font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {user.counts.forms}
                    </p>
                    <p style={{ color: "var(--text-dim)" }}>Forms</p>
                  </div>
                  <div>
                    <p
                      className="font-semibold"
                      style={{
                        color:
                          user.inactiveDays >= 120 ? "#ef4444" : "var(--text)",
                      }}
                    >
                      {user.inactiveDays}
                    </p>
                    <p style={{ color: "var(--text-dim)" }}>Inactive d.</p>
                  </div>
                </div>
                {(isSuperAdmin || user.role !== "admin") && (
                  <button
                    onClick={() =>
                      setDeleteTarget({
                        id: user.id,
                        label: user.email || user.name,
                      })
                    }
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-medium"
                    style={{
                      background: "rgba(239,68,68,0.12)",
                      color: "#ef4444",
                    }}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                    Delete user
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={loading || page === 0}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                loadUsers(query, next);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Previous
            </button>
            <button
              disabled={loading || page >= totalPages - 1}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                loadUsers(query, next);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the Clerk account and all related
              Paperspace data: papers, templates, forms, generated documents,
              submissions, collections, and connected accounts. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {deleting ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
