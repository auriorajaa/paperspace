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
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            boxShadow: isDark
              ? "0 0 12px rgba(99,102,241,0.38)"
              : "0 1px 6px rgba(79,70,229,0.2)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 2h6l3 3v7H2V2z"
              stroke="white"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M8 2v3h3"
              stroke="white"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M4 7h5M4 9.5h3"
              stroke="white"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
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
