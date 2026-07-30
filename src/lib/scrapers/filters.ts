import type { FundingStage } from "@/lib/scraping/funding-stage";
import { companyMatchesIndustry } from "@/lib/scraping/industry-classifier";
import { profileMatchesYcIndustryFacet, profileMatchesYcRegionFacet } from "@/lib/scrapers/sources/yc-algolia-facets";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";

/**
 * Search filters a caller can apply to a scraper run. Every field is optional —
 * an empty/undefined filter means "don't constrain on this dimension".
 *
 * These are applied in two places:
 *   1. Source level — a scraper may translate them into a site query (YC's
 *      `industries`/`regions`, a GitHub `location:` qualifier, etc.) to avoid
 *      fetching non-matches. See each source module.
 *   2. Engine level — {@link matchesFilters} runs over every scraped profile as a
 *      final, source-agnostic gate. This is the guarantee that results honor the
 *      filters even for sources that can't filter server-side.
 */
export interface ScraperFilters {
  /** Primary industry, e.g. "fintech", "healthcare". Token-matched (case-insensitive). */
  industry?: string | null;
  /** Sub-category / vertical, e.g. "developer tools". Token-matched. */
  category?: string | null;
  /** Free-text location, e.g. "San Francisco", "United Kingdom", "remote". Token-matched. */
  location?: string | null;
  /** One or more acceptable funding stages. Unknown stage is kept (lenient). */
  fundingStage?: FundingStage | FundingStage[] | null;
  /** Minimum team/employee count. Unknown size is kept (lenient). */
  companySizeMin?: number | null;
  /** Maximum team/employee count. Unknown size is kept (lenient). */
  companySizeMax?: number | null;
  /** Match if ANY keyword appears in name/description/tags/industry. */
  keywords?: string[] | null;
}

/** Filters after trimming/lowercasing, with array-of-tokens shapes ready to match against. */
export interface NormalizedScraperFilters {
  industry: string[];
  /** Original industry phrase before tokenization (for semantic matching). */
  industryPhrase: string | null;
  category: string[];
  location: string[];
  /** Original location/country phrase before tokenization. */
  locationPhrase: string | null;
  fundingStages: FundingStage[];
  companySizeMin: number | null;
  companySizeMax: number | null;
  keywords: string[];
  /** True when no dimension constrains the run — {@link matchesFilters} can short-circuit. */
  isEmpty: boolean;
}

export interface FilterMatch {
  match: boolean;
  /** Human-readable reasons the profile was rejected (empty when it matched). */
  reasons: string[];
}

function toTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[^a-z0-9+]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

export function normalizeScraperFilters(
  filters: ScraperFilters | null | undefined
): NormalizedScraperFilters {
  const stages = filters?.fundingStage;
  const fundingStages = (
    Array.isArray(stages) ? stages : stages ? [stages] : []
  ).filter(Boolean) as FundingStage[];

  const keywords = (filters?.keywords ?? [])
    .map((keyword) => keyword?.trim().toLowerCase())
    .filter((keyword): keyword is string => Boolean(keyword && keyword.length > 1));

  const industry = toTokens(filters?.industry);
  const category = toTokens(filters?.category);
  const location = toTokens(filters?.location);
  const industryPhrase = filters?.industry?.trim() || null;
  const locationPhrase = filters?.location?.trim() || null;

  const companySizeMin =
    typeof filters?.companySizeMin === "number" && filters.companySizeMin > 0
      ? filters.companySizeMin
      : null;
  const companySizeMax =
    typeof filters?.companySizeMax === "number" && filters.companySizeMax > 0
      ? filters.companySizeMax
      : null;

  const isEmpty =
    industry.length === 0 &&
    category.length === 0 &&
    location.length === 0 &&
    fundingStages.length === 0 &&
    keywords.length === 0 &&
    companySizeMin === null &&
    companySizeMax === null;

  return {
    industry,
    industryPhrase,
    category,
    location,
    locationPhrase,
    fundingStages,
    companySizeMin,
    companySizeMax,
    keywords,
    isEmpty,
  };
}

/** Case-insensitive: does the haystack text contain any of the needle tokens as a substring? */
function textMatchesAny(haystack: string, needles: string[]): boolean {
  if (needles.length === 0) return true;
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

/** Expand location filter tokens so "United States" also matches YC's "USA" country codes. */
function expandLocationNeedles(needles: string[]): string[] {
  const expanded = new Set(needles);
  const joined = needles.join(" ");

  if (
    needles.includes("united") && needles.includes("states") ||
    joined.includes("united states")
  ) {
    expanded.add("usa");
    expanded.add("u.s");
    expanded.add("america");
  }
  if (needles.includes("united") && needles.includes("kingdom")) {
    expanded.add("uk");
    expanded.add("britain");
    expanded.add("england");
  }

  return [...expanded];
}

function profileSearchText(profile: ScrapedCompanyProfile): string {
  return [
    profile.name,
    profile.description,
    profile.industry,
    profile.category,
    ...profile.tags,
  ]
    .filter(Boolean)
    .join(" ");
}

function profileLocationText(profile: ScrapedCompanyProfile): string {
  return [profile.country, profile.city, profile.state, ...(profile.tags ?? [])]
    .filter(Boolean)
    .join(" ");
}

/**
 * Decide whether a scraped profile satisfies the filters.
 *
 * Lenient by design (matches the product decision): a company whose size or
 * funding stage is unknown is KEPT rather than dropped, because most public
 * directories omit that data and dropping on absence silently discards good
 * leads. Location is likewise lenient when the profile has no location at all.
 * Industry/category/keywords are only enforced when the profile actually has
 * text to match against.
 */
export function matchesFilters(
  profile: ScrapedCompanyProfile,
  filters: NormalizedScraperFilters
): FilterMatch {
  if (filters.isEmpty) return { match: true, reasons: [] };

  const reasons: string[] = [];
  const searchText = profileSearchText(profile);

  // Industry — use the semantic classifier so incidental words like "education"
  // in a B2B partner-training blurb do not match an Education search.
  if (filters.industryPhrase) {
    const industryText = [
      profile.industry,
      profile.category,
      ...profile.tags,
      profile.description,
    ]
      .filter(Boolean)
      .join(" ");
    if (!industryText.trim()) {
      reasons.push(`Industry unknown; required ${filters.industryPhrase}`);
    } else {
      const ycFacetMatch =
        profile.source === "ycombinator" &&
        profileMatchesYcIndustryFacet(
          [profile.industry, profile.category, ...profile.tags],
          filters.industryPhrase
        );
      const match = ycFacetMatch
        ? { matches: true }
        : companyMatchesIndustry(
            {
              name: profile.name,
              domain: profile.domain,
              industry: [profile.industry, profile.category, ...profile.tags]
                .filter(Boolean)
                .join(" / "),
              description: profile.description,
              websiteUrl: profile.websiteUrl,
            },
            filters.industryPhrase
          );
      if (!match.matches) {
        reasons.push(`Industry does not match ${filters.industryPhrase}`);
      }
    }
  }

  // Category — same treatment as industry.
  if (filters.category.length > 0) {
    const categoryText = [profile.category, profile.industry, ...profile.tags]
      .filter(Boolean)
      .join(" ");
    if (categoryText && !textMatchesAny(categoryText, filters.category)) {
      reasons.push(`Category does not match ${filters.category.join("/")}`);
    }
  }

  // Location — reject when the filter is set but the listing has no location.
  if (filters.location.length > 0) {
    const locationText = profileLocationText(profile);
    const locationNeedles = expandLocationNeedles(filters.location);
    const ycRegionMatch =
      profile.source === "ycombinator" &&
      filters.locationPhrase &&
      profileMatchesYcRegionFacet(
        [profile.country, profile.city, profile.state, ...(profile.tags ?? [])],
        filters.locationPhrase
      );
    if (!ycRegionMatch) {
      if (!locationText.trim()) {
        reasons.push(`Location unknown; required ${filters.location.join("/")}`);
      } else if (!textMatchesAny(locationText, locationNeedles)) {
        reasons.push(`Location does not match ${filters.location.join("/")}`);
      }
    }
  }

  // Keywords — ANY keyword must appear somewhere searchable.
  if (filters.keywords.length > 0) {
    if (searchText && !textMatchesAny(searchText, filters.keywords)) {
      reasons.push(`No keyword matched (${filters.keywords.join(", ")})`);
    }
  }

  // Company size — lenient: unknown team size passes.
  if (profile.teamSize != null) {
    if (filters.companySizeMin != null && profile.teamSize < filters.companySizeMin) {
      reasons.push(`Team size ${profile.teamSize} below minimum ${filters.companySizeMin}`);
    }
    if (filters.companySizeMax != null && profile.teamSize > filters.companySizeMax) {
      reasons.push(`Team size ${profile.teamSize} above maximum ${filters.companySizeMax}`);
    }
  }

  // Funding stage — lenient: unknown stage passes.
  if (filters.fundingStages.length > 0 && profile.fundingStage != null) {
    if (!filters.fundingStages.includes(profile.fundingStage)) {
      reasons.push(`Funding stage ${profile.fundingStage} not in requested set`);
    }
  }

  return { match: reasons.length === 0, reasons };
}
