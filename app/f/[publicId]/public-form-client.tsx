"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { FormQuestion } from "@/components/forms/QuestionBlock";
import { SITE_NAME } from "@/lib/metadata";

export default function PublicFormClient() {
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

  if (form === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent-light)" }}
        />
      </div>
    );
  }

  if (form === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center max-w-md px-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
            style={{
              background: "var(--bg-muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            📋
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
    );
  }

  if (!form.settings.acceptResponses) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center max-w-md px-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
            style={{
              background: "var(--bg-muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            🔒
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
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center max-w-md px-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
            style={{
              background: "var(--success-bg)",
              border:
                "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
            }}
          >
            ✅
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
            {form.settings.confirmationMessage ||
              "Thank you! Your response has been recorded."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="shrink-0 px-4 py-3 text-center"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
        }}
      >
        <p
          className="text-[11px]"
          style={{ color: "var(--text-dim)" }}
        >
          {SITE_NAME}
        </p>
      </div>

      <div className="flex-1 flex justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <FormRenderer
              schema={form.schema as FormQuestion[]}
              title={form.title}
              description={form.description}
              disabled={submitting}
              onSubmit={handleSubmit}
              submitLabel={submitting ? "Submitting…" : "Submit"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
