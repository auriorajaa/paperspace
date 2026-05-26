// app/api/generate-summary/route.ts
//
// Environment variables required:
//   SUMMARIZER_API_URL             — base URL of the Python API (no trailing slash)
//   NEXT_PUBLIC_CONVEX_SITE_URL    — your Convex HTTP URL
//   SUMMARIZER_CALLBACK_SECRET     — shared secret between Next.js and Convex

import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Timeout untuk initial POST ke Python API (hanya queue job, bukan proses NER)
const QUEUE_TIMEOUT_MS = 15_000;

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).slice(2, 8); // ID pendek untuk tracking log
  // console.log(`[generate-summary][${requestId}] Request masuk`);

  // ── Parse & validate request body ─────────────────────────────────────────
  let body: {
    documentId?: string;
    fileUrl?: string;
    filename?: string;
  };

  try {
    body = await request.json();
    // console.log(`[generate-summary][${requestId}] Body parsed:`, {
    //   documentId: body.documentId,
    //   filename: body.filename,
    //   fileUrl: body.fileUrl?.slice(0, 60) + "...",
    // });
  } catch {
    // console.error(`[generate-summary][${requestId}] Gagal parse JSON body`);
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { documentId, fileUrl, filename } = body;

  if (!documentId || typeof documentId !== "string") {
    // console.error(
    //   `[generate-summary][${requestId}] documentId tidak valid:`,
    //   documentId
    // );
    return NextResponse.json(
      { error: "Missing or invalid documentId." },
      { status: 400 }
    );
  }

  if (!fileUrl || typeof fileUrl !== "string") {
    // console.error(
    //   `[generate-summary][${requestId}] fileUrl tidak valid:`,
    //   fileUrl
    // );
    return NextResponse.json(
      { error: "Missing or invalid fileUrl." },
      { status: 400 }
    );
  }

  // ── Read env vars ──────────────────────────────────────────────────────────
  const summarizerApiUrl = process.env.SUMMARIZER_API_URL;
  if (!summarizerApiUrl) {
    // console.error(
    //   `[generate-summary][${requestId}] SUMMARIZER_API_URL tidak di-set`
    // );
    return NextResponse.json(
      { error: "Summarizer service is not configured." },
      { status: 503 }
    );
  }

  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    // console.error(
    //   `[generate-summary][${requestId}] NEXT_PUBLIC_CONVEX_SITE_URL tidak di-set`
    // );
    return NextResponse.json(
      { error: "Convex site URL is not configured." },
      { status: 503 }
    );
  }

  const callbackSecret = process.env.SUMMARIZER_CALLBACK_SECRET;
  if (!callbackSecret) {
    // console.error(
    //   `[generate-summary][${requestId}] SUMMARIZER_CALLBACK_SECRET tidak di-set`
    // );
    return NextResponse.json(
      { error: "Callback secret is not configured." },
      { status: 503 }
    );
  }

  // ── Build callback URL ─────────────────────────────────────────────────────
  const callbackUrl =
    `${convexSiteUrl}/callback-summarizer` +
    `?docId=${encodeURIComponent(documentId)}` +
    `&secret=${encodeURIComponent(callbackSecret)}`;

  // Log URL yang akan dipanggil (tanpa secret)
  const targetUrl = `${summarizerApiUrl}/api/v1/summarize/async`;
  // console.log(
  //   `[generate-summary][${requestId}] Memanggil Python API: ${targetUrl}`
  // );
  // console.log(
  //   `[generate-summary][${requestId}] Timeout: ${QUEUE_TIMEOUT_MS}ms`
  // );

  // ── Call the Python async endpoint ────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    // console.error(
    //   `[generate-summary][${requestId}] AbortController triggered setelah ${QUEUE_TIMEOUT_MS}ms`
    // );
    controller.abort();
  }, QUEUE_TIMEOUT_MS);

  const fetchStart = Date.now();

  try {
    const requestBody = {
      file_url: fileUrl,
      callback_url: callbackUrl,
      filename: filename ?? `${documentId}.docx`,
      include_raw_entities: false,
    };
    // console.log(`[generate-summary][${requestId}] Request body ke Python:`, {
    //   ...requestBody,
    //   callback_url: requestBody.callback_url.replace(
    //     callbackSecret,
    //     "[SECRET]"
    //   ),
    // });

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - fetchStart;
    // console.log(
    //   `[generate-summary][${requestId}] Python API respond dalam ${elapsed}ms, status: ${res.status} ${res.statusText}`
    // );

    if (!res.ok) {
      // ── Baca raw body dulu baru parse JSON ──────────────────────────────────
      let rawBody = "";
      let detail = "";
      try {
        rawBody = await res.text();
        // console.error(
        //   `[generate-summary][${requestId}] Raw error body dari Python:`,
        //   rawBody
        // );
        const errBody = JSON.parse(rawBody);
        detail = errBody?.detail ?? errBody?.error ?? rawBody;
      } catch {
        detail = rawBody || "(tidak ada body)";
      }

      // console.error(
      //   `[generate-summary][${requestId}] Python API error ${res.status}: ${detail}`
      // );
      return NextResponse.json(
        { error: `Summarizer API error (${res.status}): ${detail}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    // console.log(
    //   `[generate-summary][${requestId}] Job berhasil di-queue: job_id=${data.job_id}, documentId=${documentId}`
    // );

    return NextResponse.json({
      ok: true,
      jobId: data.job_id,
      message: "Summary job queued. The result will appear automatically.",
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - fetchStart;

    if (err?.name === "AbortError") {
      // console.error(
      //   `[generate-summary][${requestId}] Timeout setelah ${elapsed}ms — Python API tidak merespons`
      // );
      return NextResponse.json(
        {
          error:
            "The summarizer service did not respond in time. Please try again.",
        },
        { status: 504 }
      );
    }

    // Network error (ECONNREFUSED, ENOTFOUND, dll)
    // console.error(
    //   `[generate-summary][${requestId}] Unexpected error setelah ${elapsed}ms:`,
    //   {
    //     name: err?.name,
    //     message: err?.message,
    //     cause: err?.cause,
    //     code: err?.cause?.code,
    //   }
    // );
    return NextResponse.json(
      { error: `Failed to reach the summarizer service: ${err?.message}` },
      { status: 502 }
    );
  }
}
