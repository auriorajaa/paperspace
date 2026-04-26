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

  // ── Decode state ──────────────────────────────────────────────────────────
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

  // ── Verify Clerk session ──────────────────────────────────────────────────
  // The user was authenticated before clicking "Connect with Google", so their
  // Clerk session cookie is still valid at the time of this callback.
  const { userId: clerkUserId, getToken } = await auth();

  // Extra safety: make sure the Clerk session matches the userId we encoded
  // in the OAuth state, preventing session fixation attacks.
  if (!clerkUserId || clerkUserId !== userIdFromState) {
    console.error(
      "[google/callback] Clerk userId mismatch — session may have changed",
      { clerkUserId, userIdFromState }
    );
    return NextResponse.redirect(`${redirectBase}?error=oauth_state_invalid`);
  }

  // ── Exchange code for tokens ───────────────────────────────────────────────
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

  // ── Get user email from Google ────────────────────────────────────────────
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

  // ── Save to Convex ────────────────────────────────────────────────────────
  // SECURITY FIX: Forward the Clerk JWT so the `upsert` mutation can derive
  // ownerId from the verified identity instead of trusting a caller-supplied
  // ownerId param. This also means the mutation can now enforce auth itself.
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const clerkToken = await getToken({ template: "convex" });
  if (clerkToken) convex.setAuth(clerkToken);

  await convex.mutation(api.googleAccounts.upsert, {
    email: userInfo.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? "",
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  });

  return NextResponse.redirect(`${redirectBase}?connected=1`);
}
