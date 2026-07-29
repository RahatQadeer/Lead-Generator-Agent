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

export type {
  LinkedInProfileSearchInput,
  LinkedInProfileSearchResult,
  LinkedInSearchLayer,
} from "@/lib/scraping/linkedin-profile-search";
export {
  buildLinkedInProfileSearchQueries,
  buildLinkedInSearchLayers,
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
export interface DiscoverPersonLinkedInOptions {
  requireCompanyMatch?: boolean;
  companyCity?: string | null;
  companyState?: string | null;
  companyCountry?: string | null;
}

export async function discoverPersonLinkedIn(
  fullName: string,
  companyName: string,
  companyDomain?: string | null,
  jobTitle?: string | null,
  options?: DiscoverPersonLinkedInOptions
): Promise<LinkedInDiscoveryResult> {
  const baseInput = {
    fullName,
    jobTitle: jobTitle?.trim() || "Team Member",
    companyName,
    companyDomain,
    companyCity: options?.companyCity,
    companyState: options?.companyState,
    companyCountry: options?.companyCountry,
  };

  let result: LinkedInProfileSearchResult | null = null;

  if (options?.requireCompanyMatch !== false) {
    result = await searchLinkedInProfile({
      ...baseInput,
      requireCompanyMatch: true,
    });
  }

  if (!result) {
    result = await searchLinkedInProfile({
      ...baseInput,
      requireCompanyMatch: false,
    });
  }

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
