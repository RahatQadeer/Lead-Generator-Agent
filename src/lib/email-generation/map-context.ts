import { formatLocation } from "@/lib/lead-enrichment/format-location";
import type { ContactWithCompany } from "@/lib/contacts/mapper";
import type { EmailGenerationContext } from "@/types/email-generation";

const DEFAULT_SENDER = "RightTail Software";

export function mapContactToEmailContext(
  contact: ContactWithCompany,
  options: { senderCompanyName?: string; tone?: "professional" | "friendly" } = {}
): EmailGenerationContext {
  const company = contact.companies;

  return {
    leadName: contact.full_name,
    leadRole: contact.title,
    leadCompany: company?.name ?? contact.company_name ?? "Unknown",
    leadIndustry: company?.industry ?? null,
    leadLocation: formatLocation(
      contact.city ?? company?.city ?? null,
      contact.state ?? company?.state ?? null,
      contact.country ?? company?.country ?? null
    ),
    senderCompanyName: options.senderCompanyName ?? DEFAULT_SENDER,
    tone: options.tone ?? "professional",
  };
}
