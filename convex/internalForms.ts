/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

function generatePublicId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── Queries ────────────────────────────────────────────────────────────────

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const forms = await ctx.db
      .query("internalForms")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();
    const withCounts = await Promise.all(
      forms.map(async (f) => {
        const responses = await ctx.db
          .query("internalFormResponses")
          .withIndex("by_form_id", (q) => q.eq("formId", f._id))
          .collect();
        const connections = await ctx.db
          .query("formConnections")
          .withIndex("by_internal_form_id", (q) =>
            q.eq("internalFormId", f._id)
          )
          .collect();
        return {
          ...f,
          responseCount: responses.length,
          connectionCount: connections.length,
        };
      })
    );
    return withCounts;
  },
});

export const getById = query({
  args: { id: v.id("internalForms") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const form = await ctx.db.get(args.id);
    if (!form || form.ownerId !== identity.subject) return null;
    return form;
  },
});

export const getByPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("internalForms")
      .withIndex("by_public_id", (q) => q.eq("publicId", args.publicId))
      .first();
    if (!form || form.status !== "published") return null;
    return {
      _id: form._id,
      title: form.title,
      description: form.description,
      schema: form.schema,
      settings: form.settings,
    };
  },
});

// ── Mutations ──────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    schema: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        type: v.string(),
        required: v.boolean(),
        options: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const publicId = generatePublicId();
    return ctx.db.insert("internalForms", {
      ownerId: identity.subject,
      title: args.title,
      description: args.description,
      schema: args.schema,
      status: "draft",
      publicId,
      settings: {
        acceptResponses: false,
      },
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("internalForms"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    schema: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          type: v.string(),
          required: v.boolean(),
          options: v.optional(v.array(v.string())),
        })
      )
    ),
    settings: v.optional(
      v.object({
        acceptResponses: v.boolean(),
        confirmationMessage: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const form = await ctx.db.get(args.id);
    if (!form || form.ownerId !== identity.subject)
      throw new ConvexError("Not found");

    const { id, ...rest } = args;
    const patch: Record<string, unknown> = {};
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) patch[k] = v;
    });
    await ctx.db.patch(id, patch);
  },
});

export const publish = mutation({
  args: { id: v.id("internalForms") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const form = await ctx.db.get(args.id);
    if (!form || form.ownerId !== identity.subject)
      throw new ConvexError("Not found");

    await ctx.db.patch(args.id, {
      status: "published",
      settings: { ...form.settings, acceptResponses: true },
    });
  },
});

export const archive = mutation({
  args: { id: v.id("internalForms") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const form = await ctx.db.get(args.id);
    if (!form || form.ownerId !== identity.subject)
      throw new ConvexError("Not found");

    await ctx.db.patch(args.id, {
      status: "archived",
      settings: { ...form.settings, acceptResponses: false },
    });
  },
});

export const remove = mutation({
  args: { id: v.id("internalForms") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const form = await ctx.db.get(args.id);
    if (!form || form.ownerId !== identity.subject)
      throw new ConvexError("Not found");

    const responses = await ctx.db
      .query("internalFormResponses")
      .withIndex("by_form_id", (q) => q.eq("formId", args.id))
      .collect();
    await Promise.all(responses.map((r) => ctx.db.delete(r._id)));

    const connections = await ctx.db
      .query("formConnections")
      .withIndex("by_internal_form_id", (q) =>
        q.eq("internalFormId", args.id)
      )
      .collect();
    await Promise.all(
      connections.map(async (c) => {
        const submissions = await ctx.db
          .query("formSubmissions")
          .withIndex("by_connection_id", (q) => q.eq("connectionId", c._id))
          .collect();
        await Promise.all(
          submissions.map(async (s) => {
            if (s.storageId) {
              try {
                await ctx.storage.delete(s.storageId as any);
              } catch {}
            }
            await ctx.db.delete(s._id);
          })
        );
        await ctx.db.delete(c._id);
      })
    );

    await ctx.db.delete(args.id);
  },
});
