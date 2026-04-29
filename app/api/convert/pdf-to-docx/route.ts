// app/api/convert/pdf-to-docx/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { put, del } from "@vercel/blob";
import { cleanupTempBlobs } from "@/lib/cleanup-temp-blobs";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const CONVERT_TIMEOUT_MS = 60_000;
const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isValidDocx(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // Allow trusted server-to-server calls via the internal secret (e.g. the
  // ONLYOFFICE callback path). Otherwise require a signed-in Clerk user.
  const internalSecret = req.headers.get("x-internal-secret");
  const hasInternalAuth =
    internalSecret && internalSecret === process.env.INTERNAL_SECRET;

  if (!hasInternalAuth) {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  // Await cleanup so stale blobs are removed before we add new ones.
  // Fire-and-forget is intentionally avoided here — a failed cleanup would
  // silently accumulate blobs, so we at least log any error via the helper.
  await cleanupTempBlobs();

  let blobUrl: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new NextResponse("Missing PDF file.", { status: 400 });
    }

    // FIX: server-side size check before uploading to Vercel Blob
    // (saves bandwidth + blob storage cost for files that should be rejected)
    if (file.size > MAX_FILE_BYTES) {
      return new NextResponse(
        `File too large. Maximum size is ${MAX_FILE_MB} MB.`,
        { status: 413 }
      );
    }

    // FIX: content-type / extension check
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return new NextResponse("Only PDF files are accepted.", { status: 415 });
    }

    // ── Upload to Vercel Blob ─────────────────────────────────────────────────
    const blob = await put(`temp-conversion-${Date.now()}.pdf`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/pdf",
    });
    blobUrl = blob.url;

    // ── OnlyOffice conversion ─────────────────────────────────────────────────
    const ooServerUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL;
    if (!ooServerUrl) {
      console.error("[pdf-to-docx] ONLYOFFICE_SERVER_URL not set");
      return new NextResponse("Server configuration error.", { status: 500 });
    }

    const convertUrl = `${ooServerUrl.replace(/\/$/, "")}/ConvertService.ashx`;

    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;

    const payload = {
      async: false,
      filetype: "pdf",
      outputtype: "docx",
      url: blobUrl,
      key: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    const requestBody: Record<string, unknown> = { ...payload };
    if (jwtSecret) {
      requestBody.token = jwt.sign(payload, jwtSecret, { algorithm: "HS256" });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONVERT_TIMEOUT_MS);

    let convertRes: Response;
    try {
      convertRes = await fetch(convertUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        return new NextResponse("The conversion took too long.", {
          status: 504,
        });
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const contentType = convertRes.headers.get("content-type") ?? "";
    const responseText = await convertRes.text();

    if (!convertRes.ok) {
      return new NextResponse("We couldn't convert your PDF.", { status: 500 });
    }

    // ── Parse conversion result URL ───────────────────────────────────────────
    let docxUrl: string | null = null;

    if (
      contentType.includes("xml") ||
      responseText.trimStart().startsWith("<")
    ) {
      const urlMatch = responseText.match(/<FileUrl>(.*?)<\/FileUrl>/i);
      if (urlMatch?.[1]) {
        docxUrl = decodeXmlEntities(urlMatch[1]);
      } else {
        const errMatch =
          responseText.match(/<Message>(.*?)<\/Message>/i) ||
          responseText.match(/<Error>(.*?)<\/Error>/i);
        const msg = errMatch ? decodeXmlEntities(errMatch[1]) : "Unknown";
        console.error("[pdf-to-docx] XML error from OnlyOffice:", msg);
        return new NextResponse(`Conversion error: ${msg}`, { status: 500 });
      }
    } else {
      try {
        const data = JSON.parse(responseText);
        docxUrl = data.fileUrl ?? data.url ?? null;
      } catch {
        console.error(
          "[pdf-to-docx] Unparseable response:",
          responseText.slice(0, 500)
        );
        return new NextResponse(
          "Unexpected response from conversion service.",
          { status: 500 }
        );
      }
    }

    if (!docxUrl) {
      console.error(
        "[pdf-to-docx] No DOCX URL in response. Full response:",
        responseText
      );
      return new NextResponse("No output URL returned.", { status: 500 });
    }

    // ── Download DOCX ─────────────────────────────────────────────────────────
    const docxRes = await fetch(docxUrl);
    if (!docxRes.ok) {
      return new NextResponse("Couldn't download converted document.", {
        status: 500,
      });
    }

    const docxBuffer = Buffer.from(await docxRes.arrayBuffer());

    if (!isValidDocx(docxBuffer)) {
      const sample = docxBuffer.slice(0, 300).toString();
      console.error("[pdf-to-docx] Invalid DOCX. First 300 chars:", sample);
      return new NextResponse("Converted file is not a valid DOCX.", {
        status: 500,
      });
    }

    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="converted.docx"',
        "Content-Length": String(docxBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error("[pdf-to-docx] Unexpected error:", err);
    return new NextResponse("Something went wrong.", { status: 500 });
  } finally {
    if (blobUrl) {
      try {
        await del(blobUrl);
      } catch (e) {
        console.warn("[pdf-to-docx] Failed to delete temp blob:", e);
      }
    }
  }
}
