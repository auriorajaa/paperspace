import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internalMutation } from "./_generated/server";

// ── Access helpers ────────────────────────────────────────────────────────────

function getOrgId(identity: any): string | undefined {
  return identity.organization_id as string | undefined;
}

function hasAccess(
  doc: { ownerId: string; organizationId?: string },
  identity: any
): boolean {
  if (doc.ownerId === identity.subject) return true;
  const orgId = getOrgId(identity);
  return !!(orgId && doc.organizationId && doc.organizationId === orgId);
}

function isOwner(doc: { ownerId: string }, identity: any): boolean {
  return doc.ownerId === identity.subject;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const getAll = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const orgId = getOrgId(identity);

    const personalDocs = await ctx.db
      .query("documents")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();

    let orgDocs: typeof personalDocs = [];
    if (orgId) {
      orgDocs = await ctx.db
        .query("documents")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
        .order("desc")
        .collect();
    }

    const seen = new Set<string>();
    const all = [...personalDocs, ...orgDocs].filter((d) => {
      if (seen.has(d._id)) return false;
      seen.add(d._id);
      return true;
    });

    if (args.includeArchived) return all;
    return all.filter((d) => !d.isArchived);
  },
});

export const getArchived = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const orgId = getOrgId(identity);

    const personalArchived = await ctx.db
      .query("documents")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .filter((q) => q.eq(q.field("isArchived"), true))
      .order("desc")
      .collect();

    let orgArchived: typeof personalArchived = [];
    if (orgId) {
      orgArchived = await ctx.db
        .query("documents")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
        .filter((q) => q.eq(q.field("isArchived"), true))
        .order("desc")
        .collect();
    }

    const seen = new Set<string>();
    return [...personalArchived, ...orgArchived].filter((d) => {
      if (seen.has(d._id)) return false;
      seen.add(d._id);
      return true;
    });
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const orgId = getOrgId(identity);
    const limit = args.limit ?? 6;

    const personalDocs = await ctx.db
      .query("documents")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .take(limit);

    let orgDocs: typeof personalDocs = [];
    if (orgId) {
      orgDocs = await ctx.db
        .query("documents")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .order("desc")
        .take(limit);
    }

    const seen = new Set<string>();
    return [...personalDocs, ...orgDocs]
      .filter((d) => {
        if (seen.has(d._id)) return false;
        seen.add(d._id);
        return true;
      })
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, limit);
  },
});

export const getByOrg = query({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const orgId = getOrgId(identity);
    if (orgId !== args.organizationId) return [];

    return ctx.db
      .query("documents")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .take(20);
  },
});

export const getById = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const doc = await ctx.db.get(args.id);
    if (!doc) return null;
    if (!hasAccess(doc, identity)) return null;

    return doc;
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const orgId = getOrgId(identity);

    if (!args.query.trim()) {
      const personalDocs = await ctx.db
        .query("documents")
        .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .order("desc")
        .take(20);

      let orgDocs: typeof personalDocs = [];
      if (orgId) {
        orgDocs = await ctx.db
          .query("documents")
          .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
          .filter((q) => q.eq(q.field("isArchived"), false))
          .order("desc")
          .take(20);
      }

      const seen = new Set<string>();
      return [...personalDocs, ...orgDocs].filter((d) => {
        if (seen.has(d._id)) return false;
        seen.add(d._id);
        return true;
      });
    }

    return ctx.db
      .query("documents")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("ownerId", identity.subject)
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .take(20);
  },
});

export const getCollectionsForDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const junctions = await ctx.db
      .query("documentCollections")
      .withIndex("by_document_id", (q) => q.eq("documentId", args.documentId))
      .collect();

    const collections = await Promise.all(
      junctions.map((j) => ctx.db.get(j.collectionId))
    );

    return collections.filter(Boolean);
  },
});

// ── Mutations — tetap throw (mutations tidak boleh silent fail) ────────────────

export const create = mutation({
  args: {
    title: v.string(),
    organizationId: v.optional(v.string()),
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db.insert("documents", {
      title: args.title,
      ownerId: identity.subject,
      organizationId: args.organizationId,
      storageId: args.storageId,
      fileUrl: args.fileUrl,
      icon: args.icon ?? "📄",
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    icon: v.optional(v.string()),
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    coverImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");
    if (!hasAccess(doc, identity))
      throw new ConvexError("You don't have access to this document");

    const { id, ...fields } = args;
    const patch: Record<string, unknown> = {};
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.icon !== undefined) patch.icon = fields.icon;
    if (fields.storageId !== undefined) patch.storageId = fields.storageId;
    if (fields.fileUrl !== undefined) patch.fileUrl = fields.fileUrl;
    if (fields.coverImage !== undefined) patch.coverImage = fields.coverImage;

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const archive = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");
    if (!hasAccess(doc, identity))
      throw new ConvexError("You don't have access to this document");

    await ctx.db.patch(args.id, { isArchived: true });
  },
});

export const restore = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");
    if (!hasAccess(doc, identity))
      throw new ConvexError("You don't have access to this document");

    await ctx.db.patch(args.id, { isArchived: false });
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");
    if (!isOwner(doc, identity))
      throw new ConvexError("Only the document owner can delete this document");

    if (doc.storageId) {
      try {
        await ctx.storage.delete(doc.storageId as any);
      } catch (e) {
        console.error("Storage delete failed", e);
      }
    }

    const junctions = await ctx.db
      .query("documentCollections")
      .withIndex("by_document_id", (q) => q.eq("documentId", args.id))
      .collect();
    await Promise.all(junctions.map((j) => ctx.db.delete(j._id)));

    await ctx.db.delete(args.id);
  },
});

export const duplicate = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");
    if (!hasAccess(doc, identity))
      throw new ConvexError("You don't have access to this document");

    return ctx.db.insert("documents", {
      title: `Copy of ${doc.title}`,
      ownerId: identity.subject,
      organizationId: doc.organizationId,
      storageId: doc.storageId,
      fileUrl: doc.fileUrl,
      icon: doc.icon,
      isArchived: false,
    });
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

export const getStorageUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId as any);
  },
});

export const updateFileStorageInternal = internalMutation({
  args: {
    id: v.id("documents"),
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
