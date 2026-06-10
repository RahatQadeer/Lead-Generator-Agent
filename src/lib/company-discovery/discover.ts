import { applyCriteria } from "@/lib/company-discovery/apply-criteria";
import { applyExclusions } from "@/lib/company-discovery/apply-exclusions";
import { isCompanyDiscoveryError } from "@/lib/company-discovery/errors";
import { createCompanyDiscoveryProvider } from "@/lib/company-discovery/factory";
import { withRetry } from "@/lib/company-discovery/retry";
import type { CompanyDiscoveryParams, CompanyDiscoveryResult } from "@/types/company";

export async function discoverCompanies(
  params: CompanyDiscoveryParams
): Promise<CompanyDiscoveryResult & { attempts: number }> {
  const provider = createCompanyDiscoveryProvider();

  const { result, attempts } = await withRetry(
    async () => provider.search(params),
    { maxAttempts: 3, baseDelayMs: 600, maxDelayMs: 5000 }
  );

  const { companies: criteriaMatched, filteredCount } = applyCriteria(
    result.companies,
    params
  );

  const { companies, excludedCount } = applyExclusions(
    criteriaMatched,
    params.exclusions
  );

  return {
    companies,
    pagination: result.pagination,
    provider: provider.name,
    filteredCount,
    excludedCount,
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
      message: "An unexpected error occurred during company discovery.",
      retryable: false,
    },
  };
}
