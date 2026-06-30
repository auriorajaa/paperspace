/* eslint-disable @typescript-eslint/no-explicit-any */
// convex\processInternalFormResponses.ts
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const processFormResponse = internalAction({
  args: {
    responseId: v.id("internalFormResponses"),
    formId: v.id("internalForms"),
  },
  handler: async (ctx, args) => {
    const response = await ctx.runQuery(
      internal.internalFormResponses.getResponseInternal,
      { id: args.responseId }
    );
    if (!response) return;

    const connections = await ctx.runQuery(
      internal.formConnections.getByInternalFormIdInternal,
      { internalFormId: args.formId }
    );

    for (const connection of connections) {
      if (!connection.isActive || connection.templateDeleted) continue;

      const fieldValues: Record<string, string> = {};
      for (const mapping of connection.fieldMappings) {
        const answer = mapping.sourceQuestionId
          ? response.answers.find(
              (a: any) => a.questionId === mapping.sourceQuestionId
            )
          : undefined;
        if (answer) {
          fieldValues[mapping.templateFieldName] = answer.value;
        }
      }

      const submittedAt = response.submittedAt;
      const rowNumber = String(submittedAt).slice(-6);
      const pattern = connection.filenamePattern || "{{formTitle}}_{{row_number}}";

      const connectionDoc = await ctx.runQuery(
        internal.formConnections.getByIdInternal,
        { id: connection._id }
      );
      const formTitle = connectionDoc?.formTitle ?? "form";

      const rawFilename = pattern
        .replace(/{{row_number}}/g, rowNumber)
        .replace(/{{formTitle}}/g, formTitle)
        .replace(/{{(\w+)}}/g, (_: string, key: string) => fieldValues[key] ?? "")
        .replace(/[<>:"/\\|?*]/g, "_")
        .trim();
      const filename =
        rawFilename.replace(/^_+$/, "").trim() || `document_${rowNumber}`;

      const submissionId = await ctx.runMutation(
        internal.formConnections.createSubmissionInternal,
        {
          connectionId: connection._id,
          templateId: connection.templateId,
          ownerId: connection.ownerId,
          respondentEmail: response.respondentEmail,
          fieldValues,
          filename,
          status: "pending",
          submittedAt,
          sourceType: "internal",
          internalResponseId: args.responseId,
        }
      );

      try {
        await ctx.runAction(
          internal.docxGeneration.generateDocxFromTemplate,
          {
            submissionId,
            templateId: connection.templateId,
            fieldValues,
            filename,
          }
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        console.error(
          "[processInternalFormResponse] Generation error:",
          message
        );
        await ctx.runMutation(
          internal.formConnections.updateSubmissionInternal,
          {
            id: submissionId,
            status: "error",
            errorMessage: message,
          }
        );
      }
    }
  },
});
