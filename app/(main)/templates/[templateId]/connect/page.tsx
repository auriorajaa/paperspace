// ───────────────────────────────────────────────────────────────────────────
// app/(main)/templates/[templateId]/connect/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import TemplateConnectClient from "./template-connect-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ templateId: string }>;
}): Promise<Metadata> {
  const { templateId } = await params;

  return buildPageMetadata({
    title: "Connect Google Form",
    description: `Link a Google Form to this template. Every new form submission will automatically generate a filled document in ${SITE_NAME}.`,
    path: `/templates/${templateId}/connect`,
    noIndex: true,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  await params;

  return <TemplateConnectClient />;
}
