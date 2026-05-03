// app/(main)/templates/[templateId]/review/page.tsx
import { buildPageMetadata } from "@/lib/metadata";
import TemplateReviewClient from "./review-client"

export const metadata = buildPageMetadata({
  title: "Review Detected Fields",
  description:
    "Review and confirm the fields detected automatically from your document before proceeding to fill.",
  path: "/templates/review",
  noIndex: true,
});

export default function TemplateReviewPage() {
  return <TemplateReviewClient />;
}
