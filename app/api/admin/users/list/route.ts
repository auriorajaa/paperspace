// app\api\admin\users\list\route.ts
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  AdminApiError,
  createAdminConvexClient,
  formatAdminUser,
  requireAdminRequest,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { clerk, session } = await requireAdminRequest();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 100);
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
    const query = searchParams.get("query")?.trim() || undefined;

    const convex = await createAdminConvexClient(session.getToken);
    const usersPage = await clerk.users.getUserList({
      limit,
      offset,
      query,
      orderBy: "-last_sign_in_at",
    });

    const userIds = usersPage.data.map((u) => u.id);
    const counts = userIds.length > 0
      ? await convex.query(api.admin.getCountsForUsers, { userIds })
      : { docCounts: {}, templateCounts: {}, formCounts: {}, collectionCounts: {}, submissionCounts: {}, generatedDocumentCounts: {} };

    return NextResponse.json({
      users: usersPage.data.map((user) => formatAdminUser(user, counts)),
      totalCount: usersPage.totalCount,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/users/list]", error);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}