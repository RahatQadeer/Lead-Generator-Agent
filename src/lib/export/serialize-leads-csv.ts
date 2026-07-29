import type { EnrichedLead } from "@/types/lead";
import { emailDisplayLabel } from "@/lib/email-verification/display-status";
import type { EmailDisplayStatus } from "@/types/email-verification";

export interface CsvExportRow {
  company: string;
  website: string;
  industry: string;
  country: string;
  city: string;
  employeeSize: string;
  contactName: string;
  title: string;
  email: string;
  emailStatus: string;
  contactType: string;
  linkedin: string;
  phone: string;
  twitter: string;
  facebook: string;
  instagram: string;
  leadScore: string;
  overallScore: string;
  qualityCategory: string;
  confidenceScore: string;
  sourceUrl: string;
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | null | undefined): string {
  return escapeCsv(String(value ?? ""));
}

export function serializeLeadsToCsv(leads: EnrichedLead[]): string {
  const headers: (keyof CsvExportRow)[] = [
    "company",
    "website",
    "industry",
    "country",
    "city",
    "employeeSize",
    "contactName",
    "title",
    "email",
    "emailStatus",
    "contactType",
    "linkedin",
    "phone",
    "twitter",
    "facebook",
    "instagram",
    "leadScore",
    "overallScore",
    "qualityCategory",
    "confidenceScore",
    "sourceUrl",
  ];

  const rows = leads.map((lead) => {
    const displayStatus = (lead as EnrichedLead & { emailDisplayStatus?: EmailDisplayStatus })
      .emailDisplayStatus;

    return {
      company: lead.company,
      website: "",
      industry: "",
      country: lead.country ?? "",
      city: lead.city ?? "",
      employeeSize: "",
      contactName: lead.name,
      title: lead.role,
      email: lead.email ?? "",
      emailStatus: displayStatus ? emailDisplayLabel(displayStatus) : "",
      contactType: lead.contactDetailType ?? "",
      linkedin: lead.linkedin ?? "",
      phone: lead.phone ?? "",
      twitter: lead.socialProfiles?.twitter ?? "",
      facebook: lead.socialProfiles?.facebook ?? "",
      instagram: lead.socialProfiles?.instagram ?? "",
      leadScore: lead.leadScore != null ? String(lead.leadScore) : "",
      overallScore: "",
      qualityCategory: "",
      confidenceScore: String(lead.confidenceScore ?? ""),
      sourceUrl: lead.contactPageUrl ?? "",
    } satisfies CsvExportRow;
  });

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => cell(row[h])).join(",")),
  ];

  return lines.join("\n");
}

export const CSV_EXPORT_HEADERS = [
  "company",
  "website",
  "industry",
  "country",
  "contact_name",
  "title",
  "email",
  "email_status",
  "contact_type",
  "linkedin",
  "phone",
  "twitter",
  "facebook",
  "instagram",
  "lead_score",
  "confidence_score",
].join(",");
