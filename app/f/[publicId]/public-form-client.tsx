// app\f\[publicId]\public-form-client.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useUser, useClerk, SignInButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { PreAuthNavbar } from "@/components/PreAuthNavbar";
import type { FormQuestion } from "@/components/forms/QuestionBlock";

const FONT_CSS: Record<string, string | undefined> = {
  default: undefined,
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  rounded: "'Quicksand', system-ui, sans-serif",
};

export default function PublicFormClient({
  isSignedIn: _serverSignedIn,
  submittedParam,
}: {
  isSignedIn: boolean;
  submittedParam?: string;
}) {
  const params = useParams();
  const publicId = params.publicId as string;

  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();

  const isAuthReady = userLoaded;
  const effectiveSignedIn = isAuthReady ? !!isSignedIn : _serverSignedIn;

  const form = useQuery(api.internalForms.getByPublicId, {
    publicId,
  });
  const submitResponse = useMutation(api.internalFormResponses.submit);

  const [submitted, setSubmitted] = useState(submittedParam === "true");
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
        respondentEmail: user?.primaryEmailAddress?.emailAddress,
        userAgent: navigator.userAgent,
      });
      setSubmitted(true);
      await clerk.signOut({
        redirectUrl: `/f/${publicId}?submitted=true`,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  const themeColor = (form as any)?.settings?.themeColor;
  const headerImage = (form as any)?.settings?.headerImage;
  const showHeader = (form as any)?.settings?.showHeader !== false;
  const showProgress = (form as any)?.settings?.showProgress !== false;
  const submitButtonText = (form as any)?.settings?.submitButtonText;
  const confirmationMessage = (form as any)?.settings?.confirmationMessage;
  const cornerStyle = (form as any)?.settings?.cornerStyle || "soft";
  const fontFamily = FONT_CSS[(form as any)?.settings?.fontFamily || "default"];
  const collectEmail = (form as any)?.settings?.collectEmail;

  const respondentEmail = user?.primaryEmailAddress?.emailAddress;

  if (form === undefined) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "var(--bg)" }}
      >
        <PreAuthNavbar isSignedIn={effectiveSignedIn} />
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
      <StatePage
        isSignedIn={effectiveSignedIn}
        title="Form not found"
        message="This form may have been unpublished or deleted."
        icon={
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
        }
      />
    );
  }

  if (collectEmail && !isAuthReady) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "var(--bg)" }}
      >
        <PreAuthNavbar page="form" isSignedIn={false} />
        <div className="flex-1 flex items-center justify-center px-4 pt-14">
          <div className="text-center max-w-md">
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
              style={{ borderColor: "var(--accent-light)" }}
            />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Checking your account&hellip;
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!form.settings.acceptResponses) {
    return (
      <StatePage
        isSignedIn={effectiveSignedIn}
        title="Form is closed"
        message="This form is no longer accepting responses. Please reach out to the person who shared this link."
        icon={
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
        }
      />
    );
  }

  if (submitted) {
    return (
      <StatePage
        isSignedIn={false}
        title="Response submitted"
        message={
          confirmationMessage || "Thank you! Your response has been recorded."
        }
        tone="success"
        icon={
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
        }
      />
    );
  }

  const allowedDomains = (form as any)?.settings?.allowedDomains ?? [];
  const userDomain = respondentEmail?.split("@")[1]?.toLowerCase();
  const domainAllowed =
    !collectEmail ||
    allowedDomains.length === 0 ||
    (userDomain &&
      allowedDomains.some((d: string) => userDomain === d.toLowerCase().trim()));

  if (collectEmail && isAuthReady && isSignedIn && respondentEmail && !domainAllowed) {
    const domainList = allowedDomains
      .map((d: string) => `@${d}`)
      .join(", ");
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "var(--bg)" }}
      >
        <PreAuthNavbar page="form" isSignedIn={true} />
        <div className="flex-1 flex items-center justify-center px-4 pt-14">
          <div className="text-center max-w-md">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text)" }}
            >
              This email can't be used
            </h1>
            <p
              className="text-sm mb-4 leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              You're signed in as{" "}
              <strong className="break-all" style={{ color: "var(--text)" }}>
                {respondentEmail}
              </strong>
              , but this form only accepts emails from{" "}
              {domainList}. Please sign in with a different Google
              account.
            </p>
            <button
              onClick={() =>
                clerk.signOut({ redirectUrl: `/f/${publicId}` })
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: themeColor || "var(--accent-light)",
                color: "#fff",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Try another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (collectEmail && !effectiveSignedIn) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "var(--bg)" }}
      >
        <PreAuthNavbar page="form" isSignedIn={false} />
        <div className="flex-1 flex items-center justify-center px-4 pt-14">
          <div className="text-center max-w-md">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
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
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h1
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text)" }}
            >
              Sign in to continue
            </h1>
            <p
              className="text-sm mb-6"
              style={{ color: "var(--text-muted)" }}
            >
              This form requires a Google account. Your email will be recorded
              with your response.
            </p>
            <SignInButton mode="modal">
              <button
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: themeColor || "var(--accent-light)",
                  color: "#fff",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                  <line x1="21.17" x2="12" y1="8" y2="8" />
                  <line x1="3.95" x2="8.54" y1="6.06" y2="14" />
                  <line x1="10.88" x2="15.46" y1="21.94" y2="14" />
                </svg>
                Sign in with Google
              </button>
            </SignInButton>
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
      <PreAuthNavbar page="form" isSignedIn={effectiveSignedIn} />

      <div className="flex-1 flex justify-center px-4 py-8 pt-18 sm:pt-22">
        <div className="w-full max-w-2xl">
          {collectEmail && respondentEmail && (
            <div
              className="mb-3 px-3 py-2 rounded-xl text-[11px] flex items-center gap-1.5 flex-wrap"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-light)",
                border: "1px solid var(--accent-border)",
              }}
            >
              {/* <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg> */}
              <span>Submitting as <strong className="break-all">{respondentEmail}</strong></span>
            </div>
          )}
          <div
            className="rounded-2xl p-6 sm:p-8 shadow-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              ...(themeColor ? { borderTop: `4px solid ${themeColor}` } : {}),
            }}
          >
            <FormRenderer
              schema={form.schema as FormQuestion[]}
              title={form.title}
              description={form.description}
              disabled={submitting}
              onSubmit={handleSubmit}
              submitLabel={
                submitting ? "Submitting\u2026" : submitButtonText || "Submit"
              }
              themeColor={themeColor}
              headerImage={headerImage}
              showHeader={showHeader}
              showProgress={showProgress}
              cornerStyle={cornerStyle}
              fontFamily={fontFamily}
            />
          </div>
          <p
            className="text-center text-[11px] mt-4"
            style={{ color: "var(--text-dim)" }}
          >
            Your responses are recorded securely. Do not include sensitive
            information you wouldn't share over email.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatePage({
  isSignedIn,
  title,
  message,
  icon,
  tone = "neutral",
}: {
  isSignedIn: boolean;
  title: string;
  message: string;
  icon: React.ReactNode;
  tone?: "neutral" | "success";
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      <PreAuthNavbar isSignedIn={isSignedIn} />
      <div className="flex-1 flex items-center justify-center px-4 pt-14">
        <div className="text-center max-w-md">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background:
                tone === "success" ? "var(--success-bg)" : "var(--bg-muted)",
              border:
                tone === "success"
                  ? "1px solid color-mix(in srgb, var(--success) 20%, transparent)"
                  : "1px solid var(--border-subtle)",
            }}
          >
            {icon}
          </div>
          <h1
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--text)" }}
          >
            {title}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
