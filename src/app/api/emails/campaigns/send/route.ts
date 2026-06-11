import { NextResponse } from "next/server";
import {
  sendOutreachCampaign,
  toCampaignErrorResponse,
} from "@/lib/email-campaigns/send-campaign";
import { EmailSendingError } from "@/lib/email-sending/errors";
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

    const body = await request.json().catch(() => ({}));
    const emailIds = Array.isArray(body.emailIds)
      ? (body.emailIds as string[])
      : undefined;
    const name = typeof body.name === "string" ? body.name : undefined;

    const result = await sendOutreachCampaign(user.id, {
      fromAddress: user.email ?? "me",
      emailIds,
      name,
    });

    return NextResponse.json({
      success: true,
      campaign: result.campaign,
      failures: result.failures,
      meta: {
        sentCount: result.campaign.sentCount,
        failedCount: result.campaign.failedCount,
        status: result.campaign.status,
      },
    });
  } catch (error) {
    const response = toCampaignErrorResponse(error);
    const status =
      error instanceof EmailSendingError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
