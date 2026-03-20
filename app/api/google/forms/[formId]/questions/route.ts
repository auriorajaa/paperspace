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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ formId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { formId } = await context.params;

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

  const formRes = await fetch(
    `https://forms.googleapis.com/v1/forms/${formId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!formRes.ok) {
    console.error("[google/forms/questions]", await formRes.text());
    return NextResponse.json(
      { error: "Failed to fetch form" },
      { status: 500 }
    );
  }

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

  return NextResponse.json({
    formTitle: form.info?.title ?? "Untitled Form",
    questions,
    questionIdMap,
  });
}
