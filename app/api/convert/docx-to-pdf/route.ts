// app/api/convert/docx-to-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put, del } from "@vercel/blob";
import jwt from "jsonwebtoken";
import { cleanupTempBlobs } from "@/lib/cleanup-temp-blobs";

export const runtime = "nodejs";

const CONVERT_TIMEOUT_MS = 60_000;
const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isValidPdf(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.slice(0, 4).toString() === "%PDF";
}

async function extractConvertedFileUrl(
  convertRes: Response
): Promise<string | null> {
  const contentType = convertRes.headers.get("content-type") ?? "";
  const responseText = await convertRes.text();

  if (!convertRes.ok) {
    console.error("[docx-to-pdf] ConvertService error:", responseText);
    return null;
  }

  if (contentType.includes("xml") || responseText.trimStart().startsWith("<")) {
    const urlMatch = responseText.match(/<FileUrl>(.*?)<\/FileUrl>/i);
    if (urlMatch?.[1]) return decodeXmlEntities(urlMatch[1]);

    const errMatch =
      responseText.match(/<Message>(.*?)<\/Message>/i) ||
      responseText.match(/<Error>(.*?)<\/Error>/i);
    console.error(
      "[docx-to-pdf] XML error:",
      errMatch ? decodeXmlEntities(errMatch[1]) : responseText.slice(0, 500)
    );
    return null;
  }

  try {
    const data = JSON.parse(responseText) as {
      fileUrl?: string;
      url?: string;
    };
    return data.fileUrl ?? data.url ?? null;
  } catch {
    console.error(
      "[docx-to-pdf] Unparseable response:",
      responseText.slice(0, 500)
    );
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await cleanupTempBlobs();

  let blobUrl: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing DOCX file." }, { status: 400 });
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
        { error: "Only DOCX files are accepted." },
        { status: 415 }
      );
    }

    const ooServerUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL;
    if (!ooServerUrl) {
      console.error("[docx-to-pdf] ONLYOFFICE_SERVER_URL not set");
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const blob = await put(`temp-preview-${Date.now()}.docx`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: DOCX_MIME,
    });
    blobUrl = blob.url;

    const payload = {
      async: false,
      filetype: "docx",
      outputtype: "pdf",
      url: blobUrl,
      key: `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    const requestBody: Record<string, unknown> = { ...payload };
    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
    if (jwtSecret) {
      requestBody.token = jwt.sign(payload, jwtSecret, { algorithm: "HS256" });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONVERT_TIMEOUT_MS);

    let convertRes: Response;
    try {
      convertRes = await fetch(
        `${ooServerUrl.replace(/\/$/, "")}/ConvertService.ashx`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        return NextResponse.json(
          { error: "The preview conversion took too long." },
          { status: 504 }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const pdfUrl = await extractConvertedFileUrl(convertRes);
    if (!pdfUrl) {
      return NextResponse.json(
        { error: "Could not convert DOCX preview." },
        { status: 500 }
      );
    }

    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: "Could not download converted preview." },
        { status: 500 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    if (!isValidPdf(pdfBuffer)) {
      return NextResponse.json(
        { error: "Converted preview is not a valid PDF." },
        { status: 500 }
      );
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[docx-to-pdf] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  } finally {
    if (blobUrl) {
      try {
        await del(blobUrl);
      } catch (err) {
        console.warn("[docx-to-pdf] Failed to delete temp blob:", err);
      }
    }
  }
}
