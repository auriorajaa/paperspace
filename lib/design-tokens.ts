// Theme-dependent color variables live in app/globals.css.

export const radius = {
  sm: "8px",
  md: "10px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
} as const;

export const shadows = {
  card: "0 1px 2px rgba(0,0,0,0.2)",
  cardHover: "var(--shadow-elevated)",
  glow: "var(--shadow-logo-glow)",
} as const;

export const fieldTypeColors: Record<string, string> = {
  text: "var(--field-text)",
  date: "var(--field-date)",
  number: "var(--field-number)",
  email: "var(--field-email)",
  loop: "var(--field-loop)",
  condition: "var(--field-condition)",
  condition_inverse: "var(--field-condition-inverse)",
};

