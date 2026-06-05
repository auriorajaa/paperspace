/* eslint-disable @typescript-eslint/no-explicit-any */
// convex/templates.ts
import { v } from "convex/values";
import { action, mutation, query, internalQuery } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const fieldSchema = v.object({
  id: v.string(),
  name: v.string(),
  label: v.string(),
  type: v.string(),
  required: v.boolean(),
  placeholder: v.string(),
  confidence: v.optional(v.number()),
  source: v.optional(v.string()),
  targetText: v.optional(v.string()),
  contextText: v.optional(v.string()),
  replacementText: v.optional(v.string()),
  originalPlaceholder: v.optional(v.string()),
  subFields: v.optional(
    v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        label: v.string(),
        type: v.string(),
        required: v.boolean(),
        placeholder: v.string(),
        confidence: v.optional(v.number()),
        source: v.optional(v.string()),
        targetText: v.optional(v.string()),
        contextText: v.optional(v.string()),
        replacementText: v.optional(v.string()),
        originalPlaceholder: v.optional(v.string()),
      })
    )
  ),
});

// ── Queries ───────────────────────────────────────────────────────────────────

function getOrgId(identity: any): string | undefined {
  return identity.organization_id as string | undefined;
}

function hasTemplateAccess(
  template: { ownerId: string; organizationId?: string },
  identity: any
): boolean {
  if (template.ownerId === identity.subject) return true;
  const orgId = getOrgId(identity);
  return !!(
    orgId &&
    template.organizationId &&
    template.organizationId === orgId
  );
}

function sanitizeTemplateForIdentity<
  T extends { ownerId: string; tags?: string[] },
>(template: T, identity: any) {
  const isOwner = template.ownerId === identity.subject;
  return {
    ...template,
    tags: isOwner ? (template.tags ?? []) : [],
    isOwner,
    accessLevel: isOwner ? "owner" : "org",
  };
}

async function getAccessibleTemplates(ctx: any, identity: any) {
  const orgId = getOrgId(identity);

  const personalTemplates = await ctx.db
    .query("templates")
    .withIndex("by_owner_id", (q: any) => q.eq("ownerId", identity.subject))
    .order("desc")
    .collect();

  let orgTemplates: typeof personalTemplates = [];
  if (orgId) {
    orgTemplates = await ctx.db
      .query("templates")
      .withIndex("by_organization_id", (q: any) =>
        q.eq("organizationId", orgId)
      )
      .order("desc")
      .collect();
  }

  const seen = new Set<string>();
  return [...personalTemplates, ...orgTemplates]
    .filter((template) => {
      if (seen.has(template._id)) return false;
      seen.add(template._id);
      return true;
    })
    .sort((a, b) => b._creationTime - a._creationTime)
    .map((template) => sanitizeTemplateForIdentity(template, identity));
}

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return getAccessibleTemplates(ctx, identity);
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const all = await getAccessibleTemplates(ctx, identity);
    return all.slice(0, args.limit ?? 4);
  },
});

export const getById = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const template = await ctx.db.get(args.id);
    if (!template) return null;

    // Templates are strictly owner-only — org membership is not enough.
    if (!hasTemplateAccess(template, identity)) return null;

    return sanitizeTemplateForIdentity(template, identity);
  },
});

export const getEditableById = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const template = await ctx.db.get(args.id);
    if (!template) return null;
    if (template.ownerId !== identity.subject) return null;

    return sanitizeTemplateForIdentity(template, identity);
  },
});

export const getGeneratedCount = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    // Templates are strictly owner-only.
    const template = await ctx.db.get(args.templateId);
    if (!template) return 0;
    if (!hasTemplateAccess(template, identity)) return 0;

    const docs = await ctx.db
      .query("generatedDocuments")
      .withIndex("by_template_id", (q) => q.eq("templateId", args.templateId))
      .collect();
    return template.ownerId === identity.subject
      ? docs.length
      : docs.filter((doc) => doc.ownerId === identity.subject).length;
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
    sourceFileType: v.optional(v.string()),
    // organizationId intentionally omitted — templates are personal only.
    tags: v.optional(v.array(v.string())),
    fields: v.array(fieldSchema),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db.insert("templates", {
      name: args.name,
      ownerId: identity.subject,
      organizationId: getOrgId(identity),
      storageId: args.storageId,
      fileUrl: args.fileUrl,
      description: args.description,
      previewText: args.previewText,
      sourceFileType: args.sourceFileType,
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
    sourceFileType: v.optional(v.string()),
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

    // FIX: Hapus file lama jika user upload file template baru.
    if (args.storageId && args.storageId !== template.storageId) {
      try {
        await ctx.storage.delete(template.storageId as any);
      } catch (e) {
        console.warn("[templates.update] Failed to delete old storage:", e);
      }
    }

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
    // organizationId intentionally omitted — templates are personal only.
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // Templates are strictly owner-only.
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new ConvexError("Template not found");
    if (!hasTemplateAccess(template, identity))
      throw new ConvexError("You don't have access to this template");

    return ctx.db.insert("generatedDocuments", {
      templateId: args.templateId,
      ownerId: identity.subject,
      organizationId: getOrgId(identity),
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

    const [templates, documents, submissions] = await Promise.all([
      ctx.db.query("templates").collect(),
      ctx.db.query("documents").collect(),
      ctx.db.query("formSubmissions").collect(),
    ]);
    const isReferenced =
      templates.some((template) => template.storageId === args.storageId) ||
      documents.some((doc) => doc.storageId === args.storageId) ||
      submissions.some((submission) => submission.storageId === args.storageId);

    if (isReferenced) {
      throw new ConvexError("Cannot delete storage used by an active record");
    }

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

export const getAccessibleForDuplicateInternal = internalQuery({
  args: {
    id: v.id("templates"),
    subject: v.string(),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) return null;

    const isOwner = template.ownerId === args.subject;
    const isOrgMember =
      !!args.organizationId &&
      !!template.organizationId &&
      template.organizationId === args.organizationId;

    if (!isOwner && !isOrgMember) return null;

    return {
      ...template,
      tags: isOwner ? (template.tags ?? []) : [],
    };
  },
});

export const createDuplicateInternal = internalMutation({
  args: {
    sourceId: v.id("templates"),
    ownerId: v.string(),
    organizationId: v.optional(v.string()),
    storageId: v.string(),
    fileUrl: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new ConvexError("Template not found");

    return ctx.db.insert("templates", {
      name: `Copy of ${source.name}`,
      ownerId: args.ownerId,
      organizationId: args.organizationId,
      storageId: args.storageId,
      fileUrl: args.fileUrl,
      description: source.description,
      previewText: source.previewText,
      sourceFileType: source.sourceFileType,
      tags: args.tags ?? [],
      fields: source.fields,
    });
  },
});

export const duplicate = action({
  args: { id: v.id("templates") },
  handler: async (ctx, args): Promise<Id<"templates">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const organizationId = getOrgId(identity);
    const source = (await ctx.runQuery(
      internal.templates.getAccessibleForDuplicateInternal,
      {
        id: args.id,
        subject: identity.subject,
        organizationId,
      }
    )) as { storageId: string; tags?: string[] } | null;

    if (!source) {
      throw new ConvexError("You don't have access to this template");
    }

    const blob = await ctx.storage.get(source.storageId as any);
    if (!blob) throw new ConvexError("Template file not found");

    const newStorageId = await ctx.storage.store(blob);
    const convexSiteUrl =
      process.env.CONVEX_SITE_URL ??
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
      "";
    const fileUrl = `${convexSiteUrl}/getFile?storageId=${newStorageId}`;

    return (await ctx.runMutation(internal.templates.createDuplicateInternal, {
      sourceId: args.id,
      ownerId: identity.subject,
      organizationId,
      storageId: String(newStorageId),
      fileUrl,
      tags: source.tags ?? [],
    })) as Id<"templates">;
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
    // FIX: Hapus file lama sebelum update.
    const template = await ctx.db.get(args.id);
    if (template?.storageId && template.storageId !== args.storageId) {
      try {
        await ctx.storage.delete(template.storageId as any);
      } catch (e) {
        console.warn(
          "[templates.updateFileStorageInternal] Failed to delete old storage:",
          e
        );
      }
    }
    await ctx.db.patch(args.id, {
      storageId: args.storageId,
      fileUrl: args.fileUrl,
    });
  },
});
