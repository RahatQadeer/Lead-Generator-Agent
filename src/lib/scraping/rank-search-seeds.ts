import type { CompanyCriteriaFilters } from "@/lib/company-discovery/apply-criteria";
import { computeCompanyFitScore } from "@/lib/scraping/company-fit-score";
import { assessCompanyRelevance } from "@/lib/scraping/company-relevance";
import type { MergedCompanySeed } from "@/lib/scraping/merge-company-seeds";
import { countriesMatch } from "@/lib/search/country-aliases";
import type { DiscoveredCompany } from "@/types/company";

function seedToCompany(seed: MergedCompanySeed, index: number): DiscoveredCompany {
  return {
    id: `seed-${index}`,
    name: seed.title,
    domain: seed.domain,
    industry: seed.industryHint ?? null,
    description: seed.snippet,
    employeeCount: null,
    country: seed.country,
    city: seed.city,
    state: null,
    linkedinUrl: seed.socialLinks?.linkedin ?? null,
    websiteUrl: seed.url,
    technologies: null,
    confidenceScore: seed.completenessScore ?? 40,
  };
}

function sourceBoost(seed: MergedCompanySeed): number {
  if (seed.directorySource === "apify") return 8;
  if (seed.seedSource === "directory") return 4;
  return 0;
}

function seedCountryBoost(seed: MergedCompanySeed, targetCountry: string): number {
  if (!targetCountry.trim()) return 0;
  if (seed.country && countriesMatch(seed.country, targetCountry, { domain: seed.domain ?? undefined })) {
    return 30;
  }
  return 0;
}

/** Drop Wikipedia list hits that name a different country in the title/snippet. */
export function seedLooksForeign(seed: MergedCompanySeed, targetCountry: string): boolean {
  if (!targetCountry.trim()) return false;

  if (
    seed.country?.trim() &&
    !countriesMatch(seed.country, targetCountry, { domain: seed.domain ?? undefined })
  ) {
    return true;
  }

  const text = `${seed.title} ${seed.snippet}`.toLowerCase();
  const target = targetCountry.toLowerCase();

  if (target.includes("pakistan") && (/\bindia\b|\(india\)|united states|\(u\.s\.\)/i.test(text))) {
    return true;
  }
  if (target.includes("united states") && /\bindia\b|\(india\)|pakistan\b/i.test(text)) {
    return true;
  }
  if (target.includes("india") && /\bpakistan\b|united states|\(u\.s\.\)/i.test(text)) {
    return true;
  }

  if (/\(united states\)|, united states\b|\(u\.s\.\)/i.test(text) && !target.includes("united states")) {
    return true;
  }
  if (/\(india\)|, india\b|\bindia\)/i.test(text) && !target.includes("india")) {
    return true;
  }

  return false;
}

/**
 * Rank scraped seeds by how well they match the user's search (industry, country, keywords).
 * High-fit Apify/directory rows surface before generic web hits.
 */
export function rankMergedSeedsBySearch(
  seeds: MergedCompanySeed[],
  filters: CompanyCriteriaFilters
): MergedCompanySeed[] {
  const search = {
    industry: filters.industry,
    keywords: filters.keywords ?? [],
  };

  const scored = seeds.map((seed, index) => {
    const company = seedToCompany(seed, index);
    const relevance = assessCompanyRelevance(company, search);
    const fit = relevance.relevant ? computeCompanyFitScore(company, filters) : 0;
    const completeness = (seed.completenessScore ?? 0) * 0.25;
    const foreignPenalty = seedLooksForeign(seed, filters.country) ? -100 : 0;
    const score =
      fit + completeness + sourceBoost(seed) + seedCountryBoost(seed, filters.country) + foreignPenalty;

    return { seed, score, relevant: relevance.relevant && foreignPenalty === 0 };
  });

  return scored
    .sort((a, b) => {
      if (a.relevant !== b.relevant) return a.relevant ? -1 : 1;
      return b.score - a.score;
    })
    .map((entry) => entry.seed);
}
