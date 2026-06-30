import { buildPageMetadata } from "@/lib/metadata";
import NewFormClient from "./new-form-client";

export const metadata = buildPageMetadata({
  title: "New Form",
  description: "Create a new internal web form.",
  path: "/forms/new",
  noIndex: true,
});

export default async function NewFormPage(props: {
  searchParams?: Promise<{ orgId?: string }>;
}) {
  const searchParams = await props.searchParams;
  return <NewFormClient orgId={searchParams?.orgId || undefined} />;
}
