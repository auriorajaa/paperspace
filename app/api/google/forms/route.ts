// app/api/google/forms/route.ts
//
// Validates and fetches metadata for a single form by ID using the Forms API
// (forms.body.readonly scope).
//
// Usage: GET /api/google/forms?formId=<google_form_id>

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const formId = searchParams.get("formId");

  if (!formId) {
    return NextResponse.json(
      {
        error:
          "formId is required. Please provide the Google Form ID or URL as ?formId=...",
      },
      { status: 400 }
    );
  }

  // SECURITY FIX: Thread Clerk JWT so getMyFullAccount can verify identity
  const clerkToken = await getToken({ template: "convex" });
  if (clerkToken) convex.setAuth(clerkToken);

  const account = await convex.query(api.googleAccounts.getMyFullAccount, {});

  if (!account) {
    return NextResponse.json(
      {
        error:
          "No Google account connected. Please connect your Google account first.",
      },
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
            : "Your Google session has expired. Please reconnect your account.",
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

  // ── Fetch form via Forms API ───────────────────────────────────────────────
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
    const body = await formRes.text().catch(() => "");
    console.error("[google/forms] Forms API error:", formRes.status, body);

    if (formRes.status === 404) {
      return NextResponse.json(
        {
          error:
            "Form not found. Double-check the Form ID or URL and make sure the form still exists.",
          code: "form_not_found",
        },
        { status: 404 }
      );
    }

    if (formRes.status === 403) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to access this form. Make sure you are the form owner.",
          code: "form_forbidden",
        },
        { status: 403 }
      );
    }

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

    return NextResponse.json(
      {
        error:
          "Failed to fetch form details from Google. Please try again in a moment.",
        code: "forms_api_error",
      },
      { status: 502 }
    );
  }

  const form = await formRes.json();

  return NextResponse.json({
    formId,
    formTitle: form.info?.title ?? "Untitled Form",
    ok: true,
  });
}
