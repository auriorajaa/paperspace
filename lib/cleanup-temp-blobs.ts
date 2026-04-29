// lib/cleanup-temp-blobs.ts
import { list, del } from "@vercel/blob";

// FIX: Added cursor pagination.
// list() tanpa cursor hanya ambil 1000 blob pertama — jika ada lebih dari itu
// (karena cleanup lama tidak jalan / traffic tinggi), sisanya tidak pernah
// dibersihkan dan terus menumpuk.
async function listAllBlobs(prefix: string) {
  const blobs = [];
  let cursor: string | undefined;

  do {
    const result = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return blobs;
}

export async function cleanupTempBlobs() {
  try {
    const [convBlobs, pdfBlobs] = await Promise.all([
      listAllBlobs("temp-conv"),
      listAllBlobs("temp-pdf"),
    ]);

    const allBlobs = [...convBlobs, ...pdfBlobs];
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const old = allBlobs.filter(
      (b) => new Date(b.uploadedAt).getTime() < oneHourAgo
    );

    if (old.length > 0) {
      // del() accepts an array — satu call untuk semua, lebih efisien
      await del(old.map((b) => b.url));
      console.log(`[cleanup] Deleted ${old.length} temp blobs`);
    }
  } catch (e) {
    console.warn("[cleanup] Failed:", e);
  }
}
