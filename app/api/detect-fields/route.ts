// app/api/detect-fields/route.ts
/**
 * Server-side field detection using Gemini AI.
 *
 * Kenapa perlu API Route ini:
 *   autoDetectFields() memanggil Gemini via process.env.GEMINI_API_KEY.
 *   Env var tersebut hanya tersedia di server (Node.js), TIDAK di browser.
 *   Kalau dipanggil langsung dari "use client" component, GEMINI_API_KEY
 *   selalu undefined → selalu fallback ke L3+L5 rule-based detection.
 *
 * Flow:
 *   Client (template-new-client.tsx) → POST /api/detect-fields (FormData: file)
 *   → autoDetectFields() di server (punya akses GEMINI_API_KEY)
 *   → return JSON { fields: AutoDetectedField[] }
 *
 * Auth: Clerk session (user harus login)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { autoDetectFields } from "@/lib/auto-field-detector";

export const runtime = "nodejs";

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid file" },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_MB} MB.` },
        { status: 413 }
      );
    }

    // Validate type — hanya terima DOCX
    const isDocx =
      file.type === DOCX_MIME ||
      file.type === "application/octet-stream" ||
      file.name.toLowerCase().endsWith(".docx");

    if (!isDocx) {
      return NextResponse.json(
        { error: "Only DOCX files are accepted for field detection." },
        { status: 415 }
      );
    }

    // Jalankan autoDetectFields di server (Gemini API key tersedia di sini)
    const buffer = await file.arrayBuffer();
    const fields = await autoDetectFields(buffer);

    return NextResponse.json({ fields });
  } catch (err: unknown) {
    console.error("[detect-fields] Unexpected error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Field detection failed.",
      },
      { status: 500 }
    );
  }
}
