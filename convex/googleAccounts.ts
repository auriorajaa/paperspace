import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { ConvexError } from "convex/values";

// ── Public queries (require auth) ─────────────────────────────────────────────

export const getMyAccount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const account = await ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .first();
    if (!account) return null;
    // Don't expose tokens to client
    return {
      _id: account._id,
      email: account.email,
      clerkEmail: account.clerkEmail ?? null,
      expiresAt: account.expiresAt,
    };
  },
});

/**
 * SECURITY FIX: Replaces the old `getFullAccountForServer` which accepted an
 * arbitrary `ownerId` param — allowing any authenticated user to fetch
 * anyone else's Google tokens if they knew the target's Clerk userId.
 *
 * This version derives the owner from the Convex auth identity, which is
 * populated by the Clerk JWT forwarded via `convex.setAuth(token)` in the
 * calling Next.js API route.
 *
 * Callers must set auth on ConvexHttpClient before calling:
 *   const token = await getToken({ template: "convex" });
 *   convex.setAuth(token!);
 */
export const getMyFullAccount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .first();
  },
});

// ── Public mutations ──────────────────────────────────────────────────────────

/**
 * Upserts a Google account. Called from the OAuth callback route where a
 * Clerk JWT is forwarded via convex.setAuth(), so ownerId is derived from
 * the verified identity — not from caller-supplied args.
 */
export const upsert = mutation({
  args: {
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    clerkEmail: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const ownerId = identity.subject;
    const existing = await ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", ownerId))
      .first();

    // ADDED: save clerkEmail if existed, null if not
    const clerkEmailPatch =
      args.clerkEmail !== undefined
        ? { clerkEmail: args.clerkEmail ?? undefined }
        : {};

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        accessToken: args.accessToken,
        // Only update refreshToken if a new one was issued (Google only
        // sends it on first consent; omit update if empty to keep the old one)
        ...(args.refreshToken ? { refreshToken: args.refreshToken } : {}),
        expiresAt: args.expiresAt,
        ...clerkEmailPatch,
      });
      return existing._id;
    }

    return ctx.db.insert("googleAccounts", {
      ownerId,
      email: args.email,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      ...clerkEmailPatch, // ADDED
    });
  },
});

/**
 * SECURITY FIX: Previous version accepted `ownerId` as a plain arg with no
 * identity check, allowing any caller to overwrite another user's token.
 * Now derives ownerId from the verified Clerk JWT identity.
 *
 * Callers must set auth on ConvexHttpClient before calling:
 *   convex.setAuth(await getToken({ template: "convex" }));
 */
export const updateToken = mutation({
  args: {
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const account = await ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .first();
    if (!account) throw new ConvexError("Google account not found");

    await ctx.db.patch(account._id, {
      accessToken: args.accessToken,
      expiresAt: args.expiresAt,
    });
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const account = await ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .first();
    if (account) await ctx.db.delete(account._id);
  },
});

// ── Internal queries/mutations (for Convex actions/crons) ─────────────────────

export const getByOwnerInternal = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", args.ownerId))
      .first();
  },
});

export const updateTokenInternal = internalMutation({
  args: {
    ownerId: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", args.ownerId))
      .first();
    if (!account) return;
    await ctx.db.patch(account._id, {
      accessToken: args.accessToken,
      expiresAt: args.expiresAt,
    });
  },
});
