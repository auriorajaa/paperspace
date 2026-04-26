import type { Metadata } from "next";

// ─── Site constants ───────────────────────────────────────────────────────────
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_NAME = "Paperspace";
export const SITE_HANDLE = "@paperspace"; // Twitter/X handle
export const SITE_DESCRIPTION =
  "Write, collaborate, and generate documents at scale. Real-time text editor, AI summaries, smart templates with {{placeholders}}, mail merge from CSV, and Google Forms auto-sync — all in your browser.";
export const SITE_KEYWORDS = [
  "document workspace",
  "online document editor",
  "AI document summary",
  "mail merge",
  "document template",
  "ONLYOFFICE",
  "Google Forms integration",
  "document automation",
  "real-time collaboration",
  "docx editor online",
  "bulk document generation",
  "document management",
  "team workspace",
  "paperspace",
];

// ─── OG image dimensions ─────────────────────────────────────────────────────
const OG_IMAGE = {
  url: `${SITE_URL}/favicon.svg`,
  width: 500,
  height: 500,
  alt: "Paperspace",
  type: "image/svg+xml",
};

// ─── Base (root layout) metadata ─────────────────────────────────────────────
// Apply in app/layout.tsx. Child pages override individual fields.
export const baseMetadata: Metadata = {
  // metadataBase is required so relative og/twitter image URLs resolve correctly
  metadataBase: new URL(SITE_URL),

  // title.template automatically wraps child page titles: "Sign in | Paperspace"
  title: {
    default: `${SITE_NAME} — Every document, in one place`,
    template: `%s | ${SITE_NAME}`,
  },

  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,

  authors: [{ name: "Paperspace", url: SITE_URL }],
  creator: "Paperspace",
  publisher: "Paperspace",
  generator: "Next.js",
  category: "Productivity",
  classification: "Business/Productivity Software",
  referrer: "origin-when-cross-origin",

  // Canonical + alternates
  alternates: {
    canonical: SITE_URL,
  },

  // Indexing instructions
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Open Graph ──────────────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Every document, in one place`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },

  // ── Twitter / X card ────────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    site: SITE_HANDLE,
    creator: SITE_HANDLE,
    title: `${SITE_NAME} — Every document, in one place`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },

  // ── Icons ───────────────────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },

  // ── PWA / Browser theme ─────────────────────────────────────────────────────
  manifest: "/site.webmanifest",
  applicationName: SITE_NAME,

  // themeColor: supports dark/light via array
  // (Next.js 14+: move to viewport export if you see a warning)
  // themeColor: [
  //   { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  //   { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  // ],

  // ── Format detection (disable auto-link on mobile) ─────────────────────────
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  // ── Search engine verification ──────────────────────────────────────────────
  // Add your tokens here after verifying ownership in each platform
  verification: {
    // google: "your-google-search-console-token",
    // yandex: "your-yandex-token",
    // bing: "your-bing-webmaster-token",
  },
};

// ─── JSON-LD helpers ─────────────────────────────────────────────────────────

/** Root-level WebApplication structured data — add to <head> in layout.tsx */
export const webApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "All",
  browserRequirements: "Requires a modern web browser with JavaScript enabled",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free to get started. No credit card required.",
  },
  featureList: [
    "Real-time ONLYOFFICE document editor",
    "AI-powered document summaries",
    "Smart templates with typed placeholders",
    "Mail merge and bulk document generation",
    "Google Forms integration",
    "Document collections and organisation",
    "Team collaboration and sharing",
  ],
  screenshot: OG_IMAGE.url,
  creator: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
};

/** Landing page WebSite structured data (enables Google Sitelinks Search Box) */
export const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/documents?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

// ─── Per-page metadata builder ───────────────────────────────────────────────
/**
 * Merge page-specific overrides on top of the base OG/Twitter fields.
 * Usage:
 *   export const metadata = buildPageMetadata({
 *     title: "Sign in",
 *     description: "...",
 *     path: "/sign-in",
 *     noIndex: false,
 *   });
 */
export function buildPageMetadata({
  title,
  description,
  path = "",
  ogImage,
  noIndex = false,
}: {
  title: string;
  description?: string;
  path?: string;
  ogImage?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  const desc = description ?? SITE_DESCRIPTION;
  const image = ogImage ?? OG_IMAGE.url;

  return {
    title,
    description: desc,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description: desc,
      url,
      images: [
        {
          url: image,
          width: OG_IMAGE.width,
          height: OG_IMAGE.height,
          alt: `${title} | ${SITE_NAME}`,
          type: OG_IMAGE.type,
        },
      ],
    },
    twitter: {
      title: `${title} | ${SITE_NAME}`,
      description: desc,
      images: [image],
    },
  };
}
