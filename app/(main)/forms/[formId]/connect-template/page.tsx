import { buildPageMetadata } from "@/lib/metadata";
import ConnectTemplateClient from "./connect-template-client";

export const metadata = buildPageMetadata({
  title: "Connect Template",
  description: "Connect a template to generate documents from form responses.",
  path: "/forms/connect-template",
  noIndex: true,
});

export default function ConnectTemplatePage() {
  return <ConnectTemplateClient />;
}
