import { NextResponse } from "next/server";
import { getContactById, saveGeneratedEmail } from "@/lib/emails/queries";
import { parseEmailTone } from "@/lib/email-generation/parse-tone";
import {
  isFollowUpBlockedError,
  isFollowUpNotFoundError,
  FollowUpNotFoundError,
} from "@/lib/follow-ups/errors";
import { assertContactCanReceiveOutreach } from "@/lib/follow-ups/guards";
import {
  getFollowUpById,
  linkFollowUpDraftEmail,
} from "@/lib/follow-ups/queries";
import type { GeneratedEmail } from "@/types/email-generation";
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
            message: "Only scheduled follow-ups can be saved as drafts.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    if (!followUp.suggestion) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_SUGGESTION",
            message: "Generate a follow-up suggestion first.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    if (followUp.draftEmailId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DRAFT_EXISTS",
            message: "A draft email is already linked to this follow-up.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    await assertContactCanReceiveOutreach(user.id, followUp.contactId);

    const contact = await getContactById(user.id, followUp.contactId);
    if (!contact?.email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_EMAIL",
            message: "Contact has no email address.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const suggestion = followUp.suggestion;
    const generated: GeneratedEmail = {
      subject: suggestion.subject,
      body: suggestion.body,
      provider: suggestion.provider,
      model: suggestion.model,
      generatedAt: suggestion.suggestedAt,
      personalization: {
        leadName: contact.full_name,
        leadRole: contact.title,
        leadCompany: contact.companies?.name ?? contact.company_name ?? "Unknown",
        industry: contact.companies?.industry ?? null,
        painPoints: [],
        tone: parseEmailTone(null),
      },
    };

    const saved = await saveGeneratedEmail(user.id, followUp.contactId, generated);
    if (!saved) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SAVE_FAILED",
            message: "Failed to save follow-up draft.",
            retryable: true,
          },
        },
        { status: 500 }
      );
    }

    await linkFollowUpDraftEmail(user.id, followUpId, saved.id);

    return NextResponse.json({
      success: true,
      email: saved,
      meta: { followUpId, draftEmailId: saved.id },
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

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SAVE_FAILED",
          message: "Something went wrong while saving the draft. Please try again.",
          retryable: false,
        },
      },
      { status: 500 }
    );
  }
}
