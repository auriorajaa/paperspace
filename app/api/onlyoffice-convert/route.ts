// app\api\onlyoffice-convert\route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  try {
    const { fileUrl, fileName } = await req.json();
    if (!fileUrl || !fileName) {
      return new NextResponse("Missing fileUrl or fileName", { status: 400 });
    }

    // Use proxied URL so OnlyOffice can access the file
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const proxiedUrl = `${appUrl.replace(/\/$/, "")}/api/onlyoffice-file?url=${encodeURIComponent(fileUrl)}`;

    const ooServerUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_SERVER_URL;
    if (!ooServerUrl) {
      console.error("[onlyoffice-convert] ONLYOFFICE_SERVER_URL not set");
      return new NextResponse("Server configuration error", { status: 500 });
    }

    const convertUrl = `${ooServerUrl.replace(/\/$/, "")}/ConvertService.ashx`;

    const jwtSecret = process.env.ONLYOFFICE_JWT_SECRET;

    // Generate a unique key per conversion to prevent OnlyOffice from
    // returning a cached result from a previous (or concurrent) conversion.
    // Without this, parallel conversions may all resolve to the same cached PDF.
    const uniqueKey = `convert-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const payload = {
      async: false,
      filetype: "docx",
      outputtype: "pdf",
      key: uniqueKey,
      url: proxiedUrl,
    };

    const requestBody: any = { ...payload };
    if (jwtSecret) {
      requestBody.token = jwt.sign(payload, jwtSecret, { algorithm: "HS256" });
    }

    console.log("[onlyoffice-convert] sending to:", convertUrl);
    console.log("[onlyoffice-convert] proxiedUrl:", proxiedUrl);
    console.log("[onlyoffice-convert] key:", uniqueKey);

    const convertRes = await fetch(convertUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    console.log("[onlyoffice-convert] response status:", convertRes.status);
    const contentType = convertRes.headers.get("content-type") || "";
    let responseText = await convertRes.text();

    console.log(
      "[onlyoffice-convert] response preview:",
      responseText.slice(0, 500)
    );

    if (!convertRes.ok) {
      console.error(
        "[onlyoffice-convert] conversion failed with status",
        convertRes.status
      );
      return new NextResponse(
        `Conversion failed: ${convertRes.status} - ${responseText.slice(0, 200)}`,
        {
          status: convertRes.status,
        }
      );
    }

    let pdfUrl: string | null = null;

    // Parse XML response (OnlyOffice returns XML for conversion)
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
        // Try to extract error message
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
      // Fallback: try JSON
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

    // Fetch the resulting PDF
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) {
      console.error("[onlyoffice-convert] PDF download failed:", pdfRes.status);
      return new NextResponse("Failed to download converted PDF", {
        status: 500,
      });
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const safeName = fileName.replace(/\.docx$/i, "");

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
