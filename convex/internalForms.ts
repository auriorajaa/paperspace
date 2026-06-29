/* eslint-disable @typescript-eslint/no-explicit-any */
// convex\internalForms.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

const questionValidator = v.object({
  id: v.string(),
  title: v.string(),
  type: v.string(),
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
  description: v.optional(v.string()),
  placeholder: v.optional(v.string()),
  min: v.optional(v.number()),
  max: v.optional(v.number()),
});

const settingsValidator = v.object({
  acceptResponses: v.optional(v.boolean()),
  confirmationMessage: v.optional(v.string()),
  headerImage: v.optional(v.string()),
  themeColor: v.optional(v.string()),
  submitButtonText: v.optional(v.string()),
  showHeader: v.optional(v.boolean()),
  fontFamily: v.optional(v.string()),
  cornerStyle: v.optional(v.string()),
  showProgress: v.optional(v.boolean()),
  seoDescription: v.optional(v.string()),
  collectEmail: v.optional(v.boolean()),
  allowedDomains: v.optional(v.array(v.string())),
});

function generatePublicId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getOrgId(identity: any): string | undefined {
  const orgId = identity.organization_id;
  return orgId || undefined;
}

function hasAccess(
  doc: { ownerId: string; organizationId?: string },
  identity: any
): boolean {
  if (doc.ownerId === identity.subject) return true;
  const orgId = getOrgId(identity);
  return !!(orgId && doc.organizationId && doc.organizationId === orgId);
}

// ── Queries ────────────────────────────────────────────────────────────────

export const getAll = query({
  args: {
    orgId: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
    search: v.optional(v.string()),
    sort: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const orgId = args.orgId || getOrgId(identity);

    const personalForms = await ctx.db
      .query("internalForms")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();

    let orgForms: typeof personalForms = [];
    if (orgId) {
      orgForms = await ctx.db
        .query("internalForms")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
        .order("desc")
        .collect();
    }

    const seen = new Set<string>();
    let all = [...personalForms, ...orgForms].filter((f) => {
      if (seen.has(f._id)) return false;
      seen.add(f._id);
      return true;
    });

    if (!args.includeArchived) {
      all = all.filter((f) => f.status !== "archived");
    }

    if (args.status && args.status !== "all") {
      all = all.filter((f) => f.status === args.status);
    }

    if (args.search) {
      const q = args.search.toLowerCase();
      all = all.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q))
      );
    }

    if (args.sort === "title_asc") {
      all.sort((a, b) => a.title.localeCompare(b.title));
    } else if (args.sort === "title_desc") {
      all.sort((a, b) => b.title.localeCompare(a.title));
    } else if (args.sort === "oldest") {
      all.sort((a, b) => a._creationTime - b._creationTime);
    } else {
      all.sort((a, b) => b._creationTime - a._creationTime);
    }

    const withCounts = await Promise.all(
      all.map(async (f) => {
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
          creatorName: identity.name || undefined,
          creatorEmail: identity.email || undefined,
          responseCount: responses.length,
          connectionCount: connections.length,
          isOrgForm: !!f.organizationId,
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
    if (!form || !hasAccess(form, identity)) return null;
    return {
      ...form,
      creatorName: identity.name || undefined,
      creatorEmail: identity.email || undefined,
      isOrgForm: !!form.organizationId,
    };
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

/**
 * Lightweight metadata-only lookup used by generateMetadata() in
 * app/f/[publicId]/page.tsx — avoids leaking the full schema/settings
 * to link-preview crawlers.
 */
export const getMetaByPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("internalForms")
      .withIndex("by_public_id", (q) => q.eq("publicId", args.publicId))
      .first();
    if (!form || form.status !== "published") return null;
    return {
      title: form.title,
      description:
        form.settings.seoDescription || form.description || undefined,
      headerImage: form.settings.headerImage || undefined,
      acceptResponses: form.settings.acceptResponses,
    };
  },
});

// ── Mutations ──────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    schema: v.array(questionValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const publicId = generatePublicId();
    const orgId = args.organizationId || getOrgId(identity);

    return ctx.db.insert("internalForms", {
      ownerId: identity.subject,
      organizationId: orgId || undefined,
      title: args.title,
      description: args.description,
      schema: args.schema,
      status: "draft",
      publicId,
      settings: {
        acceptResponses: false,
        fontFamily: "default",
        cornerStyle: "soft",
        showProgress: true,
      },
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("internalForms"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    schema: v.optional(v.array(questionValidator)),
    settings: v.optional(settingsValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const form = await ctx.db.get(args.id);
    if (!form || !hasAccess(form, identity)) throw new ConvexError("Not found");

    const { id, ...rest } = args;
    const patch: Record<string, unknown> = {};
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) patch[k] = v;
    });
    if (patch.settings && typeof patch.settings === "object") {
      patch.settings = { ...form.settings, ...patch.settings };
    }
    await ctx.db.patch(id, patch);
  },
});

export const publish = mutation({
  args: { id: v.id("internalForms") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const form = await ctx.db.get(args.id);
    if (!form || !hasAccess(form, identity)) throw new ConvexError("Not found");

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
    if (!form || !hasAccess(form, identity)) throw new ConvexError("Not found");

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
    if (!form || !hasAccess(form, identity)) throw new ConvexError("Not found");

    const responses = await ctx.db
      .query("internalFormResponses")
      .withIndex("by_form_id", (q) => q.eq("formId", args.id))
      .collect();
    await Promise.all(responses.map((r) => ctx.db.delete(r._id)));

    const connections = await ctx.db
      .query("formConnections")
      .withIndex("by_internal_form_id", (q) => q.eq("internalFormId", args.id))
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
