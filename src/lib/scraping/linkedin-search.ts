import { createLogger } from "@/lib/logger";
import {
  searchLinkedInProfile,
  type LinkedInProfileSearchResult,
} from "@/lib/scraping/linkedin-profile-search";
import type { LinkedInSource } from "@/types/lead";

const log = createLogger("scraping.linkedin-search");

export interface LinkedInDiscoveryResult {
  url: string | null;
  source: LinkedInSource;
  resolvedFullName?: string | null;
  headline?: string | null;
  companyMatch?: boolean;
  confidenceScore?: number;
  searchBackend?: LinkedInProfileSearchResult["searchBackend"];
}

export type { LinkedInProfileSearchInput, LinkedInProfileSearchResult } from "@/lib/scraping/linkedin-profile-search";
export {
  buildLinkedInProfileSearchQueries,
  buildNameAndRoleLinkedInQuery,
  buildNaturalLinkedInSearchQuery,
  buildPrimaryLinkedInGoogleQuery,
  extractLinkedInHitsFromMixedResults,
  isExactLinkedInSearchHit,
  isLinkedInWebSearchAvailable,
  meaningfulRoleKeywords,
  pickLinkedInFromOrderedHits,
  searchLinkedInProfile,
} from "@/lib/scraping/linkedin-profile-search";

/**
 * Discover a person's LinkedIn via structured Google/Bing profile search.
 */
export async function discoverPersonLinkedIn(
  fullName: string,
  companyName: string,
  companyDomain?: string | null,
  jobTitle?: string | null,
  options?: { requireCompanyMatch?: boolean }
): Promise<LinkedInDiscoveryResult> {
  const result = await searchLinkedInProfile({
    fullName,
    jobTitle: jobTitle?.trim() || "Team Member",
    companyName,
    companyDomain,
    requireCompanyMatch: options?.requireCompanyMatch,
  });

  if (!result) {
    return { url: null, source: null };
  }

  log.info("LinkedIn profile resolved for contact", {
    fullName,
    companyName,
    jobTitle,
    url: result.url,
    confidenceScore: result.confidenceScore,
    companyMatch: result.companyMatch,
    backend: result.searchBackend,
  });

  return {
    url: result.url,
    source: result.source,
    resolvedFullName: result.fullName,
    headline: result.headline,
    companyMatch: result.companyMatch,
    confidenceScore: result.confidenceScore,
    searchBackend: result.searchBackend,
  };
}

/** @deprecated Use discoverPersonLinkedIn */
export async function searchPersonLinkedIn(
  fullName: string,
  companyName: string
): Promise<string | null> {
  const result = await discoverPersonLinkedIn(fullName, companyName);
  return result.url;
}
