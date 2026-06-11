import { NextResponse } from "next/server";
import {
  getContactById,
  getSearchKeywordsForContact,
  saveGeneratedEmail,
} from "@/lib/emails/queries";
import {
  generateOutreachEmail,
  toEmailGenerationErrorResponse,
} from "@/lib/email-generation/generate";
import { mapContactToEmailContext } from "@/lib/email-generation/map-context";
import { parsePainPointsInput } from "@/lib/email-generation/parse-pain-points";
import { parseEmailTone } from "@/lib/email-generation/parse-tone";
import { assertContactCanReceiveOutreach } from "@/lib/follow-ups/guards";
import { isFollowUpBlockedError } from "@/lib/follow-ups/errors";
import { EmailGenerationError } from "@/lib/email-generation/errors";
import { resolveEmailGenerationConfig } from "@/lib/openai/settings";
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
    const contactId = body.contactId as string | undefined;
    const tone = parseEmailTone(body.tone);
    const painPoints = parsePainPointsInput(body.painPoints);

    if (!contactId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "contactId is required.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const contact = await getContactById(user.id, contactId);
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

    if (!contact.email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_EMAIL",
            message: "Contact has no email address for outreach.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    await assertContactCanReceiveOutreach(user.id, contactId);

    const searchKeywords = await getSearchKeywordsForContact(
      user.id,
      contact.search_id
    );

    const context = mapContactToEmailContext(contact, {
      tone,
      painPoints,
      searchKeywords,
    });
    const generated = await generateOutreachEmail(user.id, context);
    const generationConfig = await resolveEmailGenerationConfig(user.id);
    const saved = await saveGeneratedEmail(user.id, contactId, generated);

    return NextResponse.json({
      success: true,
      email: saved ?? generated,
      meta: {
        provider: generationConfig.provider,
        model: generated.model,
        attempts: generated.attempts,
        contactId,
        personalization: generated.personalization,
      },
    });
  } catch (error) {
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

    const response = toEmailGenerationErrorResponse(error);
    const status =
      error instanceof EmailGenerationError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
