// app/layout.tsx (Tambahkan suppressHydrationWarning di body juga)
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";

import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ClerkThemeProvider } from "@/components/ClerkThemeProvider";
import { Toaster } from "sonner";

import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Paperspace",
  description: "Your modern document workspace",
};

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
    
    if (theme === "dark") {
      root.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
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
