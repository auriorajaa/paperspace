import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    tags: v.optional(v.array(v.string())),
    fields: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        label: v.string(),
        type: v.string(),
        required: v.boolean(),
        placeholder: v.string(),
        subFields: v.optional(
          v.array(
            v.object({
              id: v.string(),
              name: v.string(),
              label: v.string(),
              type: v.string(),
              required: v.boolean(),
              placeholder: v.string(),
            })
          )
        ),
      })
    ),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_organization_id", ["organizationId"]),

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
      })
    ),
    scriptToken: v.string(),
    filenamePattern: v.string(),
    isActive: v.boolean(),
    // ── Google Forms specific (optional for backward compat) ─────────────────
    connectionType: v.optional(v.string()), // "google" | "manual"
    googleFormId: v.optional(v.string()),
    // Maps Google questionId → questionTitle for response parsing
    googleQuestionMap: v.optional(v.any()),
    lastPolledAt: v.optional(v.number()),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_template_id", ["templateId"])
    .index("by_script_token", ["scriptToken"]),

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
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_connection_id", ["connectionId"])
    .index("by_template_id", ["templateId"])
    .index("by_connection_and_response", ["connectionId", "responseId"]),
});