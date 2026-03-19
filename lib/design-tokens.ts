// ── Paperspace Design Tokens ──────────────────────────────────────────────────
// Edit here once, applies everywhere

export const colors = {
  // Backgrounds
  bg: "#0a0a0c",
  bgSidebar: "#0e0e12",
  bgCard: "rgba(255,255,255,0.025)",
  bgCardHover: "rgba(255,255,255,0.045)",
  bgMuted: "rgba(255,255,255,0.04)",
  bgInput: "rgba(255,255,255,0.06)",

  // Borders
  border: "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.11)",
  borderSubtle: "rgba(255,255,255,0.05)",

  // Text
  text: "rgba(255,255,255,0.90)",
  textSecondary: "rgba(255,255,255,0.65)",
  textMuted: "rgba(255,255,255,0.38)",
  textDim: "rgba(255,255,255,0.22)",
  textPlaceholder: "rgba(255,255,255,0.18)",

  // Accent — indigo
  accent: "#6366f1",
  accentLight: "#818cf8",
  accentPale: "#a5b4fc",
  accentBg: "rgba(99,102,241,0.10)",
  accentBgHover: "rgba(99,102,241,0.18)",
  accentBorder: "rgba(99,102,241,0.22)",

  // Semantic
  success: "#34d399",
  successBg: "rgba(52,211,153,0.08)",
  warning: "#fbbf24",
  warningBg: "rgba(251,191,36,0.10)",
  danger: "#f87171",
  dangerBg: "rgba(248,113,113,0.10)",

  // Feature colors
  documents: "#818cf8", // indigo
  collections: "#34d399", // emerald
  templates: "#f472b6", // pink
  archive: "#fbbf24", // amber
} as const;

export const radius = {
  sm: "8px",
  md: "10px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
} as const;

export const shadows = {
  card: "0 1px 3px rgba(0,0,0,0.3)",
  cardHover: "0 0 0 1px rgba(99,102,241,0.08), 0 8px 32px rgba(0,0,0,0.35)",
  glow: "0 0 20px rgba(99,102,241,0.25)",
} as const;

// Field type color mapping (for template fields)
export const fieldTypeColors: Record<string, string> = {
  text: "#60a5fa",
  date: "#34d399",
  number: "#fb923c",
  email: "#c084fc",
  loop: "#818cf8",
  condition: "#f472b6",
  condition_inverse: "#fb7185",
};
