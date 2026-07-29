import { getCompanyDedupKey } from "@/lib/company-discovery/apply-dedup";
import type { Database, Json } from "@/types/database";
import type { DiscoveredCompany } from "@/types/company";

type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];

export function toCompanyInsert(
  userId: string,
  searchId: string,
  provider: string,
  company: DiscoveredCompany
): CompanyInsert | null {
  const dedupKey = getCompanyDedupKey(company);
  if (!dedupKey) return null;

  return {
    user_id: userId,
    search_id: searchId,
    dedup_key: dedupKey,
    provider,
    provider_company_id: company.id,
    name: company.name,
    domain: company.domain,
    industry: company.industry,
    employee_count: company.employeeCount,
    country: company.country,
    city: company.city,
    state: company.state,
    linkedin_url: company.linkedinUrl,
    website_url: company.websiteUrl,
    technologies: company.technologies ?? [],
    description: company.description,
    confidence_score: company.confidenceScore,
    validation_status: company.validationStatus ?? null,
    website_status: company.websiteStatus ?? null,
    semantic_relevance: company.semanticRelevance ?? null,
    quality_score: company.qualityScore ?? null,
    sources: (company.sources ?? []).map((source) => ({
      kind: source.kind,
      label: source.label,
      url: source.url,
    })),
    // Rich directory payload (founders, socials, contact/careers pages) when the
    // company came from a directory scraper; null for web/API-sourced companies.
    directory_profile: (company.directoryProfile ?? null) as Json | null,
    scraped_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
