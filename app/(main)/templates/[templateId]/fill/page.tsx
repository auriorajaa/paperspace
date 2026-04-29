// ───────────────────────────────────────────────────────────────────────────
// app/(main)/templates/[templateId]/fill/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import TemplateFillClient from "./template-fill-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ templateId: string }>;
}): Promise<Metadata> {
  const { templateId } = await params;

  return buildPageMetadata({
    title: "Fill Template",
    description: `Fill in the placeholder fields and generate your document instantly with ${SITE_NAME}.`,
    path: `/templates/${templateId}/fill`,
    noIndex: true,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  await params;

  return <TemplateFillClient />;
}
