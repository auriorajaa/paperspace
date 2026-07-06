// convex/validations.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

const MAX_GEMINI_CALLS_PER_DAY = 15; // per user — tune as needed

export const getCached = query({
  args: { contentHash: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("documentValidations")
      .withIndex("by_content_hash", (q) =>
        q.eq("contentHash", args.contentHash)
      )
      .first();
  },
});

export const checkRateLimit = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const recent = await ctx.db
      .query("documentValidations")
      .withIndex("by_owner_and_date", (q) =>
        q.eq("ownerId", identity.subject).gt("createdAt", since)
      )
      .filter((q) => q.eq(q.field("method"), "gemini"))
      .collect();
    return recent.length < MAX_GEMINI_CALLS_PER_DAY;
  },
});

export const record = mutation({
  args: {
    contentHash: v.string(),
    verdict: v.string(),
    reason: v.string(),
    method: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    await ctx.db.insert("documentValidations", {
      ...args,
      ownerId: identity.subject,
      createdAt: Date.now(),
    });
  },
});
