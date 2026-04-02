import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const pagesStr = formData.get("pages") as string | null;

    if (!file) {
      return new NextResponse("Please upload a PDF file.", { status: 400 });
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
        {
          status: 422,
        }
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
