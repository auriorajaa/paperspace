// components\AdminGuard.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { ShieldIcon } from "lucide-react";
import { ADMIN_EMAIL } from "@/lib/constants";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const isAdmin =
    user?.publicMetadata?.role === "admin" ||
    user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      toast.error("Admin access required");
      router.replace("/home");
    }
  }, [isLoaded, isAdmin, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
        >
          <ShieldIcon className="h-4 w-4" />
          Checking admin access...
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;
  return <>{children}</>;
}