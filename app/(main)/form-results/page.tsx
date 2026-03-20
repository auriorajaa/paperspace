"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DownloadIcon,
  AlertCircleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { colors } from "@/lib/design-tokens";
import Link from "next/link";

type Submission = {
  _id: string;
  filename: string;
  status: string;
  submittedAt: number;
  connectionId: string;
  respondentEmail?: string;
  fieldValues?: Record<string, string>;
  fileUrl?: string;
  errorMessage?: string;
};

type Connection = {
  _id: string;
  formTitle: string;
  templateId: string;
  isActive: boolean;
};

export default function FormResultsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const submissions = useQuery(
    api.formConnections.getAllSubmissions,
    isLoaded && isSignedIn ? {} : "skip"
  ) as Submission[] | undefined;
  const connections = useQuery(
    api.formConnections.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  ) as (Connection & { templateName: string })[] | undefined;

  const [filter, setFilter] = useState<
    "all" | "generated" | "pending" | "error"
  >("all");

  const filtered = (submissions ?? []).filter(
    (s: Submission) => filter === "all" || s.status === filter
  );
  const getConnectionTitle = (connectionId: string) =>
    connections?.find((c: Connection) => c._id === connectionId)?.formTitle ??
    "Unknown form";

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "generated")
      return (
        <CheckCircleIcon className="w-4 h-4" style={{ color: "#34d399" }} />
      );
    if (status === "error")
      return <XCircleIcon className="w-4 h-4" style={{ color: "#f87171" }} />;
    return <ClockIcon className="w-4 h-4" style={{ color: "#fbbf24" }} />;
  };

  return (
    <div className="flex flex-col h-full" style={{ background: colors.bg }}>
      <div
        className="flex items-center justify-between px-6 py-5 shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div>
          <h1
            className="text-[15px] font-semibold"
            style={{ color: colors.text }}
          >
            Form results
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
            Documents auto-generated from Google Form submissions
          </p>
        </div>
      </div>

      {/* Filter */}
      <div
        className="flex items-center gap-2 px-6 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        {(["all", "generated", "pending", "error"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all capitalize"
            style={{
              background:
                filter === f
                  ? "rgba(99,102,241,0.15)"
                  : "rgba(255,255,255,0.04)",
              color: filter === f ? colors.accentLight : colors.textMuted,
              border: `1px solid ${filter === f ? colors.accentBorder : "transparent"}`,
            }}
          >
            {f}
            {f !== "all" && (
              <span className="ml-1.5 text-[10px]">
                {(submissions ?? []).filter((s) => s.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {submissions === undefined ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: colors.accentLight }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p
              className="text-sm font-semibold mb-1"
              style={{ color: colors.textSecondary }}
            >
              No results yet
            </p>
            <p className="text-xs" style={{ color: colors.textDim }}>
              Submit a Google Form connected to a template to see results here.
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((s) => (
              <div
                key={s._id}
                className="flex items-center gap-3 px-6 py-3.5 transition-colors"
                style={{ borderBottom: `1px solid ${colors.border}` }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <StatusIcon status={s.status} />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-medium truncate"
                    style={{ color: colors.text }}
                  >
                    {s.filename}.docx
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-[11px]"
                      style={{ color: colors.textMuted }}
                    >
                      {getConnectionTitle(s.connectionId)}
                    </span>
                    {s.respondentEmail && (
                      <>
                        <span style={{ color: colors.textDim }}>·</span>
                        <span
                          className="text-[11px]"
                          style={{ color: colors.textMuted }}
                        >
                          {s.respondentEmail}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span
                  className="text-[11px] shrink-0"
                  style={{ color: colors.textDim }}
                >
                  {formatDistanceToNow(new Date(s.submittedAt), {
                    addSuffix: true,
                  })}
                </span>
                {s.status === "generated" && s.fileUrl && (
                  <a
                    href={s.fileUrl}
                    download={`${s.filename}.docx`}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
                    style={{
                      background: "rgba(52,211,153,0.1)",
                      color: "#34d399",
                      border: "1px solid rgba(52,211,153,0.2)",
                    }}
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    Download
                  </a>
                )}
                {s.status === "error" && (
                  <span
                    className="text-[11px] px-2 py-1 rounded-lg"
                    style={{
                      background: "rgba(248,113,113,0.1)",
                      color: "#f87171",
                    }}
                    title={s.errorMessage}
                  >
                    Error
                  </span>
                )}
                {s.status === "pending" && (
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "#fbbf24" }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
