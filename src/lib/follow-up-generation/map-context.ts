import { DEFAULT_SENDER_COMPANY_NAME } from "@/lib/brand";
import { parseEmailTone } from "@/lib/email-generation/parse-tone";
import type { ContactWithCompany } from "@/lib/contacts/mapper";
import type { SavedEmail } from "@/types/email-generation";
import type { FollowUp } from "@/types/follow-up";
import type { FollowUpGenerationContext } from "@/types/follow-up-suggestion";

function daysBetween(from: string, to: Date): number {
  const start = new Date(from).getTime();
  const end = to.getTime();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

export function mapFollowUpToGenerationContext(
  followUp: FollowUp,
  sourceEmail: SavedEmail,
  contact: ContactWithCompany
): FollowUpGenerationContext {
  const company = contact.companies;
  const sentAt = sourceEmail.sentAt ?? sourceEmail.createdAt;

  return {
    leadName: contact.full_name,
    leadRole: contact.title,
    leadCompany: company?.name ?? contact.company_name ?? sourceEmail.personalization.leadCompany,
    industry: company?.industry ?? sourceEmail.personalization.industry,
    tone: parseEmailTone(sourceEmail.personalization.tone),
    senderCompanyName: DEFAULT_SENDER_COMPANY_NAME,
    originalSubject: sourceEmail.subject,
    originalBody: sourceEmail.body,
    originalSentAt: sentAt,
    sequenceNumber: followUp.sequenceNumber,
    daysSinceOriginalSend: daysBetween(sentAt, new Date()),
  };
}
