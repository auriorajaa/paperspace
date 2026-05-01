// components/SyncCooldownButton.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2Icon, PencilIcon, FileTextIcon } from "lucide-react";

interface Props {
  onClick: () => void;
  remainingMs: number;
  isOnCooldown: boolean;
  label?: string;
  icon?: "edit" | "open";
  fullWidth?: boolean;
}

export function SyncCooldownButton({
  onClick,
  remainingMs,
  isOnCooldown,
  label = "Edit",
  icon = "edit",
  fullWidth = true,
}: Props) {
  const [displayMs, setDisplayMs] = useState(remainingMs);

  useEffect(() => {
    if (!isOnCooldown) return;
    setDisplayMs(remainingMs);
    const interval = setInterval(() => {
      setDisplayMs((prev) => Math.max(0, prev - 100));
    }, 100);
    return () => clearInterval(interval);
  }, [isOnCooldown, remainingMs]);

  const Icon = icon === "edit" ? PencilIcon : FileTextIcon;

  return (
    <button
      onClick={onClick}
      disabled={isOnCooldown}
      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
        fullWidth ? "w-full" : "px-3"
      }`}
      style={{
        background: isOnCooldown ? "var(--bg-muted)" : "var(--bg-muted)",
        color: isOnCooldown ? "var(--text-dim)" : "var(--text-secondary)",
        border: `1px solid ${isOnCooldown ? "var(--border-subtle)" : "var(--border-subtle)"}`,
        opacity: isOnCooldown ? 0.55 : 1,
        cursor: isOnCooldown ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!isOnCooldown) {
          e.currentTarget.style.background = "var(--bg-input)";
          e.currentTarget.style.borderColor = "var(--border-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isOnCooldown) {
          e.currentTarget.style.background = "var(--bg-muted)";
          e.currentTarget.style.borderColor = "var(--border-subtle)";
        }
      }}
    >
      {isOnCooldown ? (
        <>
          <Loader2Icon className="w-3 h-3 animate-spin" />
          <span>Syncing {Math.ceil(displayMs / 1000)}s…</span>
        </>
      ) : (
        <>
          <Icon className="w-3 h-3" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
