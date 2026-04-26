// ───────────────────────────────────────────────────────────────────────────
// app/(main)/templates/[templateId]/connect/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import TemplateCnnectClient from "./template-connect-client";

export async function generateMetadata({
  params,
}: {
  params: { templateId: string };
}): Promise<Metadata> {
  return buildPageMetadata({
    title: "Connect Google Form",
    description: `Link a Google Form to this template. Every new form submission will automatically generate a filled document in ${SITE_NAME}.`,
    path: `/templates/${params.templateId}/connect`,
    noIndex: true,
  });
}

export default function TemplateConnectPage() {
  return <TemplateCnnectClient />;
}
