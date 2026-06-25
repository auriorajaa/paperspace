import { buildPageMetadata } from "@/lib/metadata";
import BuilderClient from "./builder-client";

export const metadata = buildPageMetadata({
  title: "Form Builder",
  description: "Build and edit your web form.",
  path: "/forms/builder",
  noIndex: true,
});

export default function BuilderPage() {
  return <BuilderClient />;
}
