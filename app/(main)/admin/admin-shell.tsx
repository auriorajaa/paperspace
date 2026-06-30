// app\(main)\admin\admin-shell.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldIcon,
  LayoutDashboardIcon,
  UsersIcon,
  DatabaseIcon,
  ActivityIcon,
} from "lucide-react";

type AdminTab = {
  href: string;
  label: string;
  icon: typeof ShieldIcon;
  exact?: boolean;
};

const TABS: AdminTab[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    exact: true,
  },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/content", label: "Content", icon: DatabaseIcon },
  // { href: "/admin/activity", label: "Activity", icon: ActivityIcon },
];

function isTabActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="sticky top-0 z-30 shrink-0 pt-[calc(42px+1rem)] pb-3 sm:pt-3 sm:pb-0"
        style={{
          background: "var(--bg-sidebar)",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="flex w-full max-w-7xl items-center gap-3 px-4 py-1 sm:py-3 md:px-8">
          <div className="min-w-0">
            <p
              className="flex items-center gap-1.5 text-[14.5px] font-semibold uppercase"
              style={{ color: "var(--accent-light)" }}
            >
              Paperspace Admin
            </p>
            <p
              className="mt-0.5 truncate text-[12px] sm:text-[13px]"
              style={{ color: "var(--text-muted)" }}
            >
              System control panel — users, content, and platform health
            </p>
          </div>
        </div>

        <div
          className="flex w-full max-w-7xl gap-1 overflow-x-auto px-4 pb-2.5 pt-2 sm:pb-2.5 md:px-8"
          style={{ scrollbarWidth: "none" }}
        >
          {TABS.map(({ href, label, icon: Icon, exact }) => {
            const active = isTabActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[12.5px] font-medium transition-all"
                style={{
                  background: active ? "var(--accent-bg)" : "transparent",
                  color: active ? "var(--accent-light)" : "var(--text-muted)",
                  border: `1px solid ${active ? "var(--accent-border)" : "transparent"}`,
                }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1 pb-[calc(env(safe-area-inset-bottom)+52px)] md:pb-0">
        {children}
      </div>
    </div>
  );
}
