// contexts/ThemeContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type Theme = "dark" | "light";
export type FontSizePreference = "compact" | "default" | "large";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  fontSize: FontSizePreference;
  setFontSize: (fontSize: FontSizePreference) => void;
  resolvedTheme: Theme;
  systemTheme: Theme | undefined;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [fontSize, setFontSizeState] =
    useState<FontSizePreference>("default");
  const [resolvedTheme, setResolvedTheme] = useState<Theme>("dark");
  const [systemTheme, setSystemTheme] = useState<Theme | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check localStorage
    const saved = localStorage.getItem("theme") as Theme | null;
    const savedFontSize = localStorage.getItem(
      "font-size"
    ) as FontSizePreference | null;
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const system: Theme = systemPrefersDark ? "dark" : "light";

    setSystemTheme(system);

    const initialTheme = saved || system;
    setThemeState(initialTheme);
    setResolvedTheme(initialTheme);

    applyTheme(initialTheme);

    const initialFontSize =
      savedFontSize === "compact" || savedFontSize === "large"
        ? savedFontSize
        : "default";

    setFontSizeState(initialFontSize);
    applyFontSize(initialFontSize);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;

    root.dataset.theme = newTheme;
    root.style.colorScheme = newTheme;

    root.classList.remove("theme-dark", "theme-light", "dark");
    root.classList.add(newTheme === "light" ? "theme-light" : "theme-dark");

    if (newTheme === "dark") {
      root.classList.add("dark");
    }
  };

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem("theme", newTheme);
    setThemeState(newTheme);
    setResolvedTheme(newTheme);
    applyTheme(newTheme);
  };

  const applyFontSize = (newFontSize: FontSizePreference) => {
    document.documentElement.dataset.fontSize = newFontSize;
  };

  const setFontSize = (newFontSize: FontSizePreference) => {
    localStorage.setItem("font-size", newFontSize);
    setFontSizeState(newFontSize);
    applyFontSize(newFontSize);
  };

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const newSystemTheme: Theme = e.matches ? "dark" : "light";
      setSystemTheme(newSystemTheme);

      // Only auto-switch if no user preference saved
      const saved = localStorage.getItem("theme");
      if (!saved) {
        setResolvedTheme(newSystemTheme);
        applyTheme(newSystemTheme);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{
          theme: "dark",
          setTheme: () => {},
          fontSize: "default",
          setFontSize: () => {},
          resolvedTheme: "dark",
          systemTheme: undefined,
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        fontSize,
        setFontSize,
        resolvedTheme,
        systemTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
