// ───────────────────────────────────────────────────────────────────────────
// app/(main)/documents/page.tsx
// ───────────────────────────────────────────────────────────────────────────
import { buildPageMetadata } from "@/lib/metadata";
import DocumentsClient from "./documents-client";

export const metadata = buildPageMetadata({
  title: "Papers",
  description:
    "All your documents in one place. Search, filter, and open any paper from your Paperspace workspace.",
  path: "/documents",
  noIndex: true,
});

export default function DocumentsPage() {
  return <DocumentsClient />;
}
