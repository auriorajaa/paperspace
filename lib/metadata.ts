import type { Metadata } from "next";

// ─── Site constants ───────────────────────────────────────────────────────────
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://paperspace.work";

export const SITE_NAME = "Paperspace";

export const SITE_HANDLE = "@paperspace";

export const SITE_DESCRIPTION =
  "Write, collaborate, and generate documents at scale. Real-time document editing, AI summaries, smart templates, mail merge, and Google Forms automation — all in your browser.";

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

// ─── Open Graph / Twitter images ─────────────────────────────────────────────
const OG_IMAGE = {
  url: `${SITE_URL}/opengraph-image.png`,
  width: 1200,
  height: 630,
  alt: "Paperspace",
  type: "image/png",
};

const TWITTER_IMAGE = `${SITE_URL}/twitter-image.png`;

// ─── Base metadata ───────────────────────────────────────────────────────────
export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: `${SITE_NAME} — Every document, in one place`,
    template: `%s | ${SITE_NAME}`,
  },

  description: SITE_DESCRIPTION,

  keywords: SITE_KEYWORDS,

  authors: [
    {
      name: SITE_NAME,
      url: SITE_URL,
    },
  ],

  creator: SITE_NAME,
  publisher: SITE_NAME,

  applicationName: SITE_NAME,

  category: "technology",

  classification: "Business/Productivity Software",

  referrer: "origin-when-cross-origin",

  alternates: {
    canonical: SITE_URL,
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ─── Open Graph ────────────────────────────────────────────────────────────
  openGraph: {
    type: "website",

    locale: "en_US",

    url: SITE_URL,

    siteName: SITE_NAME,

    title: `${SITE_NAME} — Every document, in one place`,

    description: SITE_DESCRIPTION,

    images: [OG_IMAGE],
  },

  // ─── Twitter / X ───────────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",

    site: SITE_HANDLE,

    creator: SITE_HANDLE,

    title: `${SITE_NAME} — Every document, in one place`,

    description: SITE_DESCRIPTION,

    images: [TWITTER_IMAGE],
  },

  // ─── Icons ─────────────────────────────────────────────────────────────────
  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],

    shortcut: ["/favicon.ico"],
  },

  // ─── PWA ───────────────────────────────────────────────────────────────────
  manifest: "/site.webmanifest",

  // ─── Mobile auto-detection ────────────────────────────────────────────────
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  // ─── Verification ──────────────────────────────────────────────────────────
  verification: {
    // google: "google-search-console-token",
    // yandex: "yandex-token",
    // other: {},
  },
};

// ─── JSON-LD: WebApplication ─────────────────────────────────────────────────
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
    description: "Free to get started",
  },

  featureList: [
    "Real-time document editor",
    "AI-powered document summaries",
    "Smart templates",
    "Mail merge",
    "Google Forms integration",
    "Bulk document generation",
    "Document collections",
    "Team collaboration",
  ],

  screenshot: OG_IMAGE.url,

  creator: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
};

// ─── JSON-LD: Website ────────────────────────────────────────────────────────
export const webSiteJsonLd = {
  "@context": "https://schema.org",

  "@type": "WebSite",

  name: SITE_NAME,

  url: SITE_URL,

  description: SITE_DESCRIPTION,
};

// ─── Metadata builder ────────────────────────────────────────────────────────
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
    metadataBase: new URL(SITE_URL),

    title,

    description: desc,

    alternates: {
      canonical: url,
    },

    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },

    openGraph: {
      type: "website",

      url,

      siteName: SITE_NAME,

      title: `${title} | ${SITE_NAME}`,

      description: desc,

      images: [
        {
          url: image,
          width: OG_IMAGE.width,
          height: OG_IMAGE.height,
          alt: `${title} | ${SITE_NAME}`,
          type: "image/png",
        },
      ],
    },

    twitter: {
      card: "summary_large_image",

      title: `${title} | ${SITE_NAME}`,

      description: desc,

      images: [image],
    },
  };
}
