import { scheduleDefaultFollowUp } from "@/lib/follow-ups/schedule";
import { markOutreachEmailSent } from "@/lib/emails/queries";
import { EmailSendingError } from "@/lib/email-sending/errors";
import {
  assertRecipientEmail,
  sendOutreachEmail,
} from "@/lib/email-sending/send";
import type { SavedEmail } from "@/types/email-generation";

export async function sendOutreachDraft(
  userId: string,
  draft: SavedEmail,
  fromAddress: string,
  campaignId?: string
): Promise<SavedEmail> {
  if (draft.status !== "draft") {
    throw new EmailSendingError(
      "ALREADY_SENT",
      "This email has already been sent.",
      { statusCode: 400, retryable: false }
    );
  }

  const recipientEmail = assertRecipientEmail(draft.recipientEmail);

  const result = await sendOutreachEmail(userId, {
    to: recipientEmail,
    subject: draft.subject,
    body: draft.body,
    fromAddress,
  });

  const saved = await markOutreachEmailSent(userId, draft.id, {
    recipientEmail,
    gmailMessageId: result.messageId,
    sentAt: result.sentAt,
    campaignId,
  });

  const sentEmail = saved ?? draft;
  await scheduleDefaultFollowUp(userId, sentEmail.contactId, sentEmail.id);

  return sentEmail;
}
