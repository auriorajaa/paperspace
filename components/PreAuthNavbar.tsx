// components\PreAuthNavbar.tsx
"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { SunIcon, MoonIcon } from "lucide-react";

interface PreAuthNavbarProps {
  page?: "landing" | "sign-in" | "sign-up";
  isSignedIn?: boolean;
}

export function PreAuthNavbar({ page, isSignedIn }: PreAuthNavbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5 sm:px-8 h-14"
      style={{
        background: isDark ? "rgba(10,10,12,0.82)" : "rgba(248,250,252,0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.055)" : "rgba(15,23,42,0.08)"}`,
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 group shrink-0">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          // style={{
          //   background: isDark ? "rgba(255, 255, 255, 0.92)" : "#0a0a0c",
          //   boxShadow: isDark
          //     ? "0 0 12px rgba(99,102,241,0.38)"
          //     : "0 1px 6px rgba(79,70,229,0.2)",
          // }}
        >
          <img src="/favicon.svg" alt="Logo" width={32} height={32} />
        </div>
        <span
          className="text-[15px] font-semibold tracking-tight"
          style={{
            color: "var(--text)",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Paperspace
        </span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
          title={isDark ? "Switch to light" : "Switch to dark"}
        >
          {isDark ? (
            <SunIcon className="w-3.5 h-3.5" />
          ) : (
            <MoonIcon className="w-3.5 h-3.5" />
          )}
        </button>

        {isSignedIn ? (
          <Link
            href="/home"
            className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all duration-150 hover:opacity-90"
            style={{ background: "var(--text)", color: "var(--bg)" }}
          >
            Open app →
          </Link>
        ) : page === "sign-in" ? (
          <Link
            href="/sign-up"
            className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all duration-150 hover:opacity-90"
            style={{ background: "var(--text)", color: "var(--bg)" }}
          >
            Get started
          </Link>
        ) : page === "sign-up" ? (
          <Link
            href="/sign-in"
            className="text-sm font-medium px-4 py-1.5 rounded-lg transition-all duration-150"
            style={{
              background: "var(--bg-muted)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            Sign in
          </Link>
        ) : (
          /* Landing — Sign in hidden on mobile, both visible on sm+ */
          <>
            <Link
              href="/sign-in"
              className="hidden sm:block text-sm px-3 py-1.5 transition-colors duration-150"
              style={{ color: "var(--text-muted)" }}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all duration-150 hover:opacity-90"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
