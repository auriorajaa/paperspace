// app\api\forms\submit\[publicId]\route.ts
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;

  try {
    const body = await req.json();
    const { answers } = body;

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Missing or invalid 'answers' array" },
        { status: 400 }
      );
    }

    // Validate form exists and is published
    const form = await convex.query(api.internalForms.getByPublicId, {
      publicId,
    });

    if (!form) {
      return NextResponse.json(
        { error: "Form not found or not published" },
        { status: 404 }
      );
    }

    if (!form.settings.acceptResponses) {
      return NextResponse.json(
        { error: "Form is not accepting responses" },
        { status: 403 }
      );
    }

    // Validate required fields
    for (const question of form.schema) {
      if (question.required) {
        const answer = answers.find(
          (a: any) => a.questionId === question.id
        );
        if (!answer || !answer.value?.trim()) {
          return NextResponse.json(
            {
              error: `Required field "${question.title}" is missing`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Generate IP hash for rate limiting / dedup (GDPR-safe: one-way hash)
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "127.0.0.1";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const userAgent = req.headers.get("user-agent") ?? undefined;

    // Save response via Convex mutation
    const responseId = await convex.mutation(
      api.internalFormResponses.submit,
      {
        publicId,
        answers,
        userAgent,
        ipHash,
      }
    );

    // Trigger document generation in background
    try {
      await (
        convex.action as (
          path: string,
          args: Record<string, unknown>
        ) => Promise<unknown>
      )("processInternalFormResponses:processFormResponse", {
        responseId,
        formId: form._id,
      });
    } catch (genErr) {
      // Log but don't fail the request — response is saved
      console.error("[form-submit] Background generation error:", genErr);
    }

    return NextResponse.json({
      success: true,
      message: form.settings.confirmationMessage || undefined,
    });
  } catch (err: any) {
    console.error("[form-submit]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
