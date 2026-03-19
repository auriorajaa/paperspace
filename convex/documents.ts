import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internalMutation } from "./_generated/server";

// ── Queries ──────────────────────────────────────────────────────────────────

export const getAll = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();

    if (args.includeArchived) return docs;
    return docs.filter((d) => !d.isArchived);
  },
});

export const getArchived = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db
      .query("documents")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .filter((q) => q.eq(q.field("isArchived"), true))
      .order("desc")
      .collect();
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .take(args.limit ?? 6);

    return docs;
  },
});

export const getByOrg = query({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db
      .query("documents")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .take(6);
  },
});

export const getById = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) return null;
    return doc;
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    if (!args.query.trim()) {
      return ctx.db
        .query("documents")
        .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .order("desc")
        .take(20);
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

// ── Mutations ─────────────────────────────────────────────────────────────────

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

    const id = await ctx.db.insert("documents", {
      title: args.title,
      ownerId: identity.subject,
      organizationId: args.organizationId,
      storageId: args.storageId,
      fileUrl: args.fileUrl,
      icon: args.icon ?? "📄",
      isArchived: false,
    });

    return id;
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

    const { id, ...fields } = args;
    const doc = await ctx.db.get(id);
    if (!doc) throw new ConvexError("Document not found");
    if (doc.ownerId !== identity.subject)
      throw new ConvexError("You don't have access to this document");

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
    if (doc.ownerId !== identity.subject)
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
    if (doc.ownerId !== identity.subject)
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
    if (doc.ownerId !== identity.subject)
      throw new ConvexError("You don't have access to this document");

    // Delete from storage if exists
    if (doc.storageId) {
      try {
        await ctx.storage.delete(doc.storageId as any);
      } catch (e) {
        console.error("Storage delete failed", e);
      }
    }

    // Remove all collection junctions
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

    const newId = await ctx.db.insert("documents", {
      title: `Copy of ${doc.title}`,
      ownerId: identity.subject,
      organizationId: doc.organizationId,
      storageId: doc.storageId,
      fileUrl: doc.fileUrl,
      icon: doc.icon,
      isArchived: false,
    });

    return newId;
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
