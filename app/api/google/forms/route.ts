import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function refreshToken(refreshToken: string) {
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

  // We need full account including tokens — use a server-side Convex call
  // Since getMyAccount strips tokens, we call upsert-less query via internal
  // Instead: use a dedicated query that returns tokens server-side only
  const accountPublic = await convex.query(api.googleAccounts.getMyAccount);
  if (!accountPublic) {
    return NextResponse.json(
      { error: "No Google account connected" },
      { status: 404 }
    );
  }

  // We need a fresh token — fetch it via a dedicated server route
  // Get full account with token via a server action workaround:
  // Since Convex public queries strip tokens for security, we'll use
  // a separate internal endpoint approach. For now, we pass the userId
  // to get tokens via a special query.
  const fullAccount = await convex.query(
    api.googleAccounts.getFullAccountForServer,
    {
      ownerId: userId,
    }
  );
  if (!fullAccount) {
    return NextResponse.json(
      { error: "No Google account connected" },
      { status: 404 }
    );
  }

  let accessToken = fullAccount.accessToken;

  // Refresh if expired
  if (Date.now() > fullAccount.expiresAt - 60_000) {
    const refreshed = await refreshToken(fullAccount.refreshToken);
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

  // List Google Forms from Drive
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
    const err = await driveRes.text();
    console.error("[google/forms] Drive API error:", err);
    return NextResponse.json(
      { error: "Failed to list forms" },
      { status: 500 }
    );
  }

  const { files = [] } = await driveRes.json();
  return NextResponse.json({ forms: files });
}
