/* eslint-disable @typescript-eslint/no-explicit-any */
// convex/templates.ts
import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
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
    if (!identity) return [];

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
    if (!identity) return [];

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
    if (!identity) return null;

    const template = await ctx.db.get(args.id);
    if (!template) return null;

    const orgId = (identity as any).organization_id as string | undefined;
    const isOwner = template.ownerId === identity.subject;
    const isOrgMember =
      !!orgId && !!template.organizationId && template.organizationId === orgId;

    if (!isOwner && !isOrgMember) return null;

    return template;
  },
});

export const getGeneratedCount = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    // SECURITY: Verify the user actually owns or belongs to the org of this template
    const template = await ctx.db.get(args.templateId);
    if (!template) return 0;

    const orgId = (identity as any).organization_id as string | undefined;
    const isOwner = template.ownerId === identity.subject;
    const isOrgMember =
      !!orgId && !!template.organizationId && template.organizationId === orgId;

    if (!isOwner && !isOrgMember) return 0;

    const docs = await ctx.db
      .query("generatedDocuments")
      .withIndex("by_template_id", (q) => q.eq("templateId", args.templateId))
      .collect();
    return docs.length;
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
    tags: v.optional(v.array(v.string())),
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
      tags: args.tags ?? [],
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
    tags: v.optional(v.array(v.string())),
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

    // ── Cascade: deactivate & flag all form connections using this template ──
    // Connections are marked templateDeleted=true so the frontend can show a
    // clear "Template Deleted" state rather than confusing sync errors. We do
    // NOT delete the connections or their submissions — the user may still
    // want to view or download previously generated documents.
    const now = Date.now();
    const connections = await ctx.db
      .query("formConnections")
      .withIndex("by_template_id", (q) => q.eq("templateId", args.id))
      .collect();

    await Promise.all(
      connections.map((conn) =>
        ctx.db.patch(conn._id, {
          isActive: false,
          templateDeleted: true,
          templateDeletedAt: now,
        })
      )
    );

    // ── Delete the template file from storage ────────────────────────────────
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

    // SECURITY: Verify user actually owns this template before saving generated doc
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new ConvexError("Template not found");

    const orgId = (identity as any).organization_id as string | undefined;
    const isOwner = template.ownerId === identity.subject;
    const isOrgMember =
      !!orgId && !!template.organizationId && template.organizationId === orgId;

    if (!isOwner && !isOrgMember) {
      throw new ConvexError("You don't have access to this template");
    }

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

export const deleteStorage = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    try {
      await ctx.storage.delete(args.storageId as any);
    } catch (e) {
      console.error("Storage delete failed", e);
      throw new ConvexError("Failed to delete storage");
    }
  },
});

export const getByIdInternal = internalQuery({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const getTemplateByScriptToken = query({
  args: { scriptToken: v.string() },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("formConnections")
      .withIndex("by_script_token", (q) =>
        q.eq("scriptToken", args.scriptToken)
      )
      .first();

    if (!connection || !connection.isActive) return null;

    const template = await ctx.db.get(connection.templateId);
    if (!template) return null;

    return {
      storageId: template.storageId,
      fields: template.fields,
    };
  },
});

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
