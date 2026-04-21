// lib/pdf-temp-store.ts
/**
 * Temporary PDF store backed by Vercel Blob.
 *
 * Replaces the previous in-memory Map which was only safe for single-process
 * (local dev) deployments. Vercel serverless runs across many instances, so
 * an in-memory store would silently return null ~99% of the time in production.
 *
 * Blob keys: "temp-pdf-{token}.pdf"
 * Cleanup: handled by cleanupTempBlobs() which runs on every pdf-to-docx call.
 *          Add "temp-pdf-" to its prefix list to cover these files too.
 */

import { put, del, list } from "@vercel/blob";

const BLOB_PREFIX = "temp-pdf";

/**
 * Upload a PDF buffer to Vercel Blob under a token-based key.
 * addRandomSuffix: false → deterministic URL, findable by token later.
 */
export async function storePdf(token: string, buffer: Buffer): Promise<void> {
  await put(`${BLOB_PREFIX}-${token}.pdf`, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/pdf",
  });
}

/**
 * Fetch the PDF buffer for a given token from Vercel Blob.
 * Returns null if not found (expired or never stored).
 */
export async function getPdf(token: string): Promise<Buffer | null> {
  try {
    // List blobs matching the token prefix to find the URL
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}-${token}` });
    if (blobs.length === 0) return null;

    const res = await fetch(blobs[0].url);
    if (!res.ok) return null;

    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn("[pdf-temp-store] getPdf failed:", err);
    return null;
  }
}

/**
 * Delete a stored PDF by token.
 */
export async function deletePdf(token: string): Promise<void> {
  try {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}-${token}` });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
  } catch (err) {
    console.warn("[pdf-temp-store] deletePdf failed:", err);
  }
}
