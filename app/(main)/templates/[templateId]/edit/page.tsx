// ───────────────────────────────────────────────────────────────────────────
// app/(main)/templates/[templateId]/edit/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import TemplateEditClient from "./template-edit-client";

export async function generateMetadata({
  params,
}: {
  params: { templateId: string };
}): Promise<Metadata> {
  return buildPageMetadata({
    title: "Edit Template",
    description: `Edit placeholder fields and settings for this template in ${SITE_NAME}.`,
    path: `/templates/${params.templateId}/edit`,
    noIndex: true,
  });
}

export default function TemplateEditPage() {
  return <TemplateEditClient />;
}
