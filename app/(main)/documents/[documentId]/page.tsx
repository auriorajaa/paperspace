// ───────────────────────────────────────────────────────────────────────────
// app/(main)/documents/[documentId]/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import DocumentEditorClient from "./document-editor-client";

//
export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentId: string }>;
}): Promise<Metadata> {
  const { documentId } = await params;

  return buildPageMetadata({
    title: "Document Editor",
    description: `Edit and collaborate on this document in ${SITE_NAME}.`,
    path: `/documents/${documentId}`,
    noIndex: true,
  });
}

//
export default async function Page({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  await params; 

  return <DocumentEditorClient />;
}
