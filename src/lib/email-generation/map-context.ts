import { formatLocation } from "@/lib/lead-enrichment/format-location";
import { inferPainPoints } from "@/lib/email-generation/infer-pain-points";
import { parseEmailTone } from "@/lib/email-generation/parse-tone";
import type { ContactWithCompany } from "@/lib/contacts/mapper";
import type { EmailGenerationContext, EmailTone } from "@/types/email-generation";

const DEFAULT_SENDER = "RightTail Software";
const DEFAULT_TONE: EmailTone = "professional";

interface MapContextOptions {
  senderCompanyName?: string;
  tone?: EmailTone;
  painPoints?: string[];
  searchKeywords?: string[];
}

export function mapContactToEmailContext(
  contact: ContactWithCompany,
  options: MapContextOptions = {}
): EmailGenerationContext {
  const company = contact.companies;
  const leadCompany = company?.name ?? contact.company_name ?? "Unknown";
  const industry = company?.industry ?? null;

  const painPoints =
    options.painPoints ??
    inferPainPoints({
      industry,
      role: contact.title,
      technologies: company?.technologies ?? [],
      employeeCount: company?.employee_count ?? null,
      searchKeywords: options.searchKeywords,
    });

  return {
    leadName: contact.full_name,
    leadRole: contact.title,
    leadCompany,
    industry,
    painPoints,
    tone: options.tone ?? DEFAULT_TONE,
    leadLocation: formatLocation(
      contact.city ?? company?.city ?? null,
      contact.state ?? company?.state ?? null,
      contact.country ?? company?.country ?? null
    ),
    senderCompanyName: options.senderCompanyName ?? DEFAULT_SENDER,
  };
}

export function toEmailGenerationPreview(
  contactId: string,
  context: EmailGenerationContext
) {
  return {
    contactId,
    leadName: context.leadName,
    leadRole: context.leadRole,
    leadCompany: context.leadCompany,
    industry: context.industry,
    painPoints: context.painPoints,
    defaultTone: context.tone,
  };
}
