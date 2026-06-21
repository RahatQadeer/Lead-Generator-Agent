import type { SearchRecord } from "@/types/search";
import type { SearchScoringCriteria } from "@/types/lead-scoring";

export function mapSearchToScoringCriteria(
  search: SearchRecord
): SearchScoringCriteria {
  return {
    industry: search.industry,
    companySizeMin: search.companySizeMin,
    companySizeMax: search.companySizeMax,
    country: search.country,
    technologies: search.technologies,
    jobTitles: search.jobTitles,
  };
}
