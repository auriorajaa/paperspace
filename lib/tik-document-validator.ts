// lib/tik-document-validator.ts

const HEADER_MARKERS: { pattern: RegExp; weight: number }[] = [
  { pattern: /politeknik\s+negeri\s+jakarta/i, weight: 2 },
  { pattern: /kementerian\s+pendidikan/i, weight: 1 },
  { pattern: /jurusan\s+teknik\s+informatika\s+dan\s+komputer/i, weight: 2 },
  {
    pattern:
      /\b(nota\s+dinas|surat\s+tugas|surat\s+izin|surat\s+keterangan|undangan)\b/i,
    weight: 1,
  },
  // tolerate OCR/conversion spacing around slashes and dots, e.g. "117 / DST / PL3.12 / B / KM.07.00 / 2026"
  {
    pattern:
      /\b\d{1,4}\s*\/\s*[A-Z]{2,5}\s*\/\s*PL[\dA-Z.\s]+\s*\/\s*[A-Z]\s*\/\s*[A-Z0-9.\s]+\s*\/\s*20\d{2}\b/i,
    weight: 3,
  },
  { pattern: /ketua\s+jurusan/i, weight: 1 },
  { pattern: /NIP[.:\s]*\d{9,18}/i, weight: 1 },
  { pattern: /pnj\.ac\.id/i, weight: 1 },
];

export interface HeuristicResult {
  score: number;
  matched: string[];
}

export function scoreHeader(headerText: string): HeuristicResult {
  const matched: string[] = [];
  let score = 0;
  for (const { pattern, weight } of HEADER_MARKERS) {
    if (pattern.test(headerText)) {
      score += weight;
      matched.push(pattern.source);
    }
  }
  return { score, matched };
}

export const AUTO_ACCEPT_THRESHOLD = 5;
export const AUTO_REJECT_THRESHOLD = 1;

// Letterhead + nomor live at the TOP, but "Ketua Jurusan" + NIP live at the
// BOTTOM (often after a table). Grabbing only the first N chars misses the
// signature on longer letters. Combine head + tail instead.
const HEAD_CHARS = 1500;
const TAIL_CHARS = 800;

export function getRelevantExcerpt(fullText: string): string {
  if (fullText.length <= HEAD_CHARS + TAIL_CHARS) return fullText;
  const head = fullText.slice(0, HEAD_CHARS);
  const tail = fullText.slice(-TAIL_CHARS);
  return `${head}\n...\n${tail}`;
}
