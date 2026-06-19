import { computeCompanyFitBreakdown } from "@/lib/scraping/company-fit-breakdown";
import type { CompanyCriteriaFilters } from "@/lib/company-discovery/apply-criteria";
import type { DiscoveredCompany } from "@/types/company";

/**
 * Multi-signal company fit score (0–100) for ranking discovery results.
 */
export function computeCompanyFitScore(
  company: DiscoveredCompany,
  filters: CompanyCriteriaFilters
): number {
  return computeCompanyFitBreakdown(company, filters).overall;
}
