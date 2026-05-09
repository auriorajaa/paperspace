import { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://paperspace.work";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",

        allow: [
          "/",
          "/sign-in",
          "/sign-up",
          "/privacy-policy",
          "/terms-of-service",
        ],

        disallow: [
          "/api/",
          "/home/",
          "/documents/",
          "/templates/",
          "/collections/",
          "/form-results/",
          "/dashboard/",
        ],
      },
    ],

    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
