import { NextResponse } from "next/server";
import { getOutreachEmailById } from "@/lib/emails/queries";
import { assertSendingProviderReady } from "@/lib/email-sending/assert-provider-ready";
import { EmailSendingError } from "@/lib/email-sending/errors";
import { sendOutreachDraft } from "@/lib/email-sending/send-draft";
import { toEmailSendingErrorResponse } from "@/lib/email-sending/send";
import { getConfiguredSendingProviderName } from "@/lib/email-sending/factory";
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
    const emailId = body.emailId as string | undefined;

    if (!emailId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "emailId is required.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const draft = await getOutreachEmailById(user.id, emailId);
    if (!draft) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_NOT_FOUND",
            message: "Outreach email not found.",
            retryable: false,
          },
        },
        { status: 404 }
      );
    }

    const provider = getConfiguredSendingProviderName();
    await assertSendingProviderReady(user.id, provider);

    const saved = await sendOutreachDraft(
      user.id,
      draft,
      user.email ?? "me"
    );

    return NextResponse.json({
      success: true,
      email: saved,
      meta: {
        provider,
        recipientEmail: saved.recipientEmail,
      },
    });
  } catch (error) {
    const response = toEmailSendingErrorResponse(error);
    const status =
      error instanceof EmailSendingError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
