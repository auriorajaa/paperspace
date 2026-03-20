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
      expiresAt: account.expiresAt,
    };
  },
});

// ── Public mutations ──────────────────────────────────────────────────────────

export const upsert = mutation({
  args: {
    ownerId: v.string(),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", args.ownerId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
      });
      return existing._id;
    }
    return ctx.db.insert("googleAccounts", args);
  },
});

export const updateToken = mutation({
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
    if (!identity) throw new ConvexError("Not authenticated");
    const account = await ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .first();
    if (account) await ctx.db.delete(account._id);
  },
});

// ── Server-side query (called from Next.js API routes, already Clerk-protected) ──

export const getFullAccountForServer = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    // This query is intentionally called from server-side API routes
    // that have already verified the user via Clerk auth.
    return ctx.db
      .query("googleAccounts")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", args.ownerId))
      .first();
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
