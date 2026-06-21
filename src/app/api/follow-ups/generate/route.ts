import { NextResponse } from "next/server";
import { getContactById, getOutreachEmailById } from "@/lib/emails/queries";
import {
  generateFollowUpSuggestion,
  toFollowUpGenerationErrorResponse,
} from "@/lib/follow-up-generation/generate";
import { mapFollowUpToGenerationContext } from "@/lib/follow-up-generation/map-context";
import { EmailGenerationError } from "@/lib/email-generation/errors";
import { resolveEmailGenerationConfig } from "@/lib/openai/settings";
import {
  isFollowUpBlockedError,
  isFollowUpNotFoundError,
  FollowUpNotFoundError,
} from "@/lib/follow-ups/errors";
import { assertContactCanReceiveOutreach } from "@/lib/follow-ups/guards";
import {
  getFollowUpById,
  saveFollowUpSuggestion,
} from "@/lib/follow-ups/queries";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AUTH_ERROR",
            message: "Authentication required.",
            retryable: false,
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const followUpId = body.followUpId as string | undefined;

    if (!followUpId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "followUpId is required.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const followUp = await getFollowUpById(user.id, followUpId);
    if (!followUp) {
      throw new FollowUpNotFoundError();
    }

    if (followUp.status !== "scheduled") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FOLLOW_UP_NOT_SCHEDULED",
            message: "Suggestions can only be generated for scheduled follow-ups.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    await assertContactCanReceiveOutreach(user.id, followUp.contactId);

    const [sourceEmail, contact] = await Promise.all([
      getOutreachEmailById(user.id, followUp.sourceEmailId),
      getContactById(user.id, followUp.contactId),
    ]);

    if (!sourceEmail || sourceEmail.status !== "sent") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SOURCE_EMAIL_NOT_FOUND",
            message: "Original outreach email not found or not sent.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    if (!contact) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONTACT_NOT_FOUND",
            message: "Contact not found.",
            retryable: false,
          },
        },
        { status: 404 }
      );
    }

    const context = mapFollowUpToGenerationContext(followUp, sourceEmail, contact);
    const generated = await generateFollowUpSuggestion(user.id, context);
    const generationConfig = await resolveEmailGenerationConfig(user.id);
    const saved = await saveFollowUpSuggestion(user.id, followUpId, generated);

    return NextResponse.json({
      success: true,
      suggestion: saved?.suggestion ?? {
        subject: generated.subject,
        body: generated.body,
        provider: generated.provider,
        model: generated.model,
        suggestedAt: generated.generatedAt,
      },
      meta: {
        followUpId,
        provider: generationConfig.provider,
        model: generated.model,
        attempts: generated.attempts,
      },
    });
  } catch (error) {
    if (isFollowUpNotFoundError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            retryable: false,
          },
        },
        { status: error.statusCode }
      );
    }

    if (isFollowUpBlockedError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            retryable: false,
          },
        },
        { status: error.statusCode }
      );
    }

    const response = toFollowUpGenerationErrorResponse(error);
    const status =
      error instanceof EmailGenerationError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
