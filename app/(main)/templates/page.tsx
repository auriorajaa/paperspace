// ───────────────────────────────────────────────────────────────────────────
// app/(main)/templates/page.tsx
// ───────────────────────────────────────────────────────────────────────────
import { buildPageMetadata } from "@/lib/metadata";
import TemplatesClient from "./templates-client";

export const metadata = buildPageMetadata({
  title: "Templates",
  description:
    "Browse your document templates. Use typed {{placeholders}} to fill, bulk-generate from CSV, or connect to Google Forms.",
  path: "/templates",
  noIndex: true,
});

export default function TemplatesPage() {
  return <TemplatesClient />;
}
