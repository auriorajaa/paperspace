// components/ClerkThemeProvider.tsx
"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ReactNode, useMemo } from "react";

export function ClerkThemeProvider({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme } = useTheme();

  // Gunakan resolvedTheme atau fallback ke theme
  const currentTheme = resolvedTheme || theme || "dark";
  const isDark = currentTheme === "dark";

  // Definisikan colors berdasarkan theme untuk Clerk
  const clerkAppearance = useMemo(() => {
    // Colors untuk light mode
    const lightColors = {
      bg: "#ffffff",
      bgCard: "#ffffff",
      bgMuted: "#f1f5f9",
      bgInput: "rgba(15, 23, 42, 0.04)",
      text: "#0f172a",
      textSecondary: "#334155",
      textMuted: "#64748b",
      textDim: "#94a3b8",
      primary: "#4f46e5",
      primaryForeground: "#ffffff",
      borderSubtle: "rgba(15, 23, 42, 0.12)",
      accentLight: "#4f46e5",
      accentPale: "#3730a3",
      success: "#059669",
      danger: "#dc2626",
      warning: "#d97706",
    };

    // Colors untuk dark mode
    const darkColors = {
      bg: "#0a0a0c",
      bgCard: "#111115",
      bgMuted: "#1a1a20",
      bgInput: "rgba(255, 255, 255, 0.06)",
      text: "rgba(255, 255, 255, 0.92)",
      textSecondary: "rgba(255, 255, 255, 0.7)",
      textMuted: "rgba(255, 255, 255, 0.38)",
      textDim: "rgba(255, 255, 255, 0.22)",
      primary: "#6366f1",
      primaryForeground: "#ffffff",
      borderSubtle: "rgba(255, 255, 255, 0.07)",
      accentLight: "#818cf8",
      accentPale: "#a5b4fc",
      success: "#34d399",
      danger: "#f87171",
      warning: "#fbbf24",
    };

    const c = isDark ? darkColors : lightColors;

    return {
      baseTheme: isDark ? dark : undefined,
      variables: {
        colorPrimary: c.primary,
        colorBackground: c.bgCard,
        colorText: c.text,
        colorTextSecondary: c.textSecondary,
        colorInputBackground: c.bgInput,
        colorInputText: c.text,
        colorAlphaShade: c.textMuted,
      },
      elements: {
        card: {
          backgroundColor: c.bgCard,
          border: `1px solid ${c.borderSubtle}`,
          boxShadow: isDark
            ? "0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(99, 102, 241, 0.08)"
            : "0 2px 8px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(99, 102, 241, 0.05)",
        },
        cardBox: {
          backgroundColor: c.bgCard,
        },
        scrollBox: {
          backgroundColor: c.bgCard,
        },
        header: {
          backgroundColor: c.bgCard,
        },
        headerTitle: {
          color: c.text,
          fontSize: "18px",
          fontWeight: "600",
        },
        headerSubtitle: {
          color: c.textMuted,
          fontSize: "14px",
        },
        socialButtonsBlockButton: {
          backgroundColor: c.bgMuted,
          border: `1px solid ${c.borderSubtle}`,
          color: c.textSecondary,
          "&:hover": {
            backgroundColor: c.bgInput,
          },
        },
        socialButtonsBlockButtonText: {
          color: c.text,
          fontWeight: "500",
        },
        formFieldLabel: {
          color: c.textSecondary,
          fontSize: "14px",
          fontWeight: "500",
        },
        formFieldInput: {
          backgroundColor: c.bgInput,
          border: `1px solid ${c.borderSubtle}`,
          color: c.text,
          "&:focus": {
            borderColor: c.accentLight,
            boxShadow: `0 0 0 2px ${c.primary}20`,
          },
        },
        formFieldInputPlaceholder: {
          color: c.textDim,
        },
        formButtonPrimary: {
          backgroundColor: c.primary,
          color: c.primaryForeground,
          fontWeight: "600",
          "&:hover": {
            opacity: 0.9,
          },
          "&:active": {
            opacity: 0.8,
          },
        },
        formButtonSecondary: {
          backgroundColor: c.bgMuted,
          color: c.text,
          border: `1px solid ${c.borderSubtle}`,
        },
        formButtonReset: {
          color: c.textSecondary,
        },
        footer: {
          backgroundColor: c.bgCard,
        },
        footerAction: {
          color: c.textMuted,
        },
        footerActionLink: {
          color: c.accentLight,
          fontWeight: "500",
          "&:hover": {
            color: c.accentPale,
          },
        },
        identityPreview: {
          backgroundColor: c.bgMuted,
          border: `1px solid ${c.borderSubtle}`,
        },
        identityPreviewText: {
          color: c.text,
        },
        identityPreviewEditButton: {
          color: c.accentLight,
        },
        formFieldError: {
          backgroundColor: isDark
            ? "rgba(248, 113, 113, 0.1)"
            : "rgba(220, 38, 38, 0.1)",
        },
        formFieldErrorText: {
          color: c.danger,
        },
        formFieldSuccess: {
          backgroundColor: isDark
            ? "rgba(52, 211, 153, 0.1)"
            : "rgba(5, 150, 105, 0.12)",
        },
        formFieldSuccessText: {
          color: c.success,
        },
        alert: {
          backgroundColor: isDark
            ? "rgba(251, 191, 36, 0.1)"
            : "rgba(217, 119, 6, 0.12)",
          border: `1px solid ${isDark ? "rgba(251, 191, 36, 0.2)" : "rgba(217, 119, 6, 0.2)"}`,
          color: c.warning,
        },
        alertText: {
          color: c.warning,
        },
        modalBackdrop: {
          backgroundColor: isDark
            ? "rgba(0, 0, 0, 0.6)"
            : "rgba(15, 23, 42, 0.24)",
          backdropFilter: "blur(4px)",
        },
        modalContent: {
          backgroundColor: c.bgCard,
          border: `1px solid ${c.borderSubtle}`,
          boxShadow: isDark
            ? "0 24px 80px rgba(0, 0, 0, 0.6)"
            : "0 20px 60px rgba(15, 23, 42, 0.15)",
        },
        profileSection: {
          backgroundColor: c.bgCard,
        },
        profileSectionTitle: {
          color: c.text,
          fontSize: "16px",
          fontWeight: "600",
        },
        profileSectionSubtitle: {
          color: c.textMuted,
        },
        profileSectionContent: {
          backgroundColor: c.bgMuted,
          border: `1px solid ${c.borderSubtle}`,
        },
        menuButton: {
          color: c.textSecondary,
        },
        menuList: {
          backgroundColor: c.bgCard,
          border: `1px solid ${c.borderSubtle}`,
          boxShadow: isDark
            ? "0 4px 16px rgba(0, 0, 0, 0.5)"
            : "0 4px 10px rgba(15, 23, 42, 0.08)",
        },
        menuItem: {
          color: c.textSecondary,
        },
        menuItemHover: {
          backgroundColor: c.bgMuted,
          color: c.text,
        },
        navbar: {
          backgroundColor: c.bgCard,
          border: `1px solid ${c.borderSubtle}`,
        },
        navbarButton: {
          color: c.textSecondary,
        },
        navbarButtonHover: {
          backgroundColor: c.bgMuted,
        },
        pageScrollBox: {
          backgroundColor: c.bg,
        },
        page: {
          backgroundColor: c.bg,
        },
        rootBox: {
          backgroundColor: c.bg,
        },
        userButtonBox: {
          backgroundColor: "transparent",
        },
        userButtonTrigger: {
          backgroundColor: c.bgMuted,
          border: `1px solid ${c.borderSubtle}`,
        },
        activeDeviceIcon: {
          color: c.success,
        },
        spinner: {
          borderTopColor: c.primary,
        },
        dividerLine: {
          backgroundColor: c.borderSubtle,
        },
        dividerText: {
          color: c.textMuted,
        },
        otpInput: {
          backgroundColor: c.bgInput,
          border: `1px solid ${c.borderSubtle}`,
          color: c.text,
        },
        otpInputFilled: {
          backgroundColor: c.bgMuted,
          borderColor: c.primary,
        },
      },
      layout: {
        socialButtonsPlacement: "bottom",
        socialButtonsVariant: "iconButton",
        termsPage: {
          url: "/terms",
        },
        privacyPage: {
          url: "/privacy",
        },
        helpPage: {
          url: "/help",
        },
        logoPlacement: "inside",
      },
    };
  }, [isDark]);

  return <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>;
}
