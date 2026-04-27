// app/api/google/forms/[formId]/questions/route.ts
//
// FIX: ConvexHttpClient was previously module-level and mutated via setAuth()
// inside the handler. Under concurrent requests on a warm serverless instance,
// user A's token could overwrite user B's token before B's query fires.
// Fix: create a fresh client per request.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  return res.json();
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ formId: string }> }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { formId } = await context.params;

  // FIX: Create a fresh ConvexHttpClient per request instead of reusing a
  // module-level singleton. The singleton was mutated via setAuth() inside the
  // handler, which is not safe under concurrent serverless invocations — user
  // A's Clerk token could still be set when user B's query fires.
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const clerkToken = await getToken({ template: "convex" });
  if (clerkToken) convex.setAuth(clerkToken);

  // Fetch full account (tokens) via auth-gated query
  const account = await convex.query(api.googleAccounts.getMyFullAccount, {});

  if (!account) {
    return NextResponse.json(
      { error: "No Google account connected" },
      { status: 404 }
    );
  }

  let accessToken = account.accessToken;

  // ── Token refresh ─────────────────────────────────────────────────────────
  if (Date.now() > account.expiresAt - 60_000) {
    let refreshed: {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    try {
      refreshed = await refreshAccessToken(account.refreshToken);
    } catch {
      return NextResponse.json(
        {
          error:
            "Failed to reach Google's auth servers. Please try again in a moment.",
          code: "network_error",
        },
        { status: 503 }
      );
    }

    if (!refreshed.access_token) {
      const isRevoked = refreshed.error === "invalid_grant";
      return NextResponse.json(
        {
          error: isRevoked
            ? "Your Google access has been revoked. Please disconnect and reconnect your account."
            : "Failed to refresh access token. Please reconnect your Google account.",
          code: isRevoked ? "token_revoked" : "token_expired",
        },
        { status: 401 }
      );
    }

    accessToken = refreshed.access_token;

    await convex.mutation(api.googleAccounts.updateToken, {
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    });
  }

  // ── Fetch form from Google Forms API ─────────────────────────────────────
  let formRes: Response;
  try {
    formRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not reach Google Forms. Check your internet connection and try again.",
        code: "network_error",
      },
      { status: 503 }
    );
  }

  if (!formRes.ok) {
    const bodyText = await formRes.text().catch(() => "");
    console.error("[google/forms/questions]", formRes.status, bodyText);

    if (formRes.status === 401) {
      return NextResponse.json(
        {
          error:
            "Your Google session has expired. Please disconnect and reconnect your account.",
          code: "token_expired",
        },
        { status: 401 }
      );
    }

    if (formRes.status === 403) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to access this form. Make sure you're signed in " +
            "with the Google account that owns the form.",
          code: "form_forbidden",
        },
        { status: 403 }
      );
    }

    if (formRes.status === 404) {
      return NextResponse.json(
        {
          error:
            "Form not found. Double-check the URL or ID — the form may have been deleted or moved.",
          code: "form_not_found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Google Forms is temporarily unavailable. Please wait a moment and try again.",
        code: "forms_api_error",
      },
      { status: 502 }
    );
  }

  // ── Parse form ────────────────────────────────────────────────────────────
  const form = await formRes.json();

  const questions: { id: string; title: string }[] = [];
  const questionIdMap: Record<string, string> = {};

  for (const item of form.items ?? []) {
    const questionId = item.questionItem?.question?.questionId;
    const title = item.title;
    if (questionId && title) {
      questions.push({ id: questionId, title });
      questionIdMap[questionId] = title;
    }
  }

  const spreadsheetId: string | null =
    form.linkedSheetId ??
    form.info?.responseDestination?.drive?.spreadsheetId ??
    null;

  return NextResponse.json({
    formTitle: form.info?.title ?? "Untitled Form",
    questions,
    questionIdMap,
    spreadsheetId,
  });
}
