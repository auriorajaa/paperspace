// app/api/detect-fields/route.ts
/**
 * Server-side field extraction via the remote document analysis service.
 *
 * The extraction service key is only available in the server environment
 * (Node.js process). This route proxies document analysis requests from
 * the browser so the key is never exposed to the client.
 *
 * [DEV NOTE — INTERNAL]
 * Internally delegates to lib/document-field-analyzer.ts, which calls
 * AI and falls back to offline rule-based detection when
 * the remote service is unavailable (see that module for details).
 *
 * Flow:
 *   Client (template-new-client.tsx)
 *     → POST /api/detect-fields   (FormData: file)
 *     → analyzeDocumentFields()   (server — key available here)
 *     → { fields: AutoDetectedField[] }
 *
 * Auth: Clerk session (user must be signed in)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { analyzeDocumentFields } from "@/lib/document-field-analyzer";

export const runtime = "nodejs";

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
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

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_MB} MB.` },
        { status: 413 }
      );
    }

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

    const buffer = await file.arrayBuffer();
    const fields = await analyzeDocumentFields(buffer);

    return NextResponse.json({ fields });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Field detection failed.",
      },
      { status: 500 }
    );
  }
}
