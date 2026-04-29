// app/api/pdf/split/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // Allow calls from trusted server-to-server flows (e.g. ONLYOFFICE callback)
  // that present the internal secret. Otherwise require a signed-in Clerk user.
  const internalSecret = req.headers.get("x-internal-secret");
  const hasInternalAuth =
    internalSecret && internalSecret === process.env.INTERNAL_SECRET;

  if (!hasInternalAuth) {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const pagesStr = formData.get("pages") as string | null;

    if (!file) {
      return new NextResponse("Please upload a PDF file.", { status: 400 });
    }

    // FIX: server-side size validation — client validates too but server must
    // be independent (direct API calls, curl, etc. bypass the UI)
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

    if (!pagesStr) {
      return new NextResponse("Please select at least one page.", {
        status: 400,
      });
    }

    let selectedPages: number[];
    try {
      selectedPages = JSON.parse(pagesStr);
    } catch {
      return new NextResponse("Invalid page selection. Please try again.", {
        status: 400,
      });
    }

    if (!Array.isArray(selectedPages) || selectedPages.length === 0) {
      return new NextResponse("Please select at least one page.", {
        status: 400,
      });
    }

    const buffer = await file.arrayBuffer();

    let srcPdf: PDFDocument;
    try {
      srcPdf = await PDFDocument.load(buffer);
    } catch {
      return new NextResponse(
        "We couldn't open your PDF. The file may be corrupted or password-protected.",
        { status: 422 }
      );
    }

    const totalPages = srcPdf.getPageCount();
    if (totalPages === 0) {
      return new NextResponse(
        "This PDF appears to be empty. Please try another file.",
        { status: 422 }
      );
    }

    // Clamp and deduplicate page numbers (1-indexed → 0-indexed for pdf-lib)
    const validPageIndices = [
      ...new Set(
        selectedPages
          .filter((p) => Number.isInteger(p) && p >= 1 && p <= totalPages)
          .map((p) => p - 1)
      ),
    ].sort((a, b) => a - b);

    if (validPageIndices.length === 0) {
      return new NextResponse(
        "None of the selected pages are valid. Please select pages within the document range.",
        { status: 400 }
      );
    }

    const newPdf = await PDFDocument.create();
    const copied = await newPdf.copyPages(srcPdf, validPageIndices);
    copied.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    return new NextResponse(pdfBytes as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="selected-pages.pdf"',
        "Content-Length": String(pdfBytes.byteLength),
      },
    });
  } catch (err) {
    console.error("[api/pdf/split]", err);
    return new NextResponse(
      "We couldn't process your PDF. Please try another file.",
      { status: 500 }
    );
  }
}
