// ───────────────────────────────────────────────────────────────────────────
// app/(main)/templates/[templateId]/fill/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import TemplateFillClient from "./template-fill-client";

export async function generateMetadata({
  params,
}: {
  params: { templateId: string };
}): Promise<Metadata> {
  return buildPageMetadata({
    title: "Fill Template",
    description: `Fill in the placeholder fields and generate your document instantly with ${SITE_NAME}.`,
    path: `/templates/${params.templateId}/fill`,
    noIndex: true,
  });
}

export default function TemplateFillPage() {
  return <TemplateFillClient />;
}
