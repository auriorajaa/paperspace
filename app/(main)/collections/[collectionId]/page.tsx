// ───────────────────────────────────────────────────────────────────────────
// app/(main)/collections/[collectionId]/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import CollectionDetailClient from "./collection-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}): Promise<Metadata> {
  const { collectionId } = await params;

  return buildPageMetadata({
    title: "Collection",
    description: `Browse and manage documents in this collection on ${SITE_NAME}.`,
    path: `/collections/${collectionId}`,
    noIndex: true,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  await params;

  return <CollectionDetailClient />;
}
