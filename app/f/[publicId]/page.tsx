import { buildPageMetadata, SITE_NAME } from "@/lib/metadata";
import PublicFormClient from "./public-form-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return buildPageMetadata({
    title: "Form",
    description: `Submit a form on ${SITE_NAME}.`,
    path: `/f/${publicId}`,
    noIndex: true,
  });
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  await params;
  return <PublicFormClient />;
}
