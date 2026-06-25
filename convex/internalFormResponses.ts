/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

// ── Queries ────────────────────────────────────────────────────────────────

export const getByFormId = query({
  args: { formId: v.id("internalForms") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const form = await ctx.db.get(args.formId);
    if (!form || form.ownerId !== identity.subject) return [];

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

    // Validate required fields
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

    // Validate that all provided answers match schema questions
    const validQuestionIds = new Set(form.schema.map((q) => q.id));
    for (const answer of args.answers) {
      if (!validQuestionIds.has(answer.questionId)) {
        throw new ConvexError(
          `Unknown question ID: ${answer.questionId}`
        );
      }
    }

    return ctx.db.insert("internalFormResponses", {
      formId: form._id,
      ownerId: form.ownerId,
      answers: args.answers,
      submittedAt: Date.now(),
      respondentEmail: args.respondentEmail,
      userAgent: args.userAgent,
      ipHash: args.ipHash,
    });
  },
});
