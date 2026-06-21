import { getCompanyDedupKey } from "@/lib/company-discovery/apply-dedup";
import type { Database } from "@/types/database";
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
    scraped_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
