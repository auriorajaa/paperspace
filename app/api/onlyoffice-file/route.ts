// app\api\onlyoffice-file\route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Simple in-memory rate limiter (per IP, 60 req/min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 60) return true;
  entry.count++;
  return false;
}

function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!["http:", "https:"].includes(url.protocol)) return true;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost"))
      return true;
    if (hostname === "127.0.0.1" || hostname.startsWith("127.")) return true;
    if (hostname.startsWith("10.")) return true;
    if (hostname.startsWith("192.168.")) return true;
    if (hostname.startsWith("172.")) {
      const second = parseInt(hostname.split(".")[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    if (hostname.startsWith("169.254.")) return true;
    if (hostname.startsWith("0.")) return true;
    if (hostname.startsWith("fc") || hostname.startsWith("fd")) return true;
    return false;
  } catch {
    return true;
  }
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return new NextResponse("Rate limited", { status: 429 });
  }

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing url param", { status: 400 });

  let fileUrl: string;
  try {
    fileUrl = decodeURIComponent(raw);
  } catch {
    return new NextResponse("Invalid url param", { status: 400 });
  }

  if (isPrivateUrl(fileUrl)) {
    return new NextResponse("Invalid or forbidden URL", { status: 403 });
  }

  try {
    const upstream = await fetch(fileUrl, { redirect: "follow" });
    if (!upstream.ok) {
      return new NextResponse(`Upstream ${upstream.status}`, { status: 502 });
    }
    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'inline; filename="document.docx"',
        "Content-Length": String(buffer.byteLength),
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache",
      },
    });
  } catch (err) {
    console.error("[onlyoffice-file]", err);
    return new NextResponse("Proxy error", { status: 500 });
  }
}