// app\api\onlyoffice-convert\route.ts
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
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

function isAllowedFileUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const allowed = (process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "").replace(
      /\/$/,
      ""
    );
    if (allowed && !urlStr.startsWith(allowed)) return false;
    return true;
  } catch {
    return false;
  }
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return new NextResponse("Rate limited", { status: 429 });
  }

  try {
    const body = await req.json();
    const { fileUrl, fileName } = body;

    if (
      !fileUrl ||
      !fileName ||
      typeof fileUrl !== "string" ||
      typeof fileName !== "string"
    ) {
      return new NextResponse("Missing fileUrl or fileName", { status: 400 });
    }

    if (fileName.length > 200) {
      return new NextResponse("fileName too long", { status: 400 });
    }

    if (!isAllowedFileUrl(fileUrl)) {
      return new NextResponse("Invalid fileUrl", { status: 403 });
    }

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`
    ).replace(/\/$/, "");
    // const proxiedUrl = `${appUrl}/api/onlyoffice-file?url=${encodeURIComponent(fileUrl)}`;

    const ooServerUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL;
    if (!ooServerUrl) {
      console.error("[onlyoffice-convert] ONLYOFFICE_SERVER_URL not set");
      return new NextResponse("Server configuration error", { status: 500 });
    }

    const convertUrl = `${ooServerUrl.replace(/\/$/, "")}/ConvertService.ashx`;
    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
    const uniqueKey = `convert-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const payload = {
      async: false,
      filetype: "docx",
      outputtype: "pdf",
      key: uniqueKey,
      url: fileUrl,
    };

    const requestBody: any = { ...payload };
    if (jwtSecret) {
      requestBody.token = jwt.sign(payload, jwtSecret, { algorithm: "HS256" });
    }

    const convertRes = await fetch(convertUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const contentType = convertRes.headers.get("content-type") || "";
    let responseText = await convertRes.text();

    if (!convertRes.ok) {
      console.error(
        "[onlyoffice-convert] conversion failed with status",
        convertRes.status
      );
      return new NextResponse(
        `Conversion failed: ${convertRes.status} - ${responseText.slice(0, 200)}`,
        { status: convertRes.status }
      );
    }

    let pdfUrl: string | null = null;

    if (contentType.includes("xml")) {
      const match = responseText.match(/<FileUrl>(.*?)<\/FileUrl>/i);
      if (match && match[1]) {
        pdfUrl = match[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      } else {
        const errorMatch =
          responseText.match(/<Message>(.*?)<\/Message>/i) ||
          responseText.match(/<Error>(.*?)<\/Error>/i);
        const errorMsg = errorMatch
          ? errorMatch[1]
          : "Unknown conversion error (XML response)";
        console.error("[onlyoffice-convert] XML error:", errorMsg);
        return new NextResponse(errorMsg, { status: 500 });
      }
    } else {
      try {
        const convertData = JSON.parse(responseText);
        pdfUrl = convertData.fileUrl || convertData.url;
      } catch (e) {
        console.error(
          "[onlyoffice-convert] failed to parse response:",
          responseText
        );
        return new NextResponse("Conversion service returned invalid format", {
          status: 500,
        });
      }
    }

    if (!pdfUrl) {
      console.error("[onlyoffice-convert] no PDF URL found in response");
      return new NextResponse("Conversion response missing PDF URL", {
        status: 500,
      });
    }

    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) {
      console.error("[onlyoffice-convert] PDF download failed:", pdfRes.status);
      return new NextResponse("Failed to download converted PDF", {
        status: 500,
      });
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const safeName = fileName
      .replace(/\.docx$/i, "")
      .replace(/[<>:"/\\|?*]/g, "_");

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Content-Length": String(pdfBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error("[onlyoffice-convert] error:", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}