// ───────────────────────────────────────────────────────────────────────────
// app/(main)/home/page.tsx
// ───────────────────────────────────────────────────────────────────────────
import { buildPageMetadata } from "@/lib/metadata";
import HomeClient from "./home-client";

export const metadata = buildPageMetadata({
  title: "Home",
  description:
    "Your Paperspace dashboard. View recent papers, browse collections, use templates, and create new documents.",
  path: "/home",
  noIndex: true,
});

export default function HomePage() {
  return <HomeClient />;
}
