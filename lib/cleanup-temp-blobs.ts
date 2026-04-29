// lib/cleanup-temp-blobs.ts
import { list, del } from "@vercel/blob";

export async function cleanupTempBlobs() {
  try {
    // Fetch both prefixes in parallel
    const [convResult, pdfResult] = await Promise.all([
      list({ prefix: "temp-conv" }),
      list({ prefix: "temp-pdf" }),
    ]);

    const allBlobs = [...convResult.blobs, ...pdfResult.blobs];
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const old = allBlobs.filter(
      (b) => new Date(b.uploadedAt).getTime() < oneHourAgo
    );

    if (old.length > 0) {
      await Promise.all(old.map((b) => del(b.url)));
      console.log(`[cleanup] Deleted ${old.length} temp blobs`);
    }
  } catch (e) {
    console.warn("[cleanup] Failed:", e);
  }
}
