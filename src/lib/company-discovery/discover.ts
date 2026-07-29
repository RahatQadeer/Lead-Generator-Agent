import { applyCriteria } from "@/lib/company-discovery/apply-criteria";
import { applyDedup, getCompanyDedupKey } from "@/lib/company-discovery/apply-dedup";
import { applyExclusions } from "@/lib/company-discovery/apply-exclusions";
import { isCompanyDiscoveryError } from "@/lib/company-discovery/errors";
import { createCompanyDiscoveryProvider } from "@/lib/company-discovery/factory";
import { runDirectoryScraperDiscovery } from "@/lib/company-discovery/directory-scraper-source";
import { withRetry } from "@/lib/company-discovery/retry";
import type {
  CompanyDiscoveryParams,
  CompanyDiscoveryResult,
  DiscoverCompaniesOptions,
  DiscoveredCompany,
} from "@/types/company";

/**
 * Fold directory-scraper companies into the provider's results. Companies that
 * share a dedup key (same domain) are merged — the provider's enriched/verified
 * record wins on core fields, but the scraper's founders + directory profile are
 * grafted on. Scraper-only companies are appended.
 */
function mergeDirectoryCompanies(
  base: DiscoveredCompany[],
  scraped: DiscoveredCompany[]
): DiscoveredCompany[] {
  if (scraped.length === 0) return base;

  const indexByKey = new Map<string, number>();
  base.forEach((company, index) => {
    const key = getCompanyDedupKey(company);
    if (key) indexByKey.set(key, index);
  });

  const merged = [...base];
  for (const company of scraped) {
    const key = getCompanyDedupKey(company);
    const existingIndex = key ? indexByKey.get(key) : undefined;

    if (existingIndex === undefined) {
      if (key) indexByKey.set(key, merged.length);
      merged.push(company);
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      founders: existing.founders?.length ? existing.founders : company.founders,
      directoryProfile: existing.directoryProfile ?? company.directoryProfile,
      fundingStage: existing.fundingStage ?? company.fundingStage,
      linkedinUrl: existing.linkedinUrl ?? company.linkedinUrl,
    };
  }
  return merged;
}

export async function discoverCompanies(
  params: CompanyDiscoveryParams,
  options: DiscoverCompaniesOptions = {}
): Promise<CompanyDiscoveryResult & { attempts: number }> {
  const provider = createCompanyDiscoveryProvider();

  // Directory scrapers (YC, Product Hunt, GitHub, …) run as a parallel discovery
  // source. It never throws, so it can't break the primary web/directory search.
  const directoryScraperPromise = runDirectoryScraperDiscovery(params, {
    knownDedupKeys: options.knownDedupKeys,
    onProgress: options.onProgress,
    userId: options.userId,
    searchId: options.searchId,
  });

  const [{ result, attempts }, scrapedCompanies] = await Promise.all([
    withRetry(
      async () => provider.search(params, { onProgress: options.onProgress }),
      { maxAttempts: 3, baseDelayMs: 600, maxDelayMs: 5000 }
    ),
    directoryScraperPromise,
  ]);

  const seedCount = result.stats?.seedCount;
  const enrichedCount = result.stats?.enrichedCount;
  const providerFilteredCount = result.stats?.filteredCount ?? 0;
  const providerRelaxedMatch = result.stats?.relaxedMatch ?? false;

  // Scraping/mock providers filter during search; use their counts for diagnostics.
  const providerPreFilters = provider.name === "scraping" || provider.name === "mock";
  const criteriaResult = providerPreFilters
    ? {
        companies: result.companies,
        filteredCount: providerFilteredCount,
        relaxedMatch: providerRelaxedMatch,
        rejected: result.rejected ?? [],
      }
    : applyCriteria(result.companies, params);

  const {
    companies: criteriaMatched,
    filteredCount,
    relaxedMatch,
    rejected,
  } = criteriaResult;

  // Fold in directory-scraper companies (already filtered by the engine's own
  // matchesFilters) alongside the provider's results, then apply the shared
  // exclusions + dedup so both sources are treated identically.
  const withDirectory = mergeDirectoryCompanies(criteriaMatched, scrapedCompanies);

  const { companies: exclusionMatched, excludedCount } = applyExclusions(
    withDirectory,
    params.exclusions
  );

  const {
    companies,
    duplicateCount,
    batchDuplicateCount,
    knownDuplicateCount,
  } = applyDedup(exclusionMatched, options.knownDedupKeys);

  return {
    companies,
    pagination: result.pagination,
    provider: provider.name,
    filteredCount,
    excludedCount,
    duplicateCount,
    batchDuplicateCount,
    knownDuplicateCount,
    seedCount,
    enrichedCount,
    relaxedMatch,
    rejected,
    attempts,
  };
}

export function toDiscoveryErrorResponse(error: unknown) {
  if (isCompanyDiscoveryError(error)) {
    return {
      success: false as const,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  return {
    success: false as const,
    error: {
      code: "PROVIDER_ERROR" as const,
      message: "Something went wrong while looking for companies. Please try again.",
      retryable: false,
    },
  };
}
