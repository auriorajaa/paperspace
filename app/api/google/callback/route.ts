// app/api/google/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${APP_URL}/templates?error=google_oauth_denied`
    );
  }

  let templateId = "";
  let userIdFromState = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    templateId = decoded.templateId;
    userIdFromState = decoded.userId;
  } catch {
    return NextResponse.redirect(
      `${APP_URL}/templates?error=oauth_state_invalid`
    );
  }

  const redirectBase = templateId
    ? `${APP_URL}/templates/${templateId}/connect`
    : `${APP_URL}/templates`;

  const { userId: clerkUserId, getToken, sessionClaims } = await auth();

  if (!clerkUserId || clerkUserId !== userIdFromState) {
    console.error(
      "[google/callback] Clerk userId mismatch — possible session fixation attempt",
      { clerkUserId, userIdFromState }
    );
    return NextResponse.redirect(`${redirectBase}?error=oauth_state_invalid`);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.access_token) {
    console.error("[google/callback] Token exchange failed:", tokens);
    return NextResponse.redirect(`${redirectBase}?error=token_exchange_failed`);
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userRes.json();

  if (!userInfo.email) {
    console.error(
      "[google/callback] Could not retrieve user email from Google"
    );
    return NextResponse.redirect(`${redirectBase}?error=token_exchange_failed`);
  }

  // ── ADDED: Audit log if Google email is different than Clerk email ───────────
  // This is legitimate (user can have 2 different email), but we log
  // to see if there's trail to investigate.
  const clerkEmail = sessionClaims?.email as string | undefined;
  const emailMismatch = clerkEmail && userInfo.email !== clerkEmail;

  if (emailMismatch) {
    console.warn(
      "[google/callback] Google email differs from Clerk email — this is allowed but logged for audit",
      {
        clerkUserId,
        clerkEmail,
        googleEmail: userInfo.email,
        templateId: templateId || "(none)",
      }
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const clerkToken = await getToken({ template: "convex" });
  if (clerkToken) convex.setAuth(clerkToken);

  await convex.mutation(api.googleAccounts.upsert, {
    email: userInfo.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? "",
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    // ADDED: saved clerk email info for UI
    clerkEmail: clerkEmail ?? null,
  });

  return NextResponse.redirect(`${redirectBase}?connected=1`);
}
