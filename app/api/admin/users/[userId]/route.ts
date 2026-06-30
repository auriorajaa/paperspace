// app\api\admin\users\[userId]\route.ts
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  ADMIN_EMAIL,
  AdminApiError,
  createAdminConvexClient,
  formatAdminUser,
  getInternalApiSecret,
  getPrimaryEmail,
  requireAdminRequest,
} from "@/lib/admin";
import { sendUserNotification } from "@/lib/admin-email";
import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

type RouteContext = { params: Promise<{ userId: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const { clerk, session } = await requireAdminRequest();
    const convex = await createAdminConvexClient(session.getToken);
    const [user, resources] = await Promise.all([
      clerk.users.getUser(userId),
      convex.query(api.admin.getUserResources, { targetUserId: userId }),
    ]);

    return NextResponse.json({ user: formatAdminUser(user), resources });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/users/detail]", error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const { clerk, session, user: adminUser } = await requireAdminRequest();

    if (userId === adminUser.id) {
      return NextResponse.json({ error: "You cannot delete your own admin account" }, { status: 400 });
    }

    const targetUser = await clerk.users.getUser(userId);
    if (getPrimaryEmail(targetUser) === ADMIN_EMAIL) {
      return NextResponse.json({ error: "The primary admin account cannot be deleted" }, { status: 400 });
    }

    if (getPrimaryEmail(adminUser) !== ADMIN_EMAIL && targetUser.publicMetadata?.role === "admin") {
      return NextResponse.json({ error: "Admins cannot delete other admins" }, { status: 403 });
    }

    const convex = await createAdminConvexClient(session.getToken);
    const cleanup = await convex.mutation(api.admin.cleanupUserData, {
      targetUserId: userId,
    });
    await clerk.users.deleteUser(userId);

    return NextResponse.json({ success: true, deletedUserId: userId, cleanup });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/users/delete]", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

export async function PATCH(_req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const { clerk, session, user: adminUser } = await requireAdminRequest();

    if (getPrimaryEmail(adminUser) !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Only the primary admin can manage admin roles" }, { status: 403 });
    }

    const body = await _req.json();
    const role: string | null = body.role ?? null;

    if (role !== "admin" && role !== null) {
      return NextResponse.json({ error: "Invalid role. Must be 'admin' or null" }, { status: 400 });
    }

    if (userId === adminUser.id) {
      return NextResponse.json({ error: "You cannot change your own admin role" }, { status: 400 });
    }

    const targetUser = await clerk.users.getUser(userId);
    if (getPrimaryEmail(targetUser) === ADMIN_EMAIL) {
      return NextResponse.json({ error: "The primary admin role cannot be changed" }, { status: 400 });
    }

    await clerk.users.updateUser(userId, { publicMetadata: { role } });

    // Sync the Convex admin whitelist (JWT doesn't carry publicMetadata.role).
    // These mutations use system auth (internal secret) so they work even when
    // the caller's Convex JWT lacks the email claim.
    if (CONVEX_URL) {
      const convex = new ConvexHttpClient(CONVEX_URL);
      const token = await session.getToken({ template: "convex" });
      if (token) convex.setAuth(token);

      const secret = getInternalApiSecret();

      // Whitelist the caller (original admin) so their Convex JWT works too.
      await convex.mutation(api.admin.addAdminToWhitelist, {
        userId: adminUser.id,
        secret,
      });

      if (role === "admin") {
        await convex.mutation(api.admin.addAdminToWhitelist, { userId, secret });
      } else {
        await convex.mutation(api.admin.removeAdminFromWhitelist, { userId, secret });
      }
    }

    const updatedUser = await clerk.users.getUser(userId);
    return NextResponse.json({ success: true, user: formatAdminUser(updatedUser) });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/users/role]", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const { clerk } = await requireAdminRequest();

    const body = await _req.json();
    const reason: string = body.reason ?? "General notification";
    const message: string = body.message;
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const user = await clerk.users.getUser(userId);
    const result = await sendUserNotification(user, `Paperspace — ${reason}`, message.trim());

    return NextResponse.json({ success: result.sent, sent: result.sent });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/users/notify]", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}