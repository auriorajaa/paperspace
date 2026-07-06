// app/api/validate-tik-document/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  scoreHeader,
  getRelevantExcerpt,
  AUTO_ACCEPT_THRESHOLD,
  AUTO_REJECT_THRESHOLD,
} from "@/lib/tik-document-validator";
import { auth } from "@clerk/nextjs/server";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

const RETRYABLE_STATUS = new Set([429, 500, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(
  excerpt: string
): Promise<{ isValid: boolean; reason: string }> {
  const prompt = `You are a strict validator for official administrative letters from Jurusan Teknik Informatika dan Komputer, Politeknik Negeri Jakarta (TIK PNJ).

A valid TIK PNJ document MUST contain ALL of:
1. PNJ letterhead — "POLITEKNIK NEGERI JAKARTA" and "JURUSAN TEKNIK INFORMATIKA DAN KOMPUTER"
2. Official document number format like "XXX/XXX/PL3.X/XX/XXXX" (e.g. "117/DST/PL3.12/B/KM.07.00/2026")
3. Signature block — "Ketua Jurusan" with NIP number

Common document types: Nota Dinas, Surat Tugas, Surat Izin, Surat Keterangan, Undangan.

Note: The excerpt may be truncated in the middle (marked with "..."). The beginning has the letterhead/nomor, the end has the signature. Judge based on both parts.

Reject if any required element is missing.

Text excerpt:
"""
${excerpt}
"""

{"isValid": boolean, "reason": "short reason, max 15 words"}`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 100,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!res.ok) {
        const shouldRetry =
          RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES;
        if (shouldRetry) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `[validate-tik-document] Gemini ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
          );
          await sleep(delay);
          continue;
        }
        throw new Error(`Gemini error ${res.status}`);
      }

      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      return JSON.parse(raw) as { isValid: boolean; reason: string };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError ?? new Error("Gemini call failed after retries");
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const excerpt = getRelevantExcerpt(text);
  const contentHash = createHash("sha256").update(excerpt).digest("hex");

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  const cached = await convex.query(api.validations.getCached, { contentHash });
  if (cached) {
    return NextResponse.json({
      valid: cached.verdict === "accept",
      reason: cached.reason,
      method: "cache",
    });
  }

  const { score, matched } = scoreHeader(excerpt);

  // TEMP DEBUG — remove once this is confirmed working
  console.log("[validate-tik-document] score:", score, "matched:", matched);
  console.log(
    "[validate-tik-document] excerpt preview:",
    excerpt.slice(0, 400)
  );

  if (score >= AUTO_ACCEPT_THRESHOLD) {
    await convex.mutation(api.validations.record, {
      contentHash,
      verdict: "accept",
      reason: `Heuristic match (score ${score})`,
      method: "heuristic",
    });
    return NextResponse.json({
      valid: true,
      reason: "Recognized TIK PNJ letterhead",
      method: "heuristic",
    });
  }

  if (score <= AUTO_REJECT_THRESHOLD) {
    await convex.mutation(api.validations.record, {
      contentHash,
      verdict: "reject",
      reason: "No institutional markers found",
      method: "heuristic",
    });
    return NextResponse.json({
      valid: false,
      reason: "This doesn't look like a TIK PNJ administrative document.",
      method: "heuristic",
    });
  }

  const allowed = await convex.query(api.validations.checkRateLimit, {});
  if (!allowed) {
    return NextResponse.json({
      valid: false,
      reason: "Could not verify document — please contact an admin.",
      method: "rate-limited",
    });
  }

  try {
    const parsed = await callGemini(excerpt);

    await convex.mutation(api.validations.record, {
      contentHash,
      verdict: parsed.isValid ? "accept" : "reject",
      reason: parsed.reason ?? "Gemini verdict",
      method: "gemini",
    });

    return NextResponse.json({
      valid: !!parsed.isValid,
      reason: parsed.reason,
      method: "gemini",
    });
  } catch (err) {
    console.error(
      "[validate-tik-document] Gemini call failed after retries:",
      err
    );
    return NextResponse.json(
      { valid: false, reason: "Could not verify document. Please try again." },
      { status: 200 }
    );
  }
}
