import { buildPageMetadata } from "@/lib/metadata";
import ResponsesClient from "./responses-client";

export const metadata = buildPageMetadata({
  title: "Form Responses",
  description: "View responses submitted to your form.",
  path: "/forms/responses",
  noIndex: true,
});

export default function ResponsesPage() {
  return <ResponsesClient />;
}
