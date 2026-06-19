import { applyCriteria } from "@/lib/company-discovery/apply-criteria";
import { applyDedup } from "@/lib/company-discovery/apply-dedup";
import { applyExclusions } from "@/lib/company-discovery/apply-exclusions";
import { isCompanyDiscoveryError } from "@/lib/company-discovery/errors";
import { createCompanyDiscoveryProvider } from "@/lib/company-discovery/factory";
import { withRetry } from "@/lib/company-discovery/retry";
import type {
  CompanyDiscoveryParams,
  CompanyDiscoveryResult,
  DiscoverCompaniesOptions,
} from "@/types/company";

export async function discoverCompanies(
  params: CompanyDiscoveryParams,
  options: DiscoverCompaniesOptions = {}
): Promise<CompanyDiscoveryResult & { attempts: number }> {
  const provider = createCompanyDiscoveryProvider();

  const { result, attempts } = await withRetry(
    async () => provider.search(params),
    { maxAttempts: 3, baseDelayMs: 600, maxDelayMs: 5000 }
  );

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

  const { companies: exclusionMatched, excludedCount } = applyExclusions(
    criteriaMatched,
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
