// app/api/convert/pdf-to-docx/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

const CONVERT_TIMEOUT_MS = 60_000;

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
  try {
    // ── Terima pdfUrl dari body (bukan file upload) ──────────────────────────
    const body = await req.json();
    const pdfUrl: string | undefined = body.pdfUrl;

    if (!pdfUrl) {
      return new NextResponse("Missing pdfUrl.", { status: 400 });
    }

    // console.log("[pdf-to-docx] PDF URL yang dikirim ke OnlyOffice:", pdfUrl);

    // ── OnlyOffice conversion ────────────────────────────────────────────────
    const ooServerUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL;
    if (!ooServerUrl) {
      console.error("[pdf-to-docx] ONLYOFFICE_SERVER_URL not set");
      return new NextResponse(
        "Server configuration error. Please contact support.",
        { status: 500 }
      );
    }

    const convertUrl = `${ooServerUrl.replace(/\/$/, "")}/ConvertService.ashx`;
    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;

    const payload = {
      async: false,
      filetype: "pdf",
      outputtype: "docx",
      url: pdfUrl,
    };

    const requestBody: Record<string, unknown> = { ...payload };
    if (jwtSecret) {
      requestBody.token = jwt.sign(payload, jwtSecret, { algorithm: "HS256" });
    }

    // console.log("[pdf-to-docx] converting via:", convertUrl);

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
        return new NextResponse(
          "The conversion took too long. Please try with a smaller PDF.",
          { status: 504 }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const contentType = convertRes.headers.get("content-type") ?? "";
    const responseText = await convertRes.text();

    if (!convertRes.ok) {
      console.error(
        "[pdf-to-docx] conversion failed:",
        convertRes.status,
        responseText.slice(0, 300)
      );
      return new NextResponse(
        "We couldn't convert your PDF. Please try another file.",
        { status: 500 }
      );
    }

    // ── Parse URL hasil konversi ─────────────────────────────────────────────
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
        const msg = errMatch
          ? decodeXmlEntities(errMatch[1])
          : "Unknown conversion error";
        console.error("[pdf-to-docx] XML error:", msg);
        return new NextResponse(
          `Conversion service error: ${msg}. Please check your PDF and try again.`,
          { status: 500 }
        );
      }
    } else {
      try {
        const data = JSON.parse(responseText);
        docxUrl = data.fileUrl ?? data.url ?? null;
      } catch {
        console.error(
          "[pdf-to-docx] unparseable response:",
          responseText.slice(0, 200)
        );
        return new NextResponse(
          "The conversion service returned an unexpected response. Please try again.",
          { status: 500 }
        );
      }
    }

    if (!docxUrl) {
      console.error("[pdf-to-docx] no DOCX URL in response");
      return new NextResponse(
        "Something went wrong while preparing your document. Please try again.",
        { status: 500 }
      );
    }

    // ── Download DOCX hasil konversi ─────────────────────────────────────────
    const docxRes = await fetch(docxUrl);
    if (!docxRes.ok) {
      console.error("[pdf-to-docx] failed to download DOCX:", docxRes.status);
      return new NextResponse(
        "We couldn't download the converted document. Please try again.",
        { status: 500 }
      );
    }

    const docxBuffer = Buffer.from(await docxRes.arrayBuffer());

    if (!isValidDocx(docxBuffer)) {
      const sample = docxBuffer.slice(0, 200).toString();
      console.error(
        "[pdf-to-docx] Downloaded file is not a valid DOCX. First 200 chars:",
        sample
      );
      if (
        sample.toLowerCase().includes("<html") ||
        sample.toLowerCase().includes("error")
      ) {
        return new NextResponse(
          "The conversion service returned an error page instead of a document. Please verify your OnlyOffice server configuration and that the PDF URL is publicly accessible.",
          { status: 500 }
        );
      }
      return new NextResponse(
        "The converted file appears to be corrupted. Please try again with a different PDF.",
        { status: 500 }
      );
    }

    // console.log(
    //   "[pdf-to-docx] Conversion successful, DOCX size:",
    //   docxBuffer.length
    // );

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
    console.error("[pdf-to-docx] unexpected error:", err);
    return new NextResponse(
      "Something went wrong while preparing your document. Please try again.",
      { status: 500 }
    );
  }
}
