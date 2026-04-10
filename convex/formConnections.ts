/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { ConvexError } from "convex/values";

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "fwh_";
  for (let i = 0; i < 48; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// ── Public queries ────────────────────────────────────────────────────────────

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const connections = await ctx.db
      .query("formConnections")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();
    const withTemplates = await Promise.all(
      connections.map(async (c) => {
        const template = await ctx.db.get(c.templateId);
        return { ...c, templateName: template?.name ?? "Deleted template" };
      })
    );
    return withTemplates;
  },
});

export const getById = query({
  args: { id: v.id("formConnections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db.get(args.id);
  },
});

export const getByTemplateId = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("formConnections")
      .withIndex("by_template_id", (q) => q.eq("templateId", args.templateId))
      .collect();
  },
});

export const getByScriptToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("formConnections")
      .withIndex("by_script_token", (q) => q.eq("scriptToken", args.token))
      .first();
  },
});

export const getSubmissions = query({
  args: { connectionId: v.id("formConnections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("formSubmissions")
      .withIndex("by_connection_id", (q) =>
        q.eq("connectionId", args.connectionId)
      )
      .order("desc")
      .collect();
  },
});

export const getAllSubmissions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("formSubmissions")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();
  },
});

// ── Public mutations ──────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    templateId: v.id("templates"),
    formId: v.string(),
    formTitle: v.string(),
    spreadsheetId: v.optional(v.string()),
    fieldMappings: v.array(
      v.object({
        formQuestionTitle: v.string(),
        templateFieldName: v.string(),
      })
    ),
    filenamePattern: v.string(),
    connectionType: v.optional(v.string()),
    googleFormId: v.optional(v.string()),
    googleQuestionMap: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const scriptToken = generateToken();
    return ctx.db.insert("formConnections", {
      ownerId: identity.subject,
      templateId: args.templateId,
      formId: args.formId,
      formTitle: args.formTitle,
      spreadsheetId: args.spreadsheetId,
      fieldMappings: args.fieldMappings,
      filenamePattern: args.filenamePattern,
      scriptToken,
      isActive: true,
      connectionType: args.connectionType ?? "manual",
      googleFormId: args.googleFormId,
      googleQuestionMap: args.googleQuestionMap,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("formConnections"),
    fieldMappings: v.optional(
      v.array(
        v.object({
          formQuestionTitle: v.string(),
          templateFieldName: v.string(),
        })
      )
    ),
    filenamePattern: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const conn = await ctx.db.get(args.id);
    if (!conn || conn.ownerId !== identity.subject)
      throw new ConvexError("Not found");
    const { id, ...rest } = args;
    const patch: Record<string, unknown> = {};
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) patch[k] = v;
    });
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("formConnections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const conn = await ctx.db.get(args.id);
    if (!conn || conn.ownerId !== identity.subject)
      throw new ConvexError("Not found");
    await ctx.db.delete(args.id);
  },
});

// ── NEW: Deactivate all connections for the authenticated user (for disconnect flow) ──

export const deactivateAllForOwner = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const conns = await ctx.db
      .query("formConnections")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .collect();
    await Promise.all(
      conns
        .filter((c) => c.isActive)
        .map((c) => ctx.db.patch(c._id, { isActive: false }))
    );
  },
});

// ── NEW: Delete a single submission (for bulk delete) ──

export const deleteSubmission = mutation({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const sub = await ctx.db.get(args.id);
    if (!sub || sub.ownerId !== identity.subject)
      throw new ConvexError("Not found");
    // Best-effort delete from storage
    if (sub.storageId) {
      try {
        await ctx.storage.delete(sub.storageId as any);
      } catch {
        // non-critical
      }
    }
    await ctx.db.delete(args.id);
  },
});

export const createSubmission = mutation({
  args: {
    connectionId: v.id("formConnections"),
    templateId: v.id("templates"),
    ownerId: v.string(),
    respondentEmail: v.optional(v.string()),
    fieldValues: v.any(),
    filename: v.string(),
    status: v.string(),
    submittedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("formSubmissions", args);
  },
});

export const updateSubmission = mutation({
  args: {
    id: v.id("formSubmissions"),
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const patch: Record<string, unknown> = {};
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) patch[k] = v;
    });
    await ctx.db.patch(id, patch);
  },
});

// ── Internal queries/mutations (for crons + actions) ─────────────────────────

export const getAllGoogleConnectionsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("formConnections").collect();
    return all.filter(
      (c) => c.isActive && c.connectionType === "google" && c.googleFormId
    );
  },
});

export const getByIdInternal = internalQuery({
  args: { id: v.id("formConnections") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const getSubmissionByIdInternal = internalQuery({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const getSubmissionByResponseIdInternal = internalQuery({
  args: {
    connectionId: v.id("formConnections"),
    responseId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("formSubmissions")
      .withIndex("by_connection_and_response", (q) =>
        q.eq("connectionId", args.connectionId).eq("responseId", args.responseId)
      )
      .first();
  },
});

export const updateLastPolledInternal = internalMutation({
  args: {
    id: v.id("formConnections"),
    lastPolledAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastPolledAt: args.lastPolledAt });
  },
});

export const createSubmissionInternal = internalMutation({
  args: {
    connectionId: v.id("formConnections"),
    templateId: v.id("templates"),
    ownerId: v.string(),
    respondentEmail: v.optional(v.string()),
    fieldValues: v.any(),
    filename: v.string(),
    status: v.string(),
    submittedAt: v.number(),
    responseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("formSubmissions", args);
  },
});

export const updateSubmissionInternal = internalMutation({
  args: {
    id: v.id("formSubmissions"),
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const patch: Record<string, unknown> = {};
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) patch[k] = v;
    });
    await ctx.db.patch(id, patch);
  },
});

// NEW: Reset a submission to pending (for retry)
export const resetSubmissionInternal = internalMutation({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "pending",
      errorMessage: undefined,
      storageId: undefined,
      fileUrl: undefined,
    });
  },
});