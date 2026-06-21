import {
  createOutreachCampaign,
  updateOutreachCampaignProgress,
} from "@/lib/email-campaigns/queries";
import { getDraftOutreachEmails } from "@/lib/emails/queries";
import { assertSendingProviderReady } from "@/lib/email-sending/assert-provider-ready";
import { EmailSendingError, isEmailSendingError } from "@/lib/email-sending/errors";
import { getConfiguredSendingProviderName } from "@/lib/email-sending/factory";
import { sendOutreachDraft } from "@/lib/email-sending/send-draft";
import type {
  CampaignSendFailure,
  CampaignSendResult,
  OutreachCampaignStatus,
} from "@/types/email-campaign";

const CAMPAIGN_SEND_DELAY_MS = 400;

function resolveCampaignStatus(
  sentCount: number,
  failedCount: number
): OutreachCampaignStatus {
  if (sentCount === 0 && failedCount > 0) return "failed";
  if (failedCount > 0) return "partial";
  return "completed";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendOutreachCampaign(
  userId: string,
  input: {
    fromAddress: string;
    emailIds?: string[];
    name?: string;
  }
): Promise<CampaignSendResult> {
  const provider = getConfiguredSendingProviderName();
  const drafts = await getDraftOutreachEmails(userId, input.emailIds);

  if (drafts.length === 0) {
    throw new EmailSendingError(
      "VALIDATION_ERROR",
      "No draft emails are ready to send.",
      { statusCode: 400, retryable: false }
    );
  }

  await assertSendingProviderReady(userId, provider);

  const campaign =
    (await createOutreachCampaign(userId, {
      name: input.name?.trim() || "Outreach campaign",
      provider,
      totalCount: drafts.length,
    })) ??
    (() => {
      throw new EmailSendingError(
        "SEND_FAILED",
        "Failed to create outreach campaign.",
        { statusCode: 500, retryable: false }
      );
    })();

  const failures: CampaignSendFailure[] = [];
  let sentCount = 0;

  for (const [index, draft] of drafts.entries()) {
    try {
      await sendOutreachDraft(
        userId,
        draft,
        input.fromAddress,
        campaign.id
      );
      sentCount += 1;
    } catch (error) {
      failures.push({
        emailId: draft.id,
        leadName: draft.personalization.leadName,
        reason:
          error instanceof Error ? error.message : "Failed to send email.",
      });
    }

    if (index < drafts.length - 1) {
      await delay(CAMPAIGN_SEND_DELAY_MS);
    }
  }

  const failedCount = failures.length;
  const status = resolveCampaignStatus(sentCount, failedCount);
  const completedAt = new Date().toISOString();

  await updateOutreachCampaignProgress(userId, campaign.id, {
    sentCount,
    failedCount,
    status,
    completedAt,
  });

  return {
    campaign: {
      ...campaign,
      sentCount,
      failedCount,
      status,
      completedAt,
    },
    failures,
  };
}

export function toCampaignErrorResponse(error: unknown) {
  if (isEmailSendingError(error)) {
    return {
      success: false as const,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  return {
    success: false as const,
    error: {
      code: "SEND_FAILED" as const,
      message: "An unexpected error occurred while sending the campaign.",
      retryable: false,
    },
  };
}
