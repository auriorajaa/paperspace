import { NextRequest, NextResponse } from "next/server";
import { getPdf } from "@/lib/pdf-temp-store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const buffer = getPdf(params.token);

  if (!buffer) {
    return new NextResponse("File not found or link has expired.", {
      status: 404,
    });
  }

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store, no-cache",
    },
  });
}
