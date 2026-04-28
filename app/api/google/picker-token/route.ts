// app/api/google/picker-token/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const clerkToken = await getToken({ template: "convex" });
  if (clerkToken) convex.setAuth(clerkToken);

  const account = await convex.query(api.googleAccounts.getMyFullAccount, {});
  if (!account)
    return NextResponse.json({ error: "No Google account" }, { status: 404 });

  let accessToken = account.accessToken;

  if (Date.now() > account.expiresAt - 60_000) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: account.refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    const refreshed = await res.json();
    if (!refreshed.access_token) {
      return NextResponse.json(
        { error: "Token refresh failed" },
        { status: 401 }
      );
    }
    accessToken = refreshed.access_token;
    await convex.mutation(api.googleAccounts.updateToken, {
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    });
  }

  return NextResponse.json({ accessToken });
}
