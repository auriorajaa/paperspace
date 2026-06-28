"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { PreAuthNavbar } from "@/components/PreAuthNavbar";
import type { FormQuestion } from "@/components/forms/QuestionBlock";

export default function PublicFormClient({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) {
  const params = useParams();
  const publicId = params.publicId as string;

  const form = useQuery(api.internalForms.getByPublicId, {
    publicId,
  });
  const submitResponse = useMutation(api.internalFormResponses.submit);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (
    answers: { questionId: string; value: string }[]
  ) => {
    if (!form) return;
    setSubmitting(true);
    try {
      await submitResponse({
        publicId,
        answers,
        userAgent: navigator.userAgent,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  const themeColor = (form as any)?.settings?.themeColor;
  const headerImage = (form as any)?.settings?.headerImage;
  const showHeader = (form as any)?.settings?.showHeader !== false;
  const submitButtonText = (form as any)?.settings?.submitButtonText;
  const confirmationMessage = (form as any)?.settings?.confirmationMessage;

  if (form === undefined) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "var(--bg)" }}
      >
        <PreAuthNavbar isSignedIn={isSignedIn} />
        <div className="flex-1 flex items-center justify-center pt-14">
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
        className="min-h-screen flex flex-col"
        style={{ background: "var(--bg)" }}
      >
        <PreAuthNavbar isSignedIn={isSignedIn} />
        <div className="flex-1 flex items-center justify-center px-4 pt-14">
          <div className="text-center max-w-md">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--text-dim)" }}
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" x2="15" y1="15" y2="15" />
              </svg>
            </div>
            <h1
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text)" }}
            >
              Form not found
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              This form may have been unpublished or deleted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!form.settings.acceptResponses) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "var(--bg)" }}
      >
        <PreAuthNavbar isSignedIn={isSignedIn} />
        <div className="flex-1 flex items-center justify-center px-4 pt-14">
          <div className="text-center max-w-md">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--text-dim)" }}
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text)" }}
            >
              Form is closed
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              This form is no longer accepting responses.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "var(--bg)" }}
      >
        <PreAuthNavbar isSignedIn={isSignedIn} />
        <div className="flex-1 flex items-center justify-center px-4 pt-14">
          <div className="text-center max-w-md">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "var(--success-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--success)" }}
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text)" }}
            >
              Response submitted
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {confirmationMessage ||
                "Thank you! Your response has been recorded."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      <PreAuthNavbar page="form" isSignedIn={isSignedIn} />

      <div className="flex-1 flex justify-center px-4 py-8 pt-18 sm:pt-22">
        <div className="w-full max-w-2xl">
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              ...(themeColor
                ? { borderTop: `4px solid ${themeColor}` }
                : {}),
            }}
          >
            <FormRenderer
              schema={form.schema as FormQuestion[]}
              title={form.title}
              description={form.description}
              disabled={submitting}
              onSubmit={handleSubmit}
              submitLabel={submitting ? "Submitting\u2026" : submitButtonText || "Submit"}
              themeColor={themeColor}
              headerImage={headerImage}
              showHeader={showHeader}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
