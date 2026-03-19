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
});
