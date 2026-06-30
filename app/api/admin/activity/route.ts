// app\api\admin\activity\route.ts
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  AdminApiError,
  buildOwnerNameMap,
  createAdminConvexClient,
  requireAdminRequest,
  resolveOwner,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { clerk, session } = await requireAdminRequest();
    const convex = await createAdminConvexClient(session.getToken);
    const activity = await convex.query(api.admin.getRecentActivity);

    const ownerMap = await buildOwnerNameMap(
      clerk,
      activity.map((a) => a.ownerId)
    );

    const enriched = activity.map((item) => {
      const owner = resolveOwner(ownerMap, item.ownerId);
      return {
        ...item,
        ownerName: owner.name,
        ownerEmail: owner.email,
        ownerImageUrl: owner.imageUrl,
      };
    });

    return NextResponse.json({ activity: enriched });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("[admin/activity]", error);
    return NextResponse.json(
      { error: "Failed to load activity" },
      { status: 500 }
    );
  }
}
