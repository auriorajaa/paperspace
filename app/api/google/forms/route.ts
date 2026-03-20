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

  const account = await convex.query(
    api.googleAccounts.getFullAccountForServer,
    { ownerId: userId }
  );

  if (!account) {
    return NextResponse.json(
      { error: "No Google account connected" },
      { status: 404 }
    );
  }

  let accessToken = account.accessToken;

  if (Date.now() > account.expiresAt - 60_000) {
    const refreshed = await refreshAccessToken(account.refreshToken);
    if (!refreshed.access_token) {
      return NextResponse.json(
        { error: "Token refresh failed" },
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

  const driveRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.form' and trashed=false",
        fields: "files(id,name,modifiedTime)",
        orderBy: "modifiedTime desc",
        pageSize: "50",
      }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!driveRes.ok) {
    console.error("[google/forms] Drive API error:", await driveRes.text());
    return NextResponse.json(
      { error: "Failed to list forms" },
      { status: 500 }
    );
  }

  const { files = [] } = await driveRes.json();
  return NextResponse.json({ forms: files });
}
