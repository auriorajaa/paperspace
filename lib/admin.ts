// lib\admin.ts
import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import type { User } from "@clerk/backend";
import { ADMIN_EMAIL, INACTIVE_WARNING_DAYS, INACTIVE_DELETE_DAYS } from "./constants";

export { ADMIN_EMAIL, INACTIVE_WARNING_DAYS, INACTIVE_DELETE_DAYS };

export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ResourceCounts = {
  docCounts?: Record<string, number>;
  templateCounts?: Record<string, number>;
  formCounts?: Record<string, number>;
  collectionCounts?: Record<string, number>;
  submissionCounts?: Record<string, number>;
  generatedDocumentCounts?: Record<string, number>;
};

export type OwnerInfo = { name: string; email: string; imageUrl: string };

export function getPrimaryEmail(user: User) {
  return (
    user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
      ?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    ""
  );
}

export function getDisplayName(user: User) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.username || getPrimaryEmail(user) || "Unnamed user";
}

export function isAdminUser(user: User) {
  return (
    user.publicMetadata?.role === "admin" ||
    getPrimaryEmail(user) === ADMIN_EMAIL
  );
}

export function getLastActivityAt(user: User) {
  return user.lastSignInAt ?? user.createdAt;
}

export function daysSince(timestamp: number, now = Date.now()) {
  return Math.floor((now - timestamp) / (24 * 60 * 60 * 1000));
}

export function formatAdminUser(user: User, counts: ResourceCounts = {}) {
  const email = getPrimaryEmail(user);
  const lastActivityAt = getLastActivityAt(user);

  return {
    id: user.id,
    name: getDisplayName(user),
    email,
    imageUrl: user.imageUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignInAt: user.lastSignInAt,
    lastActiveAt: user.lastActiveAt,
    lastActivityAt,
    inactiveDays: daysSince(lastActivityAt),
    banned: user.banned,
    locked: user.locked,
    role: user.publicMetadata?.role ?? null,
    warningSentAt:
      typeof user.privateMetadata?.inactivityWarningSentAt === "number"
        ? user.privateMetadata.inactivityWarningSentAt
        : null,
    counts: {
      documents: counts.docCounts?.[user.id] ?? 0,
      templates: counts.templateCounts?.[user.id] ?? 0,
      forms: counts.formCounts?.[user.id] ?? 0,
      collections: counts.collectionCounts?.[user.id] ?? 0,
      submissions: counts.submissionCounts?.[user.id] ?? 0,
      generatedDocuments: counts.generatedDocumentCounts?.[user.id] ?? 0,
    },
  };
}

export async function requireAdminRequest() {
  const session = await auth();
  if (!session.userId) {
    throw new AdminApiError(401, "Not authenticated");
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(session.userId);
  if (!isAdminUser(user)) {
    throw new AdminApiError(403, "Admin access required");
  }

  return { clerk, session, user };
}

export async function createAdminConvexClient(
  getToken: (options?: { template?: string }) => Promise<string | null>
) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new AdminApiError(500, "NEXT_PUBLIC_CONVEX_URL is not configured");
  }

  const convex = new ConvexHttpClient(convexUrl);
  const token = await getToken({ template: "convex" });
  if (token) convex.setAuth(token);
  return convex;
}

export function getInternalApiSecret() {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new AdminApiError(500, "INTERNAL_API_SECRET is not configured");
  }
  return secret;
}

/**
 * Resolves a set of Clerk user IDs into display info (name/email/avatar).
 * Used to turn raw ownerId fields from Convex rows into something readable
 * across admin/content, admin/activity, and any future owner-keyed view.
 * Clerk's getUserList caps at 500 user_id filters per call, so we chunk.
 */
export async function buildOwnerNameMap(
  clerk: Awaited<ReturnType<typeof clerkClient>>,
  ownerIds: Iterable<string>
): Promise<Record<string, OwnerInfo>> {
  const ids = [...new Set(ownerIds)].filter(Boolean);
  const map: Record<string, OwnerInfo> = {};
  if (ids.length === 0) return map;

  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const page = await clerk.users.getUserList({
        userId: chunk,
        limit: chunk.length,
      });
      for (const user of page.data) {
        map[user.id] = {
          name: getDisplayName(user),
          email: getPrimaryEmail(user),
          imageUrl: user.imageUrl,
        };
      }
    } catch {
      // Skip chunk on failure; callers fall back to "Unknown user" for missing entries.
    }
  }
  return map;
}

export function resolveOwner(
  map: Record<string, OwnerInfo>,
  ownerId: string | undefined
): OwnerInfo {
  if (!ownerId) return { name: "Unknown user", email: "", imageUrl: "" };
  return map[ownerId] ?? { name: "Deleted user", email: ownerId, imageUrl: "" };
}
