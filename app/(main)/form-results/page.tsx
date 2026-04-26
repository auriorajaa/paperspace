// ───────────────────────────────────────────────────────────────────────────
// app/(main)/form-results/page.tsx
// ───────────────────────────────────────────────────────────────────────────
import { buildPageMetadata } from "@/lib/metadata";
import FormResultsClient from "./form-results-client";

export const metadata = buildPageMetadata({
  title: "Form Results",
  description:
    "View documents auto-generated from your connected Google Forms. Every submission is saved and ready to open or download.",
  path: "/form-results",
  noIndex: true,
});

export default function FormResultsPage() {
  return <FormResultsClient />;
}
