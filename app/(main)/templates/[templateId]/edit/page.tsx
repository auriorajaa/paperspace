// ───────────────────────────────────────────────────────────────────────────
// app/(main)/templates/[templateId]/edit/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import TemplateEditClient from "./template-edit-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ templateId: string }>;
}): Promise<Metadata> {
  const { templateId } = await params;

  return buildPageMetadata({
    title: "Edit Template",
    description: `Edit placeholder fields and settings for this template in ${SITE_NAME}.`,
    path: `/templates/${templateId}/edit`,
    noIndex: true,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  await params;

  return <TemplateEditClient />;
}
