// D:\Skripsi\paperspace\app\api\google\callback\route.ts

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
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

  // Decode state
  let templateId = "";
  let userId = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    templateId = decoded.templateId;
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect(
      `${APP_URL}/templates?error=oauth_state_invalid`
    );
  }

  const redirectBase = templateId
    ? `${APP_URL}/templates/${templateId}/connect`
    : `${APP_URL}/templates`;

  // Exchange code for tokens
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

  // Get user email from Google
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userRes.json();

  // Save to Convex (upsert)
  await convex.mutation(api.googleAccounts.upsert, {
    ownerId: userId,
    email: userInfo.email ?? "unknown",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? "",
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  });

  return NextResponse.redirect(`${redirectBase}?connected=1`);
}
