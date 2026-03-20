"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useOrganization } from "@clerk/nextjs";
import {
  HomeIcon,
  FileTextIcon,
  FolderIcon,
  LayoutTemplateIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ZapIcon,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/documents", label: "Documents", icon: FileTextIcon },
  { href: "/collections", label: "Collections", icon: FolderIcon },
  { href: "/templates", label: "Templates", icon: LayoutTemplateIcon },
  { href: "/form-results", label: "Form Results", icon: ZapIcon },
];

export function Navbar() {
  const pathname = usePathname();
  const { organization } = useOrganization();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });
  };

  const isActive = (href: string) => {
    if (href === "/home") return pathname === "/home";
    return pathname.startsWith(href);
  };

  if (!mounted) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? 56 : 208,
          background: "#0e0e12",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo + collapse toggle */}
        <div
          className="flex items-center h-14 shrink-0 relative"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            padding: collapsed ? "0 14px" : "0 20px",
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          {/* Logo mark — always visible */}
          <div
            className="flex items-center gap-2.5 min-w-0"
            style={{ overflow: "hidden" }}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                boxShadow: "0 0 12px rgba(99,102,241,0.35)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 2h6l3 3v7H2V2z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 2v3h3"
                  stroke="white"
                  strokeWidth="1.5"
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

            {/* Name — hidden when collapsed */}
            <span
              className="text-sm font-semibold tracking-tight whitespace-nowrap transition-all duration-200"
              style={{
                color: "rgba(255,255,255,0.9)",
                opacity: collapsed ? 0 : 1,
                width: collapsed ? 0 : "auto",
                overflow: "hidden",
              }}
            >
              Paperspace
            </span>
          </div>

          {/* Toggle button */}
          {!collapsed && (
            <button
              onClick={toggle}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors shrink-0"
              style={{ color: "rgba(255,255,255,0.25)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.6)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.25)")
              }
              title="Collapse sidebar"
            >
              <ChevronsLeftIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Nav links */}
        <nav
          className="flex flex-col gap-0.5 flex-1 py-3"
          style={{ padding: collapsed ? "12px 8px" : "12px 10px" }}
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className="flex items-center rounded-lg transition-all duration-150 relative group/nav"
                style={{
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? "8px 10px" : "8px 12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  color: active
                    ? "rgba(255,255,255,0.92)"
                    : "rgba(255,255,255,0.38)",
                  background: active ? "rgba(99,102,241,0.12)" : "transparent",
                  fontWeight: active ? 500 : 400,
                  fontSize: 13,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "rgba(255,255,255,0.38)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {/* Active indicator */}
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                    style={{ background: "#6366f1" }}
                  />
                )}

                <Icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: active ? "#6366f1" : "inherit" }}
                />

                {/* Label — hidden when collapsed */}
                <span
                  className="whitespace-nowrap transition-all duration-200"
                  style={{
                    opacity: collapsed ? 0 : 1,
                    width: collapsed ? 0 : "auto",
                    overflow: "hidden",
                  }}
                >
                  {label}
                </span>

                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div
                    className="absolute left-full ml-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium pointer-events-none z-50
                      opacity-0 group-hover/nav:opacity-100 transition-opacity duration-100 whitespace-nowrap"
                    style={{
                      background: "#1e1e25",
                      color: "rgba(255,255,255,0.85)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                    }}
                  >
                    {label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom — user + expand toggle */}
        <div
          className="shrink-0 flex flex-col gap-2.5"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            padding: collapsed ? "12px 8px" : "12px 16px",
          }}
        >
          {/* Org */}
          {organization && !collapsed && (
            <div className="flex items-center gap-2">
              {organization.imageUrl ? (
                <img
                  src={organization.imageUrl}
                  alt={organization.name}
                  className="w-5 h-5 rounded-md shrink-0"
                />
              ) : (
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    background: "rgba(99,102,241,0.2)",
                    color: "#818cf8",
                  }}
                >
                  {organization.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className="text-xs truncate"
                style={{ color: "rgba(255,255,255,0.32)" }}
              >
                {organization.name}
              </span>
            </div>
          )}

          {/* User button */}
          <div
            className="flex items-center gap-2.5"
            style={{ justifyContent: collapsed ? "center" : "flex-start" }}
          >
            <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
            {!collapsed && (
              <span
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.32)" }}
              >
                Account
              </span>
            )}
          </div>

          {/* Expand button — only shows when collapsed */}
          {collapsed && (
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-colors"
              style={{ color: "rgba(255,255,255,0.25)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.25)";
                e.currentTarget.style.background = "transparent";
              }}
              title="Expand sidebar"
            >
              <ChevronsRightIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile bottom tab — unchanged */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-center"
        style={{
          background: "rgba(10,10,12,0.95)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors"
              style={{ color: active ? "#6366f1" : "rgba(255,255,255,0.3)" }}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
