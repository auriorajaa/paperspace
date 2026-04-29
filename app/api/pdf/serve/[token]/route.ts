// app/api/pdf/serve/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPdf, deletePdf } from "@/lib/pdf-temp-store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const buffer = await getPdf(token);

  if (!buffer) {
    return new NextResponse("File not found or link has expired.", {
      status: 404,
    });
  }

  // FIX: Hapus blob setelah dibaca — blob ini hanya dibutuhkan sekali untuk
  // di-serve ke browser. Tanpa ini, blob tetap ada sampai cleanup 1 jam
  // kemudian. Fire-and-forget: tidak perlu await karena buffer sudah di tangan.
  deletePdf(token).catch((e) =>
    console.warn("[pdf/serve] Failed to delete blob after serving:", e)
  );

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store, no-cache",
    },
  });
}
