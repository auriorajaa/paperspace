import { buildPageMetadata } from "@/lib/metadata";
import FormsClient from "./forms-client";

export const metadata = buildPageMetadata({
  title: "Forms",
  description: "Create and manage internal web forms for collecting responses.",
  path: "/forms",
  noIndex: true,
});

export default function FormsPage() {
  return <FormsClient />;
}
