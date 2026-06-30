// app\(main)\admin\layout.tsx
import { AdminGuard } from "@/components/AdminGuard";
import { AdminShell } from "./admin-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
