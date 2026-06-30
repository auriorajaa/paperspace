// convex\schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const internalFormQuestionSchema = v.object({
  id: v.string(),
  title: v.string(),
  type: v.string(),
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
  // ── Rich customization (all optional / backward compatible) ───────────────
  description: v.optional(v.string()), // helper text shown under the title
  placeholder: v.optional(v.string()),
  min: v.optional(v.number()),
  max: v.optional(v.number()),
});

export default defineSchema({
  documents: defineTable({
    title: v.string(),
    ownerId: v.string(),
    organizationId: v.optional(v.string()),
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    isArchived: v.boolean(),
    icon: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    aiSummary: v.optional(v.string()),
    aiSummaryGeneratedAt: v.optional(v.number()),
    aiSummaryStatus: v.optional(v.string()),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_organization_id", ["organizationId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["ownerId", "organizationId"],
    }),

  collections: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.string(),
    organizationId: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isFavorite: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_organization_id", ["organizationId"]),

  documentCollections: defineTable({
    documentId: v.id("documents"),
    collectionId: v.id("collections"),
    addedBy: v.string(),
    addedAt: v.optional(v.number()),
  })
    .index("by_document_id", ["documentId"])
    .index("by_collection_id", ["collectionId"])
    .index("by_document_and_collection", ["documentId", "collectionId"]),

  templates: defineTable({
    name: v.string(),
    ownerId: v.string(),
    organizationId: v.optional(v.string()),
    storageId: v.string(),
    fileUrl: v.string(),
    description: v.optional(v.string()),
    previewText: v.optional(v.string()),
    sourceFileType: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    fields: v.array(
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
      })
    ),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_organization_id", ["organizationId"]),

  // ── Internal forms ──────────────────────────────────────────────────────────
  internalForms: defineTable({
    ownerId: v.string(),
    organizationId: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    schema: v.array(internalFormQuestionSchema),
    status: v.string(), // "draft" | "published" | "archived"
    publicId: v.string(),
    settings: v.object({
      acceptResponses: v.boolean(),
      confirmationMessage: v.optional(v.string()),
      headerImage: v.optional(v.string()),
      themeColor: v.optional(v.string()),
      submitButtonText: v.optional(v.string()),
      showHeader: v.optional(v.boolean()),
      // ── Rich customization (all optional / backward compatible) ─────────────
      fontFamily: v.optional(v.string()), // "default" | "serif" | "mono" | "rounded"
      cornerStyle: v.optional(v.string()), // "pill" | "soft" | "square"
      showProgress: v.optional(v.boolean()),
      seoDescription: v.optional(v.string()), // override for link-share metadata
      // ── Email collection (requires Google sign-in) ─────────────────────────
      collectEmail: v.optional(v.boolean()),
      allowedDomains: v.optional(v.array(v.string())), // e.g. ["mhsw.pnj.ac.id"]
    }),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_organization_id", ["organizationId"])
    .index("by_public_id", ["publicId"]),

  // ── Internal form responses ──────────────────────────────────────────────────
  internalFormResponses: defineTable({
    formId: v.id("internalForms"),
    ownerId: v.string(),
    answers: v.array(
      v.object({
        questionId: v.string(),
        value: v.string(),
      })
    ),
    submittedAt: v.number(),
    respondentEmail: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    ipHash: v.optional(v.string()),
  })
    .index("by_form_id", ["formId"])
    .index("by_owner_id", ["ownerId"]),

  generatedDocuments: defineTable({
    templateId: v.id("templates"),
    ownerId: v.string(),
    organizationId: v.optional(v.string()),
    title: v.string(),
    fieldValues: v.any(),
    format: v.string(),
    isBulk: v.boolean(),
    bulkCount: v.optional(v.number()),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_template_id", ["templateId"]),

  // ── Google OAuth accounts ────────────────────────────────────────────────────
  googleAccounts: defineTable({
    ownerId: v.string(),
    email: v.string(),
    clerkEmail: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(), // ms timestamp
  }).index("by_owner_id", ["ownerId"]),

  // ── Form connections ─────────────────────────────────────────────────────────
  formConnections: defineTable({
    ownerId: v.string(),
    templateId: v.id("templates"),
    formId: v.string(),
    formTitle: v.string(),
    spreadsheetId: v.optional(v.string()),
    fieldMappings: v.array(
      v.object({
        formQuestionTitle: v.string(),
        templateFieldName: v.string(),
        sourceQuestionId: v.optional(v.string()),
      })
    ),
    scriptToken: v.string(),
    filenamePattern: v.string(),
    isActive: v.boolean(),
    // ── Google Forms specific (optional for backward compat) ─────────────────
    connectionType: v.optional(v.string()), // "google" | "manual" | "internal"
    googleFormId: v.optional(v.string()),
    // ── Internal form specific ──────────────────────────────────────────────
    internalFormId: v.optional(v.id("internalForms")),
    // Maps Google questionId → questionTitle for response parsing
    googleQuestionMap: v.optional(v.any()),
    lastPolledAt: v.optional(v.number()),
    // ── Template deletion tracking ───────────────────────────────────────────
    // Set to true when the linked template is deleted. Connection is
    // automatically deactivated; sync and retry are blocked on both
    // backend and frontend to avoid confusing "Template not found" errors.
    templateDeleted: v.optional(v.boolean()),
    templateDeletedAt: v.optional(v.number()),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_template_id", ["templateId"])
    .index("by_script_token", ["scriptToken"])
    .index("by_internal_form_id", ["internalFormId"]),

  formSubmissions: defineTable({
    connectionId: v.id("formConnections"),
    templateId: v.id("templates"),
    ownerId: v.string(),
    respondentEmail: v.optional(v.string()),
    fieldValues: v.any(),
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    filename: v.string(),
    status: v.string(), // "pending" | "generated" | "error"
    errorMessage: v.optional(v.string()),
    submittedAt: v.number(),
    responseId: v.optional(v.string()), // Google Forms responseId for dedup
    sourceType: v.optional(v.string()), // "google" | "internal"
    internalResponseId: v.optional(v.id("internalFormResponses")),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_connection_id", ["connectionId"])
    .index("by_template_id", ["templateId"])
    .index("by_connection_and_response", ["connectionId", "responseId"])
    // FIX: fallback dedup index for responses that lack a responseId
    // (older Google Forms API format) or when two concurrent syncs race.
    .index("by_connection_and_submitted", ["connectionId", "submittedAt"]),
});
