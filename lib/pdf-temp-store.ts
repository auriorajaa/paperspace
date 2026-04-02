/**
 * In-memory temporary store for PDF blobs that need to be served to OnlyOffice.
 * Files are auto-expired after TTL_MS. This is safe for single-process deployments
 * (local dev via ngrok). For multi-instance production, swap for Redis or S3.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface TempEntry {
  buffer: Buffer;
  expires: number;
}

// Module-level singleton — shared across all requests in the same process
const store = new Map<string, TempEntry>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expires) store.delete(key);
  }
}

export function storePdf(token: string, buffer: Buffer): void {
  evictExpired();
  store.set(token, { buffer, expires: Date.now() + TTL_MS });
}

export function getPdf(token: string): Buffer | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(token);
    return null;
  }
  return entry.buffer;
}

export function deletePdf(token: string): void {
  store.delete(token);
}
