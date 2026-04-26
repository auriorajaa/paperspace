// ───────────────────────────────────────────────────────────────────────────
// app/(main)/templates/new/page.tsx
// ───────────────────────────────────────────────────────────────────────────
import { buildPageMetadata } from "@/lib/metadata";
import TemplateNewClient from "./template-new-client";

export const metadata = buildPageMetadata({
  title: "New Template",
  description:
    "Upload a .docx file and Paperspace will detect all {{placeholder}} fields automatically. Define types, set defaults, and start generating.",
  path: "/templates/new",
  noIndex: true,
});

export default function TemplateNewPage() {
  return <TemplateNewClient />;
}
