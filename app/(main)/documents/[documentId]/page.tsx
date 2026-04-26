// ───────────────────────────────────────────────────────────────────────────
// app/(main)/documents/[documentId]/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import DocumentEditorClient from "./document-editor-client";

export async function generateMetadata({
  params,
}: {
  params: { documentId: string };
}): Promise<Metadata> {
  return buildPageMetadata({
    title: "Document Editor",
    description: `Edit and collaborate on this document in ${SITE_NAME}.`,
    path: `/documents/${params.documentId}`,
    noIndex: true,
  });
}

export default function DocumentEditorPage() {
  return <DocumentEditorClient />;
}
