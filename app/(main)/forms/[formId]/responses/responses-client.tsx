"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { ChevronDownIcon, ChevronUpIcon, DownloadIcon } from "lucide-react";

export default function ResponsesPageClient() {
  const params = useParams();
  const formId = params.formId as Id<"internalForms">;
  const { isLoaded, isSignedIn } = useAuth();

  const form = useQuery(
    api.internalForms.getById,
    isLoaded && isSignedIn ? { id: formId } : "skip"
  );
  const responses = useQuery(
    api.internalFormResponses.getByFormId,
    isLoaded && isSignedIn ? { formId } : "skip"
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isLoading = form === undefined || responses === undefined;

  const handleExportCsv = () => {
    if (!responses || !form) return;
    const headers = form.schema.map((q: any) => q.title);
    const rows = responses.map((r: any) =>
      form.schema.map((q: any) => {
        const answer = r.answers.find(
          (a: any) => a.questionId === q.id
        );
        return answer ? `"${answer.value.replace(/"/g, '""')}"` : "";
      })
    );
    const csv = [
      ["Submitted At", ...headers].join(","),
      ...rows.map((row: string[], i: number) =>
        [
          `"${format(new Date(responses[i].submittedAt), "yyyy-MM-dd HH:mm:ss")}"`,
          ...row,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.title}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div
        className="flex flex-col h-full"
        style={{ background: "var(--bg)" }}
      >
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent-light)" }}
          />
        </div>
      </div>
    );
  }

  if (form === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        style={{ background: "var(--bg)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          Form not found
        </p>
        <Link
          href="/forms"
          className="text-[13px] font-medium px-4 py-2 rounded-xl"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          Back to forms
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="flex items-center justify-between px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Link
              href="/forms"
              className="text-[11px] transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              Forms
            </Link>
            <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
              /
            </span>
            <Link
              href={`/forms/${formId}/builder`}
              className="text-[11px] transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              {form.title}
            </Link>
            <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
              /
            </span>
            <span
              className="text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Responses
            </span>
          </div>
          <h1
            className="text-[15px] sm:text-base font-semibold"
            style={{ color: "var(--text)" }}
          >
            {responses.length} response{responses.length !== 1 ? "s" : ""}
          </h1>
        </div>

        {responses.length > 0 && (
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl min-h-[44px] transition-all"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            Export CSV
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {responses.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            style={{ border: "1px dashed var(--border-subtle)" }}
          >
            <p
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              No responses yet
            </p>
            <p
              className="text-xs max-w-xs"
              style={{ color: "var(--text-dim)" }}
            >
              Share the public link to start collecting responses.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl space-y-2">
            {responses.map((r: any) => (
              <div
                key={r._id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <button
                  onClick={() =>
                    setExpandedId(
                      expandedId === r._id ? null : r._id
                    )
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    background:
                      expandedId === r._id
                        ? "var(--bg-muted)"
                        : "transparent",
                  }}
                >
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {format(
                      new Date(r.submittedAt),
                      "MMM d, yyyy · h:mm a"
                    )}
                  </span>
                  {r.respondentEmail && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {r.respondentEmail}
                    </span>
                  )}
                  <div className="flex-1" />
                  {expandedId === r._id ? (
                    <ChevronUpIcon
                      className="w-3.5 h-3.5"
                      style={{ color: "var(--text-dim)" }}
                    />
                  ) : (
                    <ChevronDownIcon
                      className="w-3.5 h-3.5"
                      style={{ color: "var(--text-dim)" }}
                    />
                  )}
                </button>

                {expandedId === r._id && (
                  <div
                    className="border-t px-4 py-3 space-y-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    {form.schema.map((q: any) => {
                      const answer = r.answers.find(
                        (a: any) => a.questionId === q.id
                      );
                      return (
                        <div key={q.id}>
                          <p
                            className="text-xs font-medium"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {q.title}
                          </p>
                          <p
                            className="text-sm"
                            style={{ color: "var(--text)" }}
                          >
                            {answer?.value || (
                              <span
                                className="italic"
                                style={{
                                  color: "var(--text-dim)",
                                }}
                              >
                                No answer
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
