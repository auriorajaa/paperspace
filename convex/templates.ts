import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internalMutation } from "./_generated/server";

const fieldSchema = v.object({
  id: v.string(),
  name: v.string(),
  label: v.string(),
  type: v.string(),
  required: v.boolean(),
  placeholder: v.string(),
  subFields: v.optional(
    v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        label: v.string(),
        type: v.string(),
        required: v.boolean(),
        placeholder: v.string(),
      })
    )
  ),
});

// ── Queries ───────────────────────────────────────────────────────────────────

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db
      .query("templates")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db
      .query("templates")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .take(args.limit ?? 4);
  },
});

export const getById = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db.get(args.id);
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    storageId: v.string(),
    fileUrl: v.string(),
    description: v.optional(v.string()),
    previewText: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    fields: v.array(fieldSchema),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db.insert("templates", {
      name: args.name,
      ownerId: identity.subject,
      organizationId: args.organizationId,
      storageId: args.storageId,
      fileUrl: args.fileUrl,
      description: args.description,
      previewText: args.previewText,
      fields: args.fields,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("templates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    previewText: v.optional(v.string()),
    fields: v.optional(v.array(fieldSchema)),
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const template = await ctx.db.get(args.id);
    if (!template) throw new ConvexError("Template not found");
    if (template.ownerId !== identity.subject)
      throw new ConvexError("You don't have access to this template");

    const { id, ...fields } = args;
    const patch: Record<string, unknown> = {};
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined) patch[k] = v;
    });

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const template = await ctx.db.get(args.id);
    if (!template) throw new ConvexError("Template not found");
    if (template.ownerId !== identity.subject)
      throw new ConvexError("You don't have access to this template");

    try {
      await ctx.storage.delete(template.storageId as any);
    } catch (e) {
      console.error("Storage delete failed", e);
    }

    await ctx.db.delete(args.id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveGeneratedDocument = mutation({
  args: {
    templateId: v.id("templates"),
    title: v.string(),
    fieldValues: v.any(),
    format: v.string(),
    isBulk: v.boolean(),
    bulkCount: v.optional(v.number()),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db.insert("generatedDocuments", {
      templateId: args.templateId,
      ownerId: identity.subject,
      organizationId: args.organizationId,
      title: args.title,
      fieldValues: args.fieldValues,
      format: args.format,
      isBulk: args.isBulk,
      bulkCount: args.bulkCount,
    });
  },
});

// ── Internal mutations (dipanggil dari HTTP actions, tanpa auth) ──────────────

export const updateFileStorageInternal = internalMutation({
  args: {
    id: v.id("templates"),
    storageId: v.string(),
    fileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      storageId: args.storageId,
      fileUrl: args.fileUrl,
    });
  },
});