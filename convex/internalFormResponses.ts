/* eslint-disable @typescript-eslint/no-explicit-any */
// convex\internalFormResponses.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";

function hasAccess(
  doc: { ownerId: string; organizationId?: string },
  identity: any
): boolean {
  if (doc.ownerId === identity.subject) return true;
  const orgId = identity.organization_id || undefined;
  return !!(orgId && doc.organizationId && doc.organizationId === orgId);
}

// ── Queries ────────────────────────────────────────────────────────────────

export const getByFormId = query({
  args: { formId: v.id("internalForms") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const form = await ctx.db.get(args.formId);
    if (!form || !hasAccess(form, identity)) return [];

    return ctx.db
      .query("internalFormResponses")
      .withIndex("by_form_id", (q) => q.eq("formId", args.formId))
      .order("desc")
      .collect();
  },
});

// ── Internal queries ──────────────────────────────────────────────────────

import { internalQuery } from "./_generated/server";

export const getResponseInternal = internalQuery({
  args: { id: v.id("internalFormResponses") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

// ── Public mutation (no auth) ──────────────────────────────────────────────

export const submit = mutation({
  args: {
    publicId: v.string(),
    answers: v.array(
      v.object({
        questionId: v.string(),
        value: v.string(),
      })
    ),
    respondentEmail: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("internalForms")
      .withIndex("by_public_id", (q) => q.eq("publicId", args.publicId))
      .first();

    if (!form || form.status !== "published") {
      throw new ConvexError("Form not found or not published");
    }

    if (!form.settings.acceptResponses) {
      throw new ConvexError("Form is not accepting responses");
    }

    for (const question of form.schema) {
      if (question.required) {
        const answer = args.answers.find(
          (a) => a.questionId === question.id
        );
        if (!answer || answer.value.trim() === "") {
          throw new ConvexError(
            `Required field "${question.title}" is missing`
          );
        }
      }
    }

    const validQuestionIds = new Set(form.schema.map((q) => q.id));
    for (const answer of args.answers) {
      if (!validQuestionIds.has(answer.questionId)) {
        throw new ConvexError(
          `Unknown question ID: ${answer.questionId}`
        );
      }
    }

    const ipHash = args.ipHash || (args.userAgent ? simpleHash(args.userAgent) : undefined);

    let respondentEmail = args.respondentEmail;

    if (form.settings.collectEmail) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Please sign in to submit this form");
      }
      const email = identity.email;
      if (!email) {
        throw new ConvexError(
          "Could not retrieve your email from your account"
        );
      }

      const domains = form.settings.allowedDomains ?? [];
      if (domains.length > 0) {
        const domain = email.split("@")[1]?.toLowerCase();
        const allowed = domains.some(
          (d) => domain === d.toLowerCase().trim()
        );
        if (!allowed) {
          throw new ConvexError(
            `Email domain @${domain} is not allowed for this form`
          );
        }
      }

      respondentEmail = email;
    }

    const responseId = await ctx.db.insert("internalFormResponses", {
      formId: form._id,
      ownerId: form.ownerId,
      answers: args.answers,
      submittedAt: Date.now(),
      respondentEmail,
      userAgent: args.userAgent,
      ipHash,
    });

    try {
      await ctx.scheduler.runAfter(
        0,
        internal.processInternalFormResponses.processFormResponse,
        {
          responseId,
          formId: form._id,
        }
      );
    } catch {
      // Submission saved — document generation scheduling is best-effort.
      // The form owner can manually trigger generation from the responses page.
    }

    return responseId;
  },
});

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}
