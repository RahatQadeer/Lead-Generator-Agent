import { applyDedup } from "@/lib/contact-discovery/apply-dedup";
import { applyTitleFilter } from "@/lib/contact-discovery/apply-title-filter";
import { isContactDiscoveryError } from "@/lib/contact-discovery/errors";
import { createContactDiscoveryProvider } from "@/lib/contact-discovery/factory";
import { withRetry } from "@/lib/contact-discovery/retry";
import type {
  ContactDiscoveryParams,
  ContactDiscoveryResult,
  DiscoverContactsOptions,
} from "@/types/contact";

export async function discoverContacts(
  params: ContactDiscoveryParams,
  options: DiscoverContactsOptions = {}
): Promise<ContactDiscoveryResult & { attempts: number }> {
  const provider = createContactDiscoveryProvider();

  const { result, attempts } = await withRetry(
    async () => provider.search(params),
    { maxAttempts: 3, baseDelayMs: 600, maxDelayMs: 5000 }
  );

  const { contacts: titleMatched, filteredCount } = applyTitleFilter(
    result.contacts,
    params.jobTitles
  );

  const {
    contacts,
    duplicateCount,
    batchDuplicateCount,
    knownDuplicateCount,
  } = applyDedup(titleMatched, options.knownDedupKeys);

  return {
    contacts,
    pagination: result.pagination,
    provider: provider.name,
    filteredCount,
    duplicateCount,
    batchDuplicateCount,
    knownDuplicateCount,
    attempts,
  };
}

export function toContactDiscoveryErrorResponse(error: unknown) {
  if (isContactDiscoveryError(error)) {
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
      message: "An unexpected error occurred during contact discovery.",
      retryable: false,
    },
  };
}
