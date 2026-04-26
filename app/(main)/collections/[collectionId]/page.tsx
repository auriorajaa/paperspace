// ───────────────────────────────────────────────────────────────────────────
// app/(main)/collections/[collectionId]/page.tsx
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import CollectionDetailClient from "./collection-detail-client";

export async function generateMetadata({
  params,
}: {
  params: { collectionId: string };
}): Promise<Metadata> {
  return buildPageMetadata({
    title: "Collection",
    description: `Browse and manage documents in this collection on ${SITE_NAME}.`,
    path: `/collections/${params.collectionId}`,
    noIndex: true,
  });
}

export default function CollectionDetailPage() {
  return <CollectionDetailClient />;
}
