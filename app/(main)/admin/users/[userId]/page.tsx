// app\(main)\admin\users\[userId]\page.tsx
import UserDetailClient from "./user-detail-client";

type PageProps = { params: Promise<{ userId: string }> };

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params;
  return <UserDetailClient userId={userId} />;
}