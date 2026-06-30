// app\api\admin\cron\cleanup\route.ts
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { clerkClient } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import {
  ADMIN_EMAIL,
  AdminApiError,
  INACTIVE_DELETE_DAYS,
  INACTIVE_WARNING_DAYS,
  daysSince,
  getInternalApiSecret,
  getLastActivityAt,
  getPrimaryEmail,
  isAdminUser,
} from "@/lib/admin";
import {
  sendInactiveDeletedEmail,
  sendInactiveWarningEmail,
} from "@/lib/admin-email";

export const dynamic = "force-dynamic";

type CleanupResult = {
  scanned: number;
  warned: number;
  warningSkipped: number;
  deleted: number;
  errors: Array<{ userId: string; error: string }>;
};

function isAuthorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret");
  return token === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) throw new AdminApiError(500, "NEXT_PUBLIC_CONVEX_URL is not configured");

    const internalSecret = getInternalApiSecret();
    const clerk = await clerkClient();
    const convex = new ConvexHttpClient(convexUrl);
    const result: CleanupResult = { scanned: 0, warned: 0, warningSkipped: 0, deleted: 0, errors: [] };

    let offset = 0;
    const limit = 100;
    while (true) {
      const page = await clerk.users.getUserList({ limit, offset, orderBy: "last_sign_in_at" });
      if (page.data.length === 0) break;

      for (const user of page.data) {
        result.scanned += 1;
        const email = getPrimaryEmail(user);
        if (isAdminUser(user) || email === ADMIN_EMAIL) continue;

        const inactiveDays = daysSince(getLastActivityAt(user));
        const warningSentAt =
          typeof user.privateMetadata?.inactivityWarningSentAt === "number"
            ? user.privateMetadata.inactivityWarningSentAt
            : null;

        try {
          if (inactiveDays >= INACTIVE_DELETE_DAYS) {
            await convex.mutation(api.admin.cleanupUserDataFromSystem, {
              targetUserId: user.id,
              secret: internalSecret,
            });
            await clerk.users.deleteUser(user.id);
            await sendInactiveDeletedEmail(user).catch(() => ({ sent: false }));
            result.deleted += 1;
            continue;
          }

          if (inactiveDays >= INACTIVE_WARNING_DAYS) {
            if (warningSentAt) {
              result.warningSkipped += 1;
              continue;
            }

            const daysLeft = Math.max(INACTIVE_DELETE_DAYS - inactiveDays, 1);
            const mail = await sendInactiveWarningEmail(user, daysLeft);
            await clerk.users.updateUserMetadata(user.id, {
              privateMetadata: {
                inactivityWarningSentAt: Date.now(),
                inactivityWarningEmailSent: mail.sent,
                inactivityWarningSkipReason: mail.skipped ?? null,
              },
            });
            if (mail.sent) result.warned += 1;
            else result.warningSkipped += 1;
          }
        } catch (error) {
          result.errors.push({
            userId: user.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      offset += page.data.length;
      if (offset >= page.totalCount) break;
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/cron/cleanup]", error);
    return NextResponse.json({ error: "Inactive cleanup failed" }, { status: 500 });
  }
}