// app/api/docx-save/route.ts
/**
 * API route untuk menyimpan DOCX yang diedit dari WYSIWYG editor
 * di halaman review (/templates/[id]/review).
 *
 * Flow:
 *   1. Client kirim DOCX buffer + templateId (opsional)
 *   2. Server upload ke Convex storage
 *   3. Server return { storageId, fileUrl }
 *   4. Client update template record via Convex mutation
 *
 * Auth: Clerk session (user harus login)
 * Rate limit: 30 req/min per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// ── Rate limiter (in-memory, per IP) ─────────────────────────────────────────

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

// ── Convex upload helper ─────────────────────────────────────────────────────

async function uploadFileToConvex(fileBuffer: ArrayBuffer): Promise<string> {
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (!convexSiteUrl || !internalSecret) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_SITE_URL or INTERNAL_API_SECRET is not set"
    );
  }

  const uploadUrlEndpoint = `${convexSiteUrl.replace(/\/$/, "")}/getUploadUrl`;

  const uploadUrlRes = await fetch(uploadUrlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({}),
  });

  if (!uploadUrlRes.ok) {
    const text = await uploadUrlRes.text();
    throw new Error(
      `Could not get upload URL: ${uploadUrlRes.status} - ${text}`
    );
  }

  const { uploadUrl } = await uploadUrlRes.json();
  if (!uploadUrl || typeof uploadUrl !== "string") {
    throw new Error("Invalid upload URL response from Convex");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`File upload failed: ${uploadRes.status} - ${text}`);
  }

  const { storageId } = await uploadRes.json();
  if (!storageId) throw new Error("No storageId returned from upload");

  return storageId;
}

// ── Route handlers ───────────────────────────────────────────────────────────

/**
 * POST /api/docx-save
 * Body: { buffer: ArrayBuffer, templateId?: string }
 * Response: { storageId: string, fileUrl: string }
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

  try {
    // Parse multipart form data (buffer bisa besar, jangan pakai JSON)
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const templateId = formData.get("templateId") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid file" },
        { status: 400 }
      );
    }

    // Validate file type
    if (
      file.type !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      file.type !== "application/octet-stream"
    ) {
      return NextResponse.json(
        { error: "Invalid file type. Only DOCX is allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Max 10MB." },
        { status: 400 }
      );
    }

    const fileBuffer = await file.arrayBuffer();

    // Upload to Convex storage
    const storageId = await uploadFileToConvex(fileBuffer);
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const fileUrl = `${convexSiteUrl}/getFile?storageId=${storageId}`;

    console.log("[docx-save] Saved DOCX:", {
      storageId,
      size: fileBuffer.byteLength,
      templateId: templateId ?? "none",
      userId,
    });

    return NextResponse.json({
      storageId,
      fileUrl,
      size: fileBuffer.byteLength,
    });
  } catch (err: any) {
    console.error("[docx-save] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save document" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/docx-save
 * CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL ?? "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
