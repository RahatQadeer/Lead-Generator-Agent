import { computeCompanyFitScore } from "@/lib/scraping/company-fit-score";
import { applyKnownBrandToCompany } from "@/lib/scraping/known-brands";
import {
  matchesCountry,
  matchesSize,
  passesHardCompanyGate,
  scoreIndustryMatch,
} from "@/lib/company-discovery/apply-criteria-helpers";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";
import {
  toRejectedCompanyView,
  validateCompanyForDiscovery,
  type RejectedCompanyView,
} from "@/lib/company-discovery/validate-company";

export type CompanyCriteriaFilters = Pick<
  CompanyDiscoveryParams,
  | "industry"
  | "country"
  | "companySizeMin"
  | "companySizeMax"
  | "technologies"
  | "keywords"
>;

export {
  matchesCountry,
  matchesIndustry,
  matchesSize,
  matchesTechnologies,
  matchesCompanyCriteria,
  passesHardCompanyGate,
  scoreIndustryMatch,
} from "@/lib/company-discovery/apply-criteria-helpers";

export function rankCompaniesByFit(
  companies: DiscoveredCompany[],
  filters: CompanyCriteriaFilters
): DiscoveredCompany[] {
  return [...companies].sort((a, b) => {
    const scoreA = computeCompanyFitScore(a, filters);
    const scoreB = computeCompanyFitScore(b, filters);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
  });
}

const SOFT_FALLBACK_FIT_MIN = 12;
const SOFT_FALLBACK_MAX = 50;
const SOFT_INDUSTRY_MATCH_MIN = 0.12;
/** Minimum industry overlap to include a company rejected only for industry mismatch. */
const RELATED_INDUSTRY_MATCH_MIN = 0.1;

export interface ApplyCriteriaOptions {
  /** Minimum companies to return before pagination (defaults to 30). */
  targetMinResults?: number;
}

function resolveTargetMin(options?: ApplyCriteriaOptions): number {
  return Math.max(30, options?.targetMinResults ?? 30);
}

function passesSoftSizeGate(
  company: DiscoveredCompany,
  filters: CompanyCriteriaFilters
): boolean {
  if (filters.companySizeMin === null && filters.companySizeMax === null) {
    return true;
  }
  if (company.employeeCount === null) return true;
  return matchesSize(company, filters.companySizeMin, filters.companySizeMax);
}

/** Recover companies that narrowly missed strict validation but fit the search intent. */
function recoverNearMatchCompanies(
  strict: DiscoveredCompany[],
  all: DiscoveredCompany[],
  filters: CompanyCriteriaFilters,
  limit: number
): DiscoveredCompany[] {
  if (limit <= 0) return [];

  const seen = new Set(
    strict.map((company) => company.domain?.toLowerCase()).filter(Boolean) as string[]
  );
  const recovered: DiscoveredCompany[] = [];

  for (const company of rankCompaniesByFit(all, filters)) {
    const domain = company.domain?.toLowerCase();
    if (!domain || seen.has(domain)) continue;
    if (!passesHardCompanyGate(company, filters)) continue;
    if (!matchesCountry(company, filters.country)) continue;
    if (!passesSoftSizeGate(company, filters)) continue;

    const industryScore = scoreIndustryMatch(company, filters.industry);
    if (industryScore < SOFT_INDUSTRY_MATCH_MIN) continue;

    const validation = validateCompanyForDiscovery(company, filters);
    if (validation.accepted) {
      recovered.push(applyKnownBrandToCompany(company));
      seen.add(domain);
      if (recovered.length >= limit) break;
      continue;
    }

    const unknownSizeOnly =
      validation.reasons.length === 0 &&
      validation.warnings.some((warning) => warning.includes("Employee count unknown"));

    const industryNearMiss =
      validation.reasons.length === 1 &&
      validation.reasons[0].startsWith("Industry mismatch") &&
      industryScore >= SOFT_INDUSTRY_MATCH_MIN;

    if (unknownSizeOnly || industryNearMiss) {
      recovered.push(applyKnownBrandToCompany(company));
      seen.add(domain);
      if (recovered.length >= limit) break;
    }
  }

  return recovered;
}

/** When strict validation rejects every candidate, keep the best partial matches. */
function applySoftIndustryFallback(
  companies: DiscoveredCompany[],
  filters: CompanyCriteriaFilters
): DiscoveredCompany[] {
  const candidates = companies
    .map((company) => applyKnownBrandToCompany(company))
    .filter((company) => passesHardCompanyGate(company, filters))
    .filter((company) => matchesCountry(company, filters.country))
    .filter((company) => passesSoftSizeGate(company, filters))
    .filter((company) => scoreIndustryMatch(company, filters.industry) >= SOFT_INDUSTRY_MATCH_MIN)
    .filter((company) => computeCompanyFitScore(company, filters) >= SOFT_FALLBACK_FIT_MIN);

  return rankCompaniesByFit(candidates, filters).slice(0, SOFT_FALLBACK_MAX);
}

function isIndustryOnlyRejection(reasons: string[]): boolean {
  if (reasons.length === 0) return false;
  return reasons.every(
    (reason) =>
      reason.startsWith("Industry mismatch") ||
      reason.startsWith("Detected industry") ||
      reason.startsWith("Required industry") ||
      reason.startsWith("Conflicting industry")
  );
}

/** Include companies that narrowly missed strict industry validation but fit the search geography and size. */
function expandRelatedIndustry(
  current: DiscoveredCompany[],
  all: DiscoveredCompany[],
  filters: CompanyCriteriaFilters,
  limit: number
): DiscoveredCompany[] {
  if (limit <= 0) return [];

  const seen = new Set(
    current.map((company) => company.domain?.toLowerCase()).filter(Boolean) as string[]
  );
  const added: DiscoveredCompany[] = [];

  for (const company of rankCompaniesByFit(all, filters)) {
    const domain = company.domain?.toLowerCase();
    if (!domain || seen.has(domain)) continue;
    if (!passesHardCompanyGate(company, filters)) continue;
    if (!matchesCountry(company, filters.country)) continue;
    if (!passesSoftSizeGate(company, filters)) continue;

    const industryScore = scoreIndustryMatch(company, filters.industry);
    if (industryScore < RELATED_INDUSTRY_MATCH_MIN) continue;

    const validation = validateCompanyForDiscovery(company, filters);
    if (validation.accepted || !isIndustryOnlyRejection(validation.reasons)) continue;

    added.push(applyKnownBrandToCompany(company));
    seen.add(domain);
    if (added.length >= limit) break;
  }

  return added;
}

function supplementStrictMatches(
  strict: DiscoveredCompany[],
  all: DiscoveredCompany[],
  filters: CompanyCriteriaFilters,
  targetMin: number
): { companies: DiscoveredCompany[]; relaxedMatch: boolean } {
  if (strict.length >= targetMin) {
    return { companies: strict, relaxedMatch: false };
  }

  const seen = new Set(
    strict.map((company) => company.domain?.toLowerCase()).filter(Boolean) as string[]
  );
  const extra = applySoftIndustryFallback(all, filters)
    .filter((company) => company.domain && !seen.has(company.domain.toLowerCase()))
    .slice(0, targetMin - strict.length);

  let combined = [...strict, ...extra];
  let stillNeeded = targetMin - combined.length;

  if (stillNeeded > 0) {
    const recovered = recoverNearMatchCompanies(combined, all, filters, stillNeeded);
    combined = [...combined, ...recovered];
    stillNeeded = targetMin - combined.length;
  }

  if (stillNeeded > 0) {
    const related = expandRelatedIndustry(combined, all, filters, stillNeeded);
    combined = [...combined, ...related];
  }

  if (combined.length === strict.length) {
    return { companies: strict, relaxedMatch: false };
  }

  return {
    companies: combined,
    relaxedMatch: true,
  };
}

/**
 * Strict validation — only verified companies proceed to people discovery.
 * Rejected companies are returned with reasons for the UI.
 */
export function applyCriteria(
  companies: DiscoveredCompany[],
  filters: CompanyCriteriaFilters,
  options?: ApplyCriteriaOptions
): {
  companies: DiscoveredCompany[];
  filteredCount: number;
  relaxedMatch: boolean;
  rejected: RejectedCompanyView[];
} {
  const targetMin = resolveTargetMin(options);
  const accepted: DiscoveredCompany[] = [];
  const rejected: RejectedCompanyView[] = [];

  for (const company of companies) {
    const enriched = applyKnownBrandToCompany(company);
    const validation = validateCompanyForDiscovery(enriched, filters);
    if (validation.accepted) {
      accepted.push(enriched);
    } else {
      rejected.push(toRejectedCompanyView(enriched, validation));
    }
  }

  const ranked = rankCompaniesByFit(accepted, filters);

  if (ranked.length > 0) {
    const supplemented = supplementStrictMatches(ranked, companies, filters, targetMin);
    return {
      companies: supplemented.companies,
      filteredCount: rejected.length,
      relaxedMatch: supplemented.relaxedMatch,
      rejected,
    };
  }

  const soft = applySoftIndustryFallback(companies, filters).slice(0, targetMin);
  if (soft.length > 0) {
    return {
      companies: soft,
      filteredCount: rejected.length,
      relaxedMatch: true,
      rejected,
    };
  }

  return {
    companies: ranked,
    filteredCount: rejected.length,
    relaxedMatch: false,
    rejected,
  };
}
