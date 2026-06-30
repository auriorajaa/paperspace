// app\f\[publicId]\page.tsx
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import PublicFormClient from "./public-form-client";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

type Params = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { publicId } = await params;

  let meta: {
    title: string;
    description?: string;
    headerImage?: string;
    acceptResponses: boolean;
  } | null = null;

  try {
    meta = await convex.query(api.internalForms.getMetaByPublicId, {
      publicId,
    });
  } catch {
    meta = null;
  }

  if (!meta) {
    return {
      title: "Form not found",
      description: "This form may have been unpublished or deleted.",
      robots: { index: false, follow: false },
    };
  }

  const title = meta.title || "Untitled form";
  const description =
    meta.description ||
    (meta.acceptResponses
      ? "Fill out this short form — it only takes a minute."
      : "This form is no longer accepting responses.");

  const url = SITE_URL ? `${SITE_URL}/f/${publicId}` : undefined;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      images: meta.headerImage ? [{ url: meta.headerImage }] : undefined,
    },
    twitter: {
      card: meta.headerImage ? "summary_large_image" : "summary",
      title,
      description,
      images: meta.headerImage ? [meta.headerImage] : undefined,
    },
  };
}

export default async function PublicFormPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  return (
    <PublicFormClient
      isSignedIn={!!session.userId}
      submittedParam={sp.submitted}
    />
  );
}
