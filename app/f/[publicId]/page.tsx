import { auth } from "@clerk/nextjs/server";
import PublicFormClient from "./public-form-client";

export default async function PublicFormPage() {
  const session = await auth();
  return <PublicFormClient isSignedIn={!!session.userId} />;
}
