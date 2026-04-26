// ───────────────────────────────────────────────────────────────────────────
// app/(main)/collections/page.tsx
// ───────────────────────────────────────────────────────────────────────────
import { buildPageMetadata } from "@/lib/metadata";
import CollectionsClient from "./collections-client";

export const metadata = buildPageMetadata({
  title: "Collections",
  description:
    "Browse and manage your document collections. Organise papers into colour-coded folders and share them with your team.",
  path: "/collections",
  noIndex: true,
});

export default function CollectionsPage() {
  return <CollectionsClient />;
}
