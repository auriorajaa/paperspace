// lib/cleanup-temp-blobs.ts
import { list, del } from "@vercel/blob";

export async function cleanupTempBlobs() {
  try {
    const { blobs } = await list({ prefix: "temp-conv" });
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const old = blobs.filter(
      (b) => new Date(b.uploadedAt).getTime() < oneHourAgo
    );
    await Promise.all(old.map((b) => del(b.url)));
    if (old.length > 0)
      console.log(`[cleanup] Deleted ${old.length} temp blobs`);
  } catch (e) {
    console.warn("[cleanup] Failed:", e);
  }
}
