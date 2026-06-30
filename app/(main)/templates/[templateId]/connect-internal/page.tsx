import type { Metadata } from "next";
import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import ConnectInternalClient from "./connect-internal-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ templateId: string }>;
}): Promise<Metadata> {
  const { templateId } = await params;

  return buildPageMetadata({
    title: "Connect Internal Form",
    description: `Link an internal web form to this template. Every new form submission will automatically generate a filled document in ${SITE_NAME}.`,
    path: `/templates/${templateId}/connect-internal`,
    noIndex: true,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  await params;

  return <ConnectInternalClient />;
}
