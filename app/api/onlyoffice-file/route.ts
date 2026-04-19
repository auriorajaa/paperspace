// app\api\onlyoffice-file\route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing url param", { status: 400 });

  let fileUrl: string;
  try {
    fileUrl = decodeURIComponent(raw);
  } catch {
    return new NextResponse("Invalid url param", { status: 400 });
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
