import { computeCompanyFitScore } from "@/lib/scraping/company-fit-score";
import { applyKnownBrandToCompany } from "@/lib/scraping/known-brands";
import { profileMatchesYcIndustryFacet, profileMatchesYcRegionFacet } from "@/lib/scrapers/sources/yc-algolia-facets";
import {
  matchesCountry,
  matchesIndustry,
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
const SOFT_FALLBACK_MAX = 300;
const INCLUSIVE_FIT_MIN = 20;
const SOFT_INDUSTRY_MATCH_MIN = 0.12;
/**
 * Minimum industry overlap to include a company rejected only for industry
 * mismatch. Must stay strictly above CONFLICTING_INDUSTRY_SCORE: when the two
 * were equal, "confidently the wrong industry" cleared the gate and this
 * expansion silently re-admitted every company the validator had just rejected.
 */
const RELATED_INDUSTRY_MATCH_MIN = 0.35;

export interface ApplyCriteriaOptions {
  /** Minimum companies to return before pagination (defaults to 30). */
  targetMinResults?: number;
  /** Hard cap on companies returned after inclusive expansion (defaults to 500). */
  maxResults?: number;
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

/** Ranked companies that match geography and hard gates but missed strict industry validation. */
function expandInclusiveFitMatches(
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
    // Inclusive on everything except the industry the user actually asked for —
    // without this, fit score alone let through companies with no industry
    // overlap at all, since unset filters award their points unconditionally.
    if (scoreIndustryMatch(company, filters.industry) < SOFT_INDUSTRY_MATCH_MIN) continue;
    if (computeCompanyFitScore(company, filters) < INCLUSIVE_FIT_MIN) continue;

    const validation = validateCompanyForDiscovery(company, filters);
    if (validation.accepted) continue;

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
  options: { targetMin: number; maxResults: number }
): { companies: DiscoveredCompany[]; relaxedMatch: boolean } {
  const { targetMin, maxResults } = options;
  let combined = [...strict];
  let relaxedMatch = false;

  const seen = new Set(
    combined.map((company) => company.domain?.toLowerCase()).filter(Boolean) as string[]
  );

  const room = () => Math.max(0, maxResults - combined.length);

  const append = (extra: DiscoveredCompany[]) => {
    if (extra.length === 0) return;
    combined = [...combined, ...extra];
    relaxedMatch = true;
    for (const company of extra) {
      const domain = company.domain?.toLowerCase();
      if (domain) seen.add(domain);
    }
  };

  if (room() > 0) {
    append(
      applySoftIndustryFallback(all, filters)
        .filter((company) => company.domain && !seen.has(company.domain.toLowerCase()))
        .slice(0, room())
    );
  }

  if (room() > 0) {
    append(recoverNearMatchCompanies(combined, all, filters, room()));
  }

  if (room() > 0) {
    append(expandRelatedIndustry(combined, all, filters, room()));
  }

  if (room() > 0) {
    append(expandInclusiveFitMatches(combined, all, filters, room()));
  }

  // Legacy minimum target — only relevant when strict results are very sparse.
  let stillNeeded = targetMin - combined.length;
  if (stillNeeded > 0 && room() > 0) {
    append(recoverNearMatchCompanies(combined, all, filters, Math.min(stillNeeded, room())));
    stillNeeded = targetMin - combined.length;
  }

  if (combined.length === strict.length) {
    return { companies: rankCompaniesByFit(strict, filters), relaxedMatch: false };
  }

  return {
    companies: rankCompaniesByFit(combined, filters).slice(0, maxResults),
    relaxedMatch,
  };
}

/**
 * Hard gate for merged discovery results — requires an actual industry and country
 * match when the user set those filters. Unlike web-search seeds, directory/YC
 * listings always carry this metadata so unknown values are rejected.
 */
export function passesStrictSearchFilters(
  company: DiscoveredCompany,
  filters: CompanyCriteriaFilters
): boolean {
  const enriched = applyKnownBrandToCompany(company);
  const validation = validateCompanyForDiscovery(enriched, filters);
  if (!validation.accepted) return false;

  if (filters.country.trim()) {
    const ycRegionMatch =
      enriched.id.startsWith("ycombinator:") &&
      profileMatchesYcRegionFacet(
        [enriched.country, enriched.city, enriched.state, ...(enriched.technologies ?? [])],
        filters.country
      );
    if (!ycRegionMatch) {
      if (!enriched.country?.trim()) return false;
      if (!matchesCountry(enriched, filters.country)) return false;
    }
  }

  if (filters.industry.trim()) {
    const ycFacetMatch =
      enriched.id.startsWith("ycombinator:") &&
      profileMatchesYcIndustryFacet(
        [enriched.industry, ...(enriched.technologies ?? [])],
        filters.industry
      );
    if (!ycFacetMatch && !matchesIndustry(enriched, filters.industry)) {
      return false;
    }
  }

  return true;
}

export function filterCompaniesBySearchCriteria(
  companies: DiscoveredCompany[],
  filters: CompanyCriteriaFilters
): DiscoveredCompany[] {
  if (!filters.industry?.trim() && !filters.country?.trim()) {
    return companies;
  }

  return companies
    .map(applyKnownBrandToCompany)
    .filter((company) => passesStrictSearchFilters(company, filters));
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
  const maxResults = Math.max(1, options?.maxResults ?? 500);
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
    const supplemented = supplementStrictMatches(ranked, companies, filters, {
      targetMin,
      maxResults,
    });
    return {
      companies: supplemented.companies,
      filteredCount: rejected.length,
      relaxedMatch: supplemented.relaxedMatch,
      rejected,
    };
  }

  const soft = applySoftIndustryFallback(companies, filters).slice(
    0,
    Math.min(targetMin, maxResults)
  );
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
