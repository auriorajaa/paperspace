// convex\admin.ts
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";

const ADMIN_EMAIL = "hendrianoko.corp@gmail.com";

type CleanupUserDataResult = {
  success: boolean;
  deleted: Record<string, number>;
};

type AdminIdentity = {
  email?: string;
  subject?: string;
  publicMetadata?: { role?: string };
  metadata?: { role?: string };
};

type OwnedRecord = {
  _id: string;
  ownerId?: string;
  storageId?: string;
  documentId?: string;
  collectionId?: string;
};

type DynamicIndexQuery = {
  eq: (field: string, value: string) => unknown;
};

type DynamicDb = {
  query: (table: string) => {
    withIndex: (
      index: string,
      filter: (q: DynamicIndexQuery) => unknown
    ) => { collect: () => Promise<OwnedRecord[]> };
    collect: () => Promise<OwnedRecord[]>;
  };
  delete: (id: string) => Promise<void>;
};

type CleanupCtx = {
  db: DynamicDb;
  storage: { delete: (id: string) => Promise<void> };
};

function hasAdminRole(identity: AdminIdentity | null) {
  if (!identity) return false;
  return (
    identity.publicMetadata?.role === "admin" ||
    identity.metadata?.role === "admin" ||
    identity.email === ADMIN_EMAIL
  );
}

async function requireAdmin(ctx: {
  auth: { getUserIdentity: () => Promise<AdminIdentity | null> };
  db?: any;
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ message: "Not authenticated", code: 401 });
  }
  if (hasAdminRole(identity)) return identity;

  // Promoted admins: check whitelist by Clerk user ID (JWT sub claim)
  if (ctx.db && identity.subject) {
    const subject: string = identity.subject;
    const whitelisted = await ctx.db
      .query("adminWhitelist")
      .withIndex("by_userId", (q: { eq: (f: string, v: string) => unknown }) => q.eq("userId", subject))
      .first();
    if (whitelisted) return identity;
  }

  throw new ConvexError({ message: "Forbidden: Admin access required", code: 403 });
}

async function deleteOwnedUserData(ctx: CleanupCtx, targetUserId: string) {
  const results: Record<string, number> = {};

  const collectByOwner = async (table: string) => {
    return await ctx.db
      .query(table)
      .withIndex("by_owner_id", (q) => q.eq("ownerId", targetUserId))
      .collect();
  };

  const deleteDocs = async (docs: Array<{ _id: string }>) => {
    await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));
    return docs.length;
  };

  const documents = await collectByOwner("documents");
  const templates = await collectByOwner("templates");
  const collections = await collectByOwner("collections");
  const internalForms = await collectByOwner("internalForms");
  const internalFormResponses = await collectByOwner("internalFormResponses");
  const generatedDocuments = await collectByOwner("generatedDocuments");
  const formConnections = await collectByOwner("formConnections");
  const formSubmissions = await collectByOwner("formSubmissions");
  const googleAccounts = await collectByOwner("googleAccounts");

  const documentIds = new Set(documents.map((doc) => doc._id));
  const collectionIds = new Set(collections.map((collection) => collection._id));
  const allJunctions = await ctx.db.query("documentCollections").collect();
  const documentCollections = allJunctions.filter(
    (junction) =>
      (junction.documentId !== undefined && documentIds.has(junction.documentId)) ||
      (junction.collectionId !== undefined && collectionIds.has(junction.collectionId))
  );

  const storageIds = [
    ...documents.map((doc) => doc.storageId),
    ...templates.map((template) => template.storageId),
    ...formSubmissions.map((submission) => submission.storageId),
  ].filter(Boolean) as string[];

  await Promise.all(
    [...new Set(storageIds)].map((storageId) =>
      ctx.storage.delete(storageId).catch(() => undefined)
    )
  );
  results.storageFiles = new Set(storageIds).size;

  results.documentCollections = await deleteDocs(documentCollections);
  results.formSubmissions = await deleteDocs(formSubmissions);
  results.formConnections = await deleteDocs(formConnections);
  results.internalFormResponses = await deleteDocs(internalFormResponses);
  results.internalForms = await deleteDocs(internalForms);
  results.generatedDocuments = await deleteDocs(generatedDocuments);
  results.templates = await deleteDocs(templates);
  results.collections = await deleteDocs(collections);
  results.documents = await deleteDocs(documents);
  results.googleAccounts = await deleteDocs(googleAccounts);

  return { success: true, deleted: results };
}

export const getStats = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [
      documents,
      collections,
      templates,
      forms,
      submissions,
      generatedDocuments,
      formConnections,
      googleAccounts,
    ] = await Promise.all([
      ctx.db.query("documents").collect(),
      ctx.db.query("collections").collect(),
      ctx.db.query("templates").collect(),
      ctx.db.query("internalForms").collect(),
      ctx.db.query("formSubmissions").collect(),
      ctx.db.query("generatedDocuments").collect(),
      ctx.db.query("formConnections").collect(),
      ctx.db.query("googleAccounts").collect(),
    ]);

    const ownerIds = new Set<string>();
    for (const row of [
      ...documents,
      ...collections,
      ...templates,
      ...forms,
      ...submissions,
      ...generatedDocuments,
      ...formConnections,
      ...googleAccounts,
    ] as Array<{ ownerId?: string }>) {
      if (row.ownerId) ownerIds.add(row.ownerId);
    }

    return {
      documentsCount: documents.length,
      collectionsCount: collections.length,
      templatesCount: templates.length,
      formsCount: forms.length,
      submissionsCount: submissions.length,
      generatedDocumentsCount: generatedDocuments.length,
      formConnectionsCount: formConnections.length,
      googleAccountsCount: googleAccounts.length,
      totalUsersWithData: ownerIds.size,
      usersWithDocuments: new Set(documents.map((d) => d.ownerId)).size,
      usersWithTemplates: new Set(templates.map((t) => t.ownerId)).size,
      usersWithForms: new Set(forms.map((f) => f.ownerId)).size,
    };
  },
});

export const getCachedStats = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const doc = await ctx.db
      .query("statsCache")
      .withIndex("by_key", (q) => q.eq("key", "stats"))
      .first();
    return doc?.data ?? null;
  },
});

export const updateStatsCache = internalMutation({
  handler: async (ctx) => {
    const [
      documents,
      collections,
      templates,
      forms,
      submissions,
      generatedDocuments,
      formConnections,
      googleAccounts,
    ] = await Promise.all([
      ctx.db.query("documents").collect(),
      ctx.db.query("collections").collect(),
      ctx.db.query("templates").collect(),
      ctx.db.query("internalForms").collect(),
      ctx.db.query("formSubmissions").collect(),
      ctx.db.query("generatedDocuments").collect(),
      ctx.db.query("formConnections").collect(),
      ctx.db.query("googleAccounts").collect(),
    ]);

    const ownerIds = new Set<string>();
    for (const row of [
      ...documents,
      ...collections,
      ...templates,
      ...forms,
      ...submissions,
      ...generatedDocuments,
      ...formConnections,
      ...googleAccounts,
    ] as Array<{ ownerId?: string }>) {
      if (row.ownerId) ownerIds.add(row.ownerId);
    }

    const data = {
      documentsCount: documents.length,
      collectionsCount: collections.length,
      templatesCount: templates.length,
      formsCount: forms.length,
      submissionsCount: submissions.length,
      generatedDocumentsCount: generatedDocuments.length,
      formConnectionsCount: formConnections.length,
      googleAccountsCount: googleAccounts.length,
      totalUsersWithData: ownerIds.size,
      usersWithDocuments: new Set(documents.map((d) => d.ownerId)).size,
      usersWithTemplates: new Set(templates.map((t) => t.ownerId)).size,
      usersWithForms: new Set(forms.map((f) => f.ownerId)).size,
      updatedAt: Date.now(),
    };

    const existing = await ctx.db
      .query("statsCache")
      .withIndex("by_key", (q) => q.eq("key", "stats"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { data, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("statsCache", { key: "stats", data, updatedAt: Date.now() });
    }
  },
});

export const getCountsForUsers = query({
  args: { userIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const countById = async (
      table: "documents" | "templates" | "internalForms" | "collections" | "formSubmissions" | "generatedDocuments",
    ) => {
      const results: Record<string, number> = {};
      // Process users sequentially per table to avoid overloading Convex.
      for (const uid of args.userIds) {
        const rows = await ctx.db
          .query(table)
          .withIndex("by_owner_id", (q) => q.eq("ownerId", uid))
          .collect();
        results[uid] = rows.length;
      }
      return results;
    };

    const docCounts = await countById("documents");
    const templateCounts = await countById("templates");
    const formCounts = await countById("internalForms");
    const collectionCounts = await countById("collections");
    const submissionCounts = await countById("formSubmissions");
    const generatedDocumentCounts = await countById("generatedDocuments");

    return {
      docCounts,
      templateCounts,
      formCounts,
      collectionCounts,
      submissionCounts,
      generatedDocumentCounts,
    };
  },
});

export const getContentPage = query({
  args: { tab: v.string(), cursor: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const table =
      args.tab === "documents"
        ? ("documents" as const)
        : args.tab === "templates"
          ? ("templates" as const)
          : ("internalForms" as const);

    const result = await ctx.db.query(table).order("desc").paginate({
      cursor: args.cursor ?? null,
      numItems: args.limit,
    });

    const page = result.page.map((item: any) => {
      if (args.tab === "documents") {
        return {
          _id: item._id,
          _creationTime: item._creationTime,
          title: item.title,
          ownerId: item.ownerId,
          organizationId: item.organizationId,
          isArchived: item.isArchived,
          fileUrl: item.fileUrl,
        };
      }
      if (args.tab === "templates") {
        return {
          _id: item._id,
          _creationTime: item._creationTime,
          name: item.name,
          ownerId: item.ownerId,
          organizationId: item.organizationId,
          description: item.description,
          fieldsCount: item.fields.length,
          fileUrl: item.fileUrl,
        };
      }
      return {
        _id: item._id,
        _creationTime: item._creationTime,
        title: item.title,
        ownerId: item.ownerId,
        organizationId: item.organizationId,
        status: item.status,
        questionsCount: item.schema.length,
      };
    });

    return {
      page,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const getRecentActivity = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [documents, templates, forms, submissions] = await Promise.all([
      ctx.db.query("documents").order("desc").take(12),
      ctx.db.query("templates").order("desc").take(12),
      ctx.db.query("internalForms").order("desc").take(12),
      ctx.db.query("formSubmissions").order("desc").take(12),
    ]);

    return [
      ...documents.map((item) => ({
        id: item._id,
        type: "document",
        title: item.title,
        ownerId: item.ownerId,
        at: item._creationTime,
      })),
      ...templates.map((item) => ({
        id: item._id,
        type: "template",
        title: item.name,
        ownerId: item.ownerId,
        at: item._creationTime,
      })),
      ...forms.map((item) => ({
        id: item._id,
        type: "form",
        title: item.title,
        ownerId: item.ownerId,
        at: item._creationTime,
      })),
      ...submissions.map((item) => ({
        id: item._id,
        type: "submission",
        title: item.filename,
        ownerId: item.ownerId,
        at: item.submittedAt,
      })),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 30);
  },
});

export const getUserResources = query({
  args: { targetUserId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { targetUserId } = args;

    const [
      documents,
      collections,
      templates,
      forms,
      connections,
      submissions,
      generatedDocuments,
      googleAccounts,
    ] = await Promise.all([
      ctx.db.query("documents").withIndex("by_owner_id", (q) => q.eq("ownerId", targetUserId)).collect(),
      ctx.db.query("collections").withIndex("by_owner_id", (q) => q.eq("ownerId", targetUserId)).collect(),
      ctx.db.query("templates").withIndex("by_owner_id", (q) => q.eq("ownerId", targetUserId)).collect(),
      ctx.db.query("internalForms").withIndex("by_owner_id", (q) => q.eq("ownerId", targetUserId)).collect(),
      ctx.db.query("formConnections").withIndex("by_owner_id", (q) => q.eq("ownerId", targetUserId)).collect(),
      ctx.db.query("formSubmissions").withIndex("by_owner_id", (q) => q.eq("ownerId", targetUserId)).collect(),
      ctx.db.query("generatedDocuments").withIndex("by_owner_id", (q) => q.eq("ownerId", targetUserId)).collect(),
      ctx.db.query("googleAccounts").withIndex("by_owner_id", (q) => q.eq("ownerId", targetUserId)).collect(),
    ]);

    return {
      documents: documents.map((d) => ({
        _id: d._id,
        title: d.title,
        _creationTime: d._creationTime,
        isArchived: d.isArchived,
        fileUrl: d.fileUrl,
      })),
      collections: collections.map((c) => ({
        _id: c._id,
        name: c.name,
        _creationTime: c._creationTime,
      })),
      templates: templates.map((t) => ({
        _id: t._id,
        name: t.name,
        _creationTime: t._creationTime,
        fileUrl: t.fileUrl,
      })),
      forms: forms.map((f) => ({
        _id: f._id,
        title: f.title,
        status: f.status,
        _creationTime: f._creationTime,
      })),
      counts: {
        documents: documents.length,
        collections: collections.length,
        templates: templates.length,
        forms: forms.length,
        connections: connections.length,
        submissions: submissions.length,
        generatedDocuments: generatedDocuments.length,
        googleAccounts: googleAccounts.length,
      },
    };
  },
});

export const cleanupUserData = mutation({
  args: { targetUserId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await deleteOwnedUserData(ctx as unknown as CleanupCtx, args.targetUserId);
  },
});


export const cleanupUserDataFromSystem = mutation({
  args: { targetUserId: v.string(), secret: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.INTERNAL_API_SECRET;
    if (!expected || args.secret !== expected) {
      throw new ConvexError({ message: "Unauthorized system cleanup", code: 401 });
    }
    return await deleteOwnedUserData(ctx as unknown as CleanupCtx, args.targetUserId);
  },
});
export const cleanupUserDataInternal = internalMutation({
  args: { targetUserId: v.string() },
  handler: async (ctx, args) => {
    return await deleteOwnedUserData(ctx as unknown as CleanupCtx, args.targetUserId);
  },
});

export const addAdminToWhitelist = mutation({
  args: { userId: v.string(), secret: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.INTERNAL_API_SECRET;
    if (!expected || args.secret !== expected) {
      throw new ConvexError({ message: "Unauthorized", code: 401 });
    }
    const existing = await ctx.db
      .query("adminWhitelist")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (!existing) {
      await ctx.db.insert("adminWhitelist", { userId: args.userId });
    }
  },
});

export const removeAdminFromWhitelist = mutation({
  args: { userId: v.string(), secret: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.INTERNAL_API_SECRET;
    if (!expected || args.secret !== expected) {
      throw new ConvexError({ message: "Unauthorized", code: 401 });
    }
    const existing = await ctx.db
      .query("adminWhitelist")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});