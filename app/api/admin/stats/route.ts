// app\api\admin\stats\route.ts
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  AdminApiError,
  createAdminConvexClient,
  formatAdminUser,
  requireAdminRequest,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { clerk, session } = await requireAdminRequest();
    const convex = await createAdminConvexClient(session.getToken);

    const [cachedStats, usersPage, recentUsers] = await Promise.all([
      convex.query(api.admin.getCachedStats),
      clerk.users.getUserList({ limit: 1 }),
      clerk.users.getUserList({ limit: 8, orderBy: "-created_at" }),
    ]);

    const convexStats = cachedStats ?? {
      documentsCount: 0,
      collectionsCount: 0,
      templatesCount: 0,
      formsCount: 0,
      submissionsCount: 0,
      generatedDocumentsCount: 0,
      formConnectionsCount: 0,
      googleAccountsCount: 0,
      totalUsersWithData: 0,
      usersWithDocuments: 0,
      usersWithTemplates: 0,
      usersWithForms: 0,
    };

    return NextResponse.json({
      ...convexStats,
      usersCount: usersPage.totalCount,
      recentUsers: recentUsers.data.map((user) => formatAdminUser(user)),
    });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/stats]", error);
    return NextResponse.json({ error: "Failed to load admin stats" }, { status: 500 });
  }
}