// app/api/google/forms/route.ts
//
// Previously: listed all Google Forms via Drive API (required drive.readonly scope).
// Now: validates and fetches metadata for a single form by ID using the Forms API
// (forms.body.readonly scope), which is already approved.
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
  const { userId } = await auth();
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

  const account = await convex.query(
    api.googleAccounts.getFullAccountForServer,
    { ownerId: userId }
  );

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

  // Refresh token if expired or about to expire
  if (Date.now() > account.expiresAt - 60_000) {
    const refreshed = await refreshAccessToken(account.refreshToken);
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
      ownerId: userId,
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    });
  }

  // Fetch form metadata via Forms API (forms.body.readonly scope)
  const formRes = await fetch(
    `https://forms.googleapis.com/v1/forms/${formId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!formRes.ok) {
    const body = await formRes.text();
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
            "You don't have permission to access this form. Make sure you are the form owner and that access hasn't been restricted.",
          code: "form_forbidden",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Failed to fetch form details from Google. Please try again in a moment.",
        code: "forms_api_error",
      },
      { status: 500 }
    );
  }

  const form = await formRes.json();

  return NextResponse.json({
    formId,
    formTitle: form.info?.title ?? "Untitled Form",
    ok: true,
  });
}
