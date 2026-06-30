// app\api\admin\content\route.ts
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  AdminApiError,
  buildOwnerNameMap,
  createAdminConvexClient,
  requireAdminRequest,
  resolveOwner,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

type Tab = "documents" | "templates" | "forms";

export async function GET(req: NextRequest) {
  try {
    const { clerk, session } = await requireAdminRequest();
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get("tab") as Tab) ?? "documents";
    if (!["documents", "templates", "forms"].includes(tab)) {
      return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 25), 1), 100);
    const cursor = searchParams.get("cursor") || undefined;

    const convex = await createAdminConvexClient(session.getToken);
    const result = await convex.query(api.admin.getContentPage, { tab, cursor, limit });

    const ownerMap = result.page.length > 0
      ? await buildOwnerNameMap(clerk, result.page.map((r: any) => r.ownerId))
      : {};

    const rows = result.page.map((row: any) => {
      const owner = resolveOwner(ownerMap, row.ownerId);
      return {
        ...row,
        ownerName: owner.name,
        ownerEmail: owner.email,
        ownerImageUrl: owner.imageUrl,
      };
    });

    return NextResponse.json({
      tab,
      rows,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("[admin/content]", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
