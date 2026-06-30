// app\(main)\admin\users\[userId]\user-detail-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeftIcon, MailIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NOTIFY_REASONS = [
  { value: "Notification", label: "General notification" },
  { value: "Suspicious activity", label: "Suspicious activity" },
  { value: "Inactivity warning", label: "Inactivity warning" },
  { value: "Account warning", label: "Account warning" },
  { value: "Custom", label: "Custom message" },
] as const;
import type { AdminUser } from "../../types";

type ResourceItem = {
  _id: string;
  title?: string;
  name?: string;
  status?: string;
  _creationTime: number;
  fileUrl?: string;
  isArchived?: boolean;
};
type UserResources = {
  documents: ResourceItem[];
  collections: ResourceItem[];
  templates: ResourceItem[];
  forms: ResourceItem[];
  counts: Record<string, number>;
};

type DetailResponse = { user: AdminUser; resources: UserResources };

function fmt(value: number | null | undefined) {
  if (!value) return "Never";
  return format(value, "dd MMM yyyy HH:mm");
}

function ResourceList({
  title,
  items,
}: {
  title: string;
  items: ResourceItem[];
}) {
  return (
    <section
      className="min-w-0 rounded-xl p-3.5 sm:p-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <h2
          className="truncate text-[14px] font-semibold sm:text-base"
          style={{ color: "var(--text)" }}
        >
          {title}
        </h2>
        <span
          className="shrink-0 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 8).map((item) => (
          <div
            key={item._id}
            className="min-w-0 rounded-lg p-3"
            style={{ background: "var(--bg-muted)" }}
          >
            <p
              className="truncate text-sm font-medium"
              style={{ color: "var(--text)" }}
            >
              {item.title ?? item.name ?? item._id}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {fmt(item._creationTime)}
            </p>
          </div>
        ))}
        {items.length === 0 && (
          <p
            className="py-6 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No records.
          </p>
        )}
      </div>
    </section>
  );
}

export default function UserDetailClient({ userId }: { userId: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyReason, setNotifyReason] = useState("Notification");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${userId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load user");
        if (!cancelled) setData(json);
      })
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : "Failed to load user"
        )
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const deleteUser = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete user");
      toast.success("User deleted");
      window.location.href = "/admin/users";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const sendNotification = async () => {
    if (!notifyMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: notifyReason, message: notifyMessage.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send notification");
      toast.success("Notification sent");
      setNotifyOpen(false);
      setNotifyMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-5 overflow-x-hidden px-4 py-5 sm:py-6 md:px-8 animate-pulse">
        <div className="h-4 w-20 rounded bg-[var(--bg-muted)]" />
        <div
          className="min-w-0 rounded-xl p-4 sm:p-5"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="h-12 w-12 shrink-0 rounded-xl bg-[var(--bg-muted)] sm:h-14 sm:w-14" />
              <div className="min-w-0 space-y-2">
                <div className="h-5 w-40 rounded bg-[var(--bg-muted)]" />
                <div className="h-4 w-56 rounded bg-[var(--bg-muted)]" />
                <div className="h-3 w-32 rounded bg-[var(--bg-muted)]" />
              </div>
            </div>
            <div className="h-9 w-full shrink-0 rounded-lg bg-[var(--bg-muted)] md:w-44" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-0">
                <div className="h-3 w-12 rounded bg-[var(--bg-muted)]" />
                <div className="mt-1 h-4 w-24 rounded bg-[var(--bg-muted)]" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="min-w-0 rounded-xl p-3.5 sm:p-4"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
              <div className="mt-2 h-7 w-12 rounded bg-[var(--bg-muted)]" />
            </div>
          ))}
        </div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="min-w-0 rounded-xl p-3.5 sm:p-4"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="h-4 w-20 rounded bg-[var(--bg-muted)]" />
                <div className="h-3 w-6 rounded bg-[var(--bg-muted)]" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div
                    key={j}
                    className="rounded-lg p-3"
                    style={{ background: "var(--bg-muted)" }}
                  >
                    <div className="h-3.5 w-40 rounded bg-[var(--bg-muted)]" />
                    <div className="mt-1 h-3 w-24 rounded bg-[var(--bg-muted)]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data)
    return (
      <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
        User not found.
      </div>
    );

  const { user, resources } = data;

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 overflow-x-hidden px-4 py-5 pb-[calc(1rem+env(safe-area-inset-bottom)+52px)] sm:py-6 sm:pb-6 md:px-8">
      <Link
        href="/admin/users"
        className="inline-flex w-fit items-center gap-2 text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to users
      </Link>

      <div
        className="min-w-0 rounded-xl p-4 sm:p-5"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img
              src={user.imageUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl object-cover sm:h-14 sm:w-14"
            />
            <div className="min-w-0">
              <h1
                className="truncate text-lg font-semibold sm:text-2xl"
                style={{ color: "var(--text)" }}
              >
                {user.name}
              </h1>
              <p
                className="truncate text-[13px] sm:text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {user.email}
              </p>
              <p
                className="mt-1 truncate text-[11px]"
                style={{ color: "var(--text-dim)" }}
              >
                {user.id}
              </p>
            </div>
          </div>
          <div className="flex w-full gap-2 md:w-fit">
            <button
              onClick={() => setNotifyOpen(true)}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium md:flex-initial"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-light)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <MailIcon className="h-4 w-4" />
              Notify user
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium md:flex-initial"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
            >
              <Trash2Icon className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="min-w-0">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Created
            </p>
            <p
              className="truncate text-sm font-medium"
              style={{ color: "var(--text)" }}
            >
              {fmt(user.createdAt)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Last sign in
            </p>
            <p
              className="truncate text-sm font-medium"
              style={{ color: "var(--text)" }}
            >
              {fmt(user.lastSignInAt)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Inactive
            </p>
            <p
              className="truncate text-sm font-medium"
              style={{
                color: user.inactiveDays >= 120 ? "#ef4444" : "var(--text)",
              }}
            >
              {user.inactiveDays} days
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Warning sent
            </p>
            <p
              className="truncate text-sm font-medium"
              style={{ color: "var(--text)" }}
            >
              {fmt(user.warningSentAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(resources.counts).map(([key, value]) => (
          <div
            key={key}
            className="min-w-0 rounded-xl p-3.5 sm:p-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <p
              className="truncate text-xs capitalize"
              style={{ color: "var(--text-muted)" }}
            >
              {key.replace(/([A-Z])/g, " $1")}
            </p>
            <p
              className="mt-2 truncate text-xl font-semibold sm:text-2xl"
              style={{ color: "var(--text)" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ResourceList title="Papers" items={resources.documents} />
        <ResourceList title="Templates" items={resources.templates} />
        <ResourceList title="Forms" items={resources.forms} />
        <ResourceList title="Collections" items={resources.collections} />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {user.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the Clerk account and all Paperspace data
              owned by this user. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                deleteUser();
              }}
            >
              {deleting ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <AlertDialogContent className="!max-w-md !sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Notify {user.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Send an email to <strong className="font-medium" style={{ color: "var(--text)" }}>{user.email}</strong> from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-4 px-2 pb-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Reason
              </label>
              <Select
                value={notifyReason}
                onValueChange={(val) => {
                  setNotifyReason(val);
                  if (val === "Suspicious activity") {
                    setNotifyMessage("We detected unusual activity on your Paperspace account. If this was you, no further action is needed. If you believe your account may be compromised, please contact our support team immediately to secure your account and data.");
                  } else if (val === "Inactivity warning") {
                    setNotifyMessage("Your Paperspace account has been inactive for a significant period. If you wish to keep your account and associated data (documents, templates, and forms), please sign in to your account within the next 10 days. Accounts that remain inactive will be subject to removal.");
                  } else if (val === "Account warning") {
                    setNotifyMessage("We are writing to bring to your attention that your Paperspace account requires review. Please log in to your account and verify that your information, documents, and settings are up to date. If you have any questions, please don't hesitate to reach out to our support team.");
                  } else {
                    setNotifyMessage("");
                  }
                }}
              >
                <SelectTrigger
                  className="w-full"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text)",
                  }}
                >
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {NOTIFY_REASONS.map((r) => (
                    <SelectItem
                      key={r.value}
                      value={r.value}
                      style={{ color: "var(--text)" }}
                    >
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Message
              </label>
              <textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                placeholder="Write your message..."
                rows={4}
                className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text)",
                  border: "1px solid var(--border-subtle)",
                  minHeight: "100px",
                }}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending || !notifyMessage.trim()}
              onClick={(event) => {
                event.preventDefault();
                sendNotification();
              }}
            >
              {sending ? "Sending..." : "Send email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
