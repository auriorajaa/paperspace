// app/api/onlyoffice-command/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth } from "@clerk/nextjs/server";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 30) return true;
  entry.count++;
  return false;
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

const ALLOWED_COMMANDS = ["forcesave", "info", "drop"] as const;
type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

/**
 * Proxy to OnlyOffice Command Service.
 *
 * Primary use: `forcesave` — flush the editor's current state to the
 * callback URL so Convex gets the latest file before we scan.
 *
 * OO error codes:
 *   0 = OK
 *   1 = document not found / key unknown
 *   4 = no active co-editing session (doc not open) — treat as "nothing to flush"
 *   6 = invalid params
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: { key?: string; command?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { key, command } = body;

  if (!key || typeof key !== "string" || key.length > 512) {
    return NextResponse.json(
      { error: "Missing or invalid key" },
      { status: 400 }
    );
  }

  if (!command || !ALLOWED_COMMANDS.includes(command as AllowedCommand)) {
    return NextResponse.json(
      { error: `command must be one of: ${ALLOWED_COMMANDS.join(", ")}` },
      { status: 400 }
    );
  }

  const ooServerUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL;
  if (!ooServerUrl) {
    return NextResponse.json(
      { error: "OnlyOffice server not configured" },
      { status: 500 }
    );
  }

  const commandUrl = `${ooServerUrl.replace(/\/$/, "")}/command`;

  const payload: Record<string, string> = { c: command, key };
  const requestBody: Record<string, string> = { ...payload };

  const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
  if (jwtSecret) {
    requestBody.token = jwt.sign(payload, jwtSecret, { algorithm: "HS256" });
  }

  try {
    const ooRes = await fetch(commandUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const text = await ooRes.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      // OO occasionally returns XML on error
      console.error(
        "[onlyoffice-command] non-JSON response:",
        text.slice(0, 200)
      );
      return NextResponse.json(
        { error: 1, raw: text.slice(0, 200) },
        { status: 502 }
      );
    }

    // error 0 = success, error 4 = no active session (treat as "already saved")
    return NextResponse.json(data, { status: ooRes.ok ? 200 : 502 });
  } catch (err: any) {
    console.error("[onlyoffice-command] fetch failed:", err);
    return NextResponse.json(
      { error: 1, message: err.message ?? "Command request failed" },
      { status: 500 }
    );
  }
}
