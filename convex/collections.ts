import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

// ── Queries ───────────────────────────────────────────────────────────────────

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .collect();

    // Get document counts
    const withCounts = await Promise.all(
      collections.map(async (col) => {
        const junctions = await ctx.db
          .query("documentCollections")
          .withIndex("by_collection_id", (q) => q.eq("collectionId", col._id))
          .collect();
        return { ...col, documentCount: junctions.length };
      })
    );

    // Sort: favorites first, then by sortOrder, then by creation time
    return withCounts.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.sortOrder !== undefined && b.sortOrder !== undefined)
        return a.sortOrder - b.sortOrder;
      return b._creationTime - a._creationTime;
    });
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .take(args.limit ?? 4);

    // Same as getAll — compute document counts
    const withCounts = await Promise.all(
      collections.map(async (col) => {
        const junctions = await ctx.db
          .query("documentCollections")
          .withIndex("by_collection_id", (q) => q.eq("collectionId", col._id))
          .collect();
        return { ...col, documentCount: junctions.length };
      })
    );

    return withCounts;
  },
});

export const getById = query({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    return ctx.db.get(args.id);
  },
});

export const getDocuments = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const junctions = await ctx.db
      .query("documentCollections")
      .withIndex("by_collection_id", (q) =>
        q.eq("collectionId", args.collectionId)
      )
      .collect();

    const docs = await Promise.all(
      junctions.map((j) => ctx.db.get(j.documentId))
    );

    return docs.filter(
      (d): d is NonNullable<typeof d> => d !== null && !d.isArchived
    );
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isFavorite: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // Check for duplicate name
    const existing = await ctx.db
      .query("collections")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .collect();

    if (
      existing.some((c) => c.name.toLowerCase() === args.name.toLowerCase())
    ) {
      throw new ConvexError("A collection with this name already exists");
    }

    return ctx.db.insert("collections", {
      name: args.name,
      description: args.description,
      ownerId: identity.subject,
      organizationId: args.organizationId,
      icon: args.icon ?? "📁",
      color: args.color ?? "#6366f1",
      tags: args.tags ?? [],
      isFavorite: args.isFavorite ?? false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("collections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isFavorite: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const col = await ctx.db.get(args.id);
    if (!col) throw new ConvexError("Collection not found");
    if (col.ownerId !== identity.subject)
      throw new ConvexError("You don't have access to this collection");

    // Check duplicate name (excluding self)
    if (args.name && args.name !== col.name) {
      const existing = await ctx.db
        .query("collections")
        .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
        .collect();
      if (
        existing.some(
          (c) =>
            c._id !== args.id &&
            c.name.toLowerCase() === args.name!.toLowerCase()
        )
      ) {
        throw new ConvexError("A collection with this name already exists");
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

export const toggleFavorite = mutation({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const col = await ctx.db.get(args.id);
    if (!col) throw new ConvexError("Collection not found");
    if (col.ownerId !== identity.subject)
      throw new ConvexError("You don't have access to this collection");

    await ctx.db.patch(args.id, { isFavorite: !col.isFavorite });
  },
});

export const remove = mutation({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const col = await ctx.db.get(args.id);
    if (!col) throw new ConvexError("Collection not found");
    if (col.ownerId !== identity.subject)
      throw new ConvexError("You don't have access to this collection");

    // Remove all junctions (do NOT delete the documents)
    const junctions = await ctx.db
      .query("documentCollections")
      .withIndex("by_collection_id", (q) => q.eq("collectionId", args.id))
      .collect();
    await Promise.all(junctions.map((j) => ctx.db.delete(j._id)));

    await ctx.db.delete(args.id);
  },
});

export const addDocument = mutation({
  args: {
    collectionId: v.id("collections"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // Check duplicate
    const existing = await ctx.db
      .query("documentCollections")
      .withIndex("by_document_and_collection", (q) =>
        q
          .eq("documentId", args.documentId)
          .eq("collectionId", args.collectionId)
      )
      .first();

    if (existing) throw new ConvexError("Document already in this collection");

    await ctx.db.insert("documentCollections", {
      documentId: args.documentId,
      collectionId: args.collectionId,
      addedBy: identity.subject,
      addedAt: Date.now(),
    });
  },
});

export const removeDocument = mutation({
  args: {
    collectionId: v.id("collections"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const junction = await ctx.db
      .query("documentCollections")
      .withIndex("by_document_and_collection", (q) =>
        q
          .eq("documentId", args.documentId)
          .eq("collectionId", args.collectionId)
      )
      .first();

    if (junction) await ctx.db.delete(junction._id);
  },
});
