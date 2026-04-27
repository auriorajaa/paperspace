/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { ConvexError } from "convex/values";

// FIX: crypto.getRandomValues() — cryptographically secure, not predictable
// like Math.random() which must never be used for security-sensitive secrets.
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `fwh_${hex}`;
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
    if (!identity) return null;
    const conn = await ctx.db.get(args.id);
    if (!conn || conn.ownerId !== identity.subject) return null;
    return conn;
  },
});

export const getByTemplateId = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("formConnections")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", identity.subject))
      .filter((q) => q.eq(q.field("templateId"), args.templateId))
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
    const conn = await ctx.db.get(args.connectionId);
    if (!conn || conn.ownerId !== identity.subject) return [];
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
    if (!identity) throw new ConvexError("Not authenticated");
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
    if (!identity) throw new ConvexError("Not authenticated");
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
    if (!identity) throw new ConvexError("Not authenticated");
    const conn = await ctx.db.get(args.id);
    if (!conn || conn.ownerId !== identity.subject)
      throw new ConvexError("Not found");

    const submissions = await ctx.db
      .query("formSubmissions")
      .withIndex("by_connection_id", (q) => q.eq("connectionId", args.id))
      .collect();
    await Promise.all(
      submissions.map(async (sub) => {
        if (sub.storageId) {
          try {
            await ctx.storage.delete(sub.storageId as any);
          } catch {}
        }
        await ctx.db.delete(sub._id);
      })
    );

    await ctx.db.delete(args.id);
  },
});

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

export const deleteSubmission = mutation({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const sub = await ctx.db.get(args.id);
    if (!sub || sub.ownerId !== identity.subject)
      throw new ConvexError("Not found");
    if (sub.storageId) {
      try {
        await ctx.storage.delete(sub.storageId as any);
      } catch {}
    }
    await ctx.db.delete(args.id);
  },
});

/**
 * Public webhook mutation — authenticated via scriptToken at the Convex layer.
 *
 * SECURITY: requires scriptToken so any caller that bypasses the Next.js API
 * layer and hits Convex directly still can't create submissions without a
 * valid, active token.
 *
 * FIX (this version): added optional `responseId` so the webhook path can
 * store it for deduplication, matching what createSubmissionInternal does.
 * Previously the public mutation silently dropped responseId, meaning
 * webhook-triggered submissions had weaker dedup (timestamp-only).
 *
 * Spam guard: rejects if the connection already has ≥ SPAM_LIMIT pending
 * submissions, preventing replay attacks from queuing runaway generation jobs.
 */
const SUBMISSION_SPAM_LIMIT = 50;

export const createSubmission = mutation({
  args: {
    scriptToken: v.string(),
    connectionId: v.id("formConnections"),
    respondentEmail: v.optional(v.string()),
    fieldValues: v.any(),
    filename: v.string(),
    status: v.string(),
    submittedAt: v.number(),
    // FIX: added — was missing from public mutation, present only on internal.
    // Without this, webhook submissions couldn't store the Google responseId
    // and dedup fell back to timestamp-only (weaker, misses same-second submits).
    responseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ── 1. Resolve connection via scriptToken ─────────────────────────────────
    const connection = await ctx.db
      .query("formConnections")
      .withIndex("by_script_token", (q) =>
        q.eq("scriptToken", args.scriptToken)
      )
      .first();

    if (!connection || !connection.isActive) {
      throw new ConvexError("Invalid or inactive token");
    }

    // ── 2. Confirm connectionId matches the token's connection ────────────────
    if (connection._id !== args.connectionId) {
      throw new ConvexError("Token does not match the provided connection");
    }

    // ── 3. Spam guard ─────────────────────────────────────────────────────────
    const pendingCount = await ctx.db
      .query("formSubmissions")
      .withIndex("by_connection_id", (q) =>
        q.eq("connectionId", connection._id)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect()
      .then((rows) => rows.length);

    if (pendingCount >= SUBMISSION_SPAM_LIMIT) {
      throw new ConvexError(
        "Too many pending submissions. Please wait for existing ones to complete."
      );
    }

    // ── 4. Dedup check against responseId before inserting ───────────────────
    // Mirrors the dedup logic in pollConnection so webhook and cron paths are
    // both protected against duplicate submissions.
    if (args.responseId) {
      const existing = await ctx.db
        .query("formSubmissions")
        .withIndex("by_connection_and_response", (q) =>
          q
            .eq("connectionId", connection._id)
            .eq("responseId", args.responseId!)
        )
        .first();
      if (existing) {
        // Return the existing id so the webhook can still respond with a valid
        // submissionId without crashing. The generation step will simply be a
        // no-op (the submission is already generated or in progress).
        return existing._id;
      }
    }

    // ── 5. Insert — ownerId derived from connection, never caller-supplied ────
    return ctx.db.insert("formSubmissions", {
      connectionId: connection._id,
      templateId: connection.templateId,
      ownerId: connection.ownerId,
      respondentEmail: args.respondentEmail,
      fieldValues: args.fieldValues,
      filename: args.filename,
      status: args.status,
      submittedAt: args.submittedAt,
      responseId: args.responseId,
    });
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const sub = await ctx.db.get(args.id);
    if (!sub) throw new ConvexError("Submission not found");
    const { id, ...rest } = args;
    const patch: Record<string, unknown> = {};
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) patch[k] = v;
    });
    await ctx.db.patch(id, patch);
  },
});

// ── Internal queries/mutations ────────────────────────────────────────────────

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
        q
          .eq("connectionId", args.connectionId)
          .eq("responseId", args.responseId)
      )
      .first();
  },
});

export const getSubmissionByTimestampInternal = internalQuery({
  args: {
    connectionId: v.id("formConnections"),
    submittedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("formSubmissions")
      .withIndex("by_connection_and_submitted", (q) =>
        q
          .eq("connectionId", args.connectionId)
          .eq("submittedAt", args.submittedAt)
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

export const updateSubmissionForWebhook = mutation({
  args: {
    scriptToken: v.string(),
    id: v.id("formSubmissions"),
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("formConnections")
      .withIndex("by_script_token", (q) =>
        q.eq("scriptToken", args.scriptToken)
      )
      .first();
    if (!connection) throw new ConvexError("Invalid token");

    const sub = await ctx.db.get(args.id);
    if (!sub) throw new ConvexError("Submission not found");

    if (sub.connectionId !== connection._id)
      throw new ConvexError("Submission does not belong to this connection");

    const { id, scriptToken, ...rest } = args;
    const patch: Record<string, unknown> = {};
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined) patch[k] = v;
    });
    await ctx.db.patch(id, patch);
  },
});
