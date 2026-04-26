import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";

import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ClerkThemeProvider } from "@/components/ClerkThemeProvider";
import { Toaster } from "sonner";

import {
  baseMetadata,
  webApplicationJsonLd,
  webSiteJsonLd,
} from "@/lib/metadata";

import "./globals.css";

// ─── Font ─────────────────────────────────────────────────────────────────────
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

// ─── Metadata (exported — consumed by Next.js automatically) ──────────────────
export const metadata: Metadata = baseMetadata;

// ─── Viewport (separated from metadata as required by Next.js 14+) ────────────
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
  colorScheme: "dark light",
};

// ─── Theme init — runs before paint to prevent flash ─────────────────────────
const themeInitScript = `
(function() {
  try {
    var savedTheme = localStorage.getItem("theme");
    var theme = savedTheme === "light" ? "light" : "dark";
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.classList.remove("theme-dark", "theme-light", "dark");
    root.classList.add(theme === "light" ? "theme-light" : "theme-dark");
    if (theme === "dark") root.classList.add("dark");
  } catch (e) {}
})();
`;

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent FOUC — must run before any paint */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />

        {/* ── Structured data: WebApplication ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webApplicationJsonLd),
          }}
        />

        {/* ── Structured data: WebSite (enables Sitelinks Search Box) ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webSiteJsonLd),
          }}
        />
      </head>
      <body className={jakartaSans.className} suppressHydrationWarning>
        <ThemeProvider>
          <ClerkThemeProvider>
            <ConvexClientProvider>
              {children}
              <Toaster richColors position="bottom-right" />
            </ConvexClientProvider>
          </ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
