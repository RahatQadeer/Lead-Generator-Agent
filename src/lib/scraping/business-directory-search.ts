import { createLogger } from "@/lib/logger";
import type { CompanyDirectorySeed } from "@/lib/scraping/company-directory-seeds";
import {
  isGooglePlacesConfigured,
  searchGooglePlacesCompanies,
} from "@/lib/scraping/google-places-search";
import {
  BUSINESS_DIRECTORY_SITES,
  buildDirectorySearchQueries,
  dedupeBusinessDirectoryListings,
  isBusinessDirectoryProfileUrl,
  isChamberProfileUrl,
  matchBusinessDirectorySite,
  parseBusinessDirectoryProfile,
  rankListingsByCompleteness,
  type BusinessDirectoryId,
  type BusinessDirectoryListing,
} from "@/lib/scraping/business-directory-sites";
import { FAST_FETCH, fetchPage } from "@/lib/scraping/http-client";
import { mapPool } from "@/lib/scraping/parallel-pool";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolMiss,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";

const log = createLogger("scraping.business-directory");

const PROFILE_FETCH_CONCURRENCY = 3;
const MAX_PROFILES_PER_SITE = 10;

interface RawSearchHit {
  title: string;
  url: string;
  snippet: string;
}

async function searchSearxngByUrl(
  query: string,
  maxResults: number
): Promise<RawSearchHit[]> {
  const baseUrl = getSearxngBaseUrl();
  if (!baseUrl || !isScrapingToolAvailable("searxng")) return [];

  const searchUrl = new URL("/search", baseUrl);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("categories", "general");

  try {
    const response = await fetch(searchUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeadForge/1.0 (business directory research)",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      recordScrapingToolFailure("searxng");
      return [];
    }

    const body = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };

    const seen = new Set<string>();
    const hits: RawSearchHit[] = [];

    for (const item of body.results ?? []) {
      if (!item.url || !item.title) continue;
      const normalizedUrl = item.url.split("#")[0] ?? item.url;
      if (seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);
      hits.push({
        title: item.title.trim(),
        url: normalizedUrl,
        snippet: item.content?.trim() ?? "",
      });
      if (hits.length >= maxResults) break;
    }

    return hits;
  } catch (error) {
    log.warn("SearXNG directory search failed", { query, error: String(error) });
    recordScrapingToolFailure("searxng");
    return [];
  }
}

function resolveProfileSource(url: string): BusinessDirectoryId {
  const matched = matchBusinessDirectorySite(url);
  if (matched) return matched.id;
  if (isChamberProfileUrl(url)) return "chamber";
  return "hotfrog";
}

function buildChamberSearchQuery(
  industry: string,
  country: string,
  keywords: string[]
): string {
  const terms = [industry, ...keywords.slice(0, 2), country].filter(Boolean);
  return `("chamber of commerce" OR "chamber directory") ${terms.join(" ")} (member OR business OR company)`;
}

function listingToSeed(
  listing: BusinessDirectoryListing,
  fallbackCountry: string
): CompanyDirectorySeed | null {
  if (!listing.domain) return null;

  const snippetParts = [
    `${listing.source} business directory.`,
    listing.description,
    listing.location ? `Location: ${listing.location}.` : null,
    listing.phone ? `Phone: ${listing.phone}.` : null,
    listing.socialLinks.linkedin ? "LinkedIn listed." : null,
  ].filter(Boolean);

  return {
    title: listing.name,
    url: listing.website ?? `https://${listing.domain}`,
    snippet: snippetParts.join(" ").slice(0, 400),
    domain: listing.domain,
    source: "business-directory",
    country: listing.country ?? (fallbackCountry.trim() || null),
    city: listing.city,
    directoryListingSource: listing.source,
    phone: listing.phone,
    socialLinks: listing.socialLinks,
    completenessScore: listing.completenessScore,
  };
}

async function fetchDirectoryProfile(
  hit: RawSearchHit
): Promise<BusinessDirectoryListing | null> {
  if (!isBusinessDirectoryProfileUrl(hit.url)) return null;

  const page = await fetchPage(hit.url, {
    ...FAST_FETCH,
    respectRobots: true,
    minIntervalMs: 500,
  });
  if (!page?.html) return null;

  const source = resolveProfileSource(hit.url);
  return parseBusinessDirectoryProfile(page.html, hit.url, source, hit.title);
}

async function searchDirectorySite(input: {
  industry: string;
  country: string;
  keywords: string[];
  siteId: BusinessDirectoryId;
  maxProfiles: number;
}): Promise<BusinessDirectoryListing[]> {
  const site =
    BUSINESS_DIRECTORY_SITES.find((entry) => entry.id === input.siteId) ??
    BUSINESS_DIRECTORY_SITES[0];

  const queries =
    input.siteId === "chamber"
      ? [buildChamberSearchQuery(input.industry, input.country, input.keywords)]
      : buildDirectorySearchQueries(site, input.industry, input.country, input.keywords);

  const hitBatches = await Promise.all(
    queries.map((query) => searchSearxngByUrl(query, input.maxProfiles * 3))
  );
  const hits = hitBatches.flat();
  const profileHits = hits.filter((hit) => isBusinessDirectoryProfileUrl(hit.url));

  if (profileHits.length === 0) {
    return [];
  }

  const listings = await mapPool(
    profileHits.slice(0, input.maxProfiles),
    PROFILE_FETCH_CONCURRENCY,
    fetchDirectoryProfile
  );

  return listings.filter((listing): listing is BusinessDirectoryListing => listing !== null);
}

function isBusinessDirectoryEnabled(): boolean {
  const flag = process.env.BUSINESS_DIRECTORY_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

/**
 * Search Hotfrog, Manta, Brownbook, Cylex, Kompass, Clutch, Chamber of Commerce,
 * GoodFirms, and Europages for companies matching industry and country.
 * Extracts structured fields, deduplicates, and ranks by data completeness.
 */
export async function searchBusinessDirectories(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  maxResults?: number;
}): Promise<CompanyDirectorySeed[]> {
  if (!isBusinessDirectoryEnabled()) {
    return [];
  }

  const maxResults = input.maxResults ?? 20;
  const seeds: CompanyDirectorySeed[] = [];
  const seen = new Set<string>();

  const addSeed = (seed: CompanyDirectorySeed | null) => {
    if (!seed?.domain || seen.has(seed.domain)) return;
    seen.add(seed.domain);
    seeds.push(seed);
  };

  if (isGooglePlacesConfigured()) {
    const googleQuota = Math.max(3, Math.ceil(maxResults * 0.6));
    const googleSeeds = await searchGooglePlacesCompanies({
      industry: input.industry,
      country: input.country,
      keywords: input.keywords,
      searchName: input.searchName,
      maxResults: googleQuota,
    });

    for (const seed of googleSeeds) {
      addSeed(seed);
      if (seeds.length >= maxResults) break;
    }

    log.info("Google Maps API seeds merged into business directory", {
      googleSeeds: googleSeeds.length,
      kept: seeds.length,
    });
  }

  if (seeds.length >= maxResults) {
    recordScrapingToolSuccess("business-directory");
    return seeds;
  }

  if (!getSearxngBaseUrl()) {
    if (seeds.length > 0) {
      recordScrapingToolSuccess("business-directory");
    } else {
      log.info(
        "Business directory search skipped — set GOOGLE_PLACES_API_KEY or SEARXNG_URL"
      );
      recordScrapingToolMiss("business-directory");
    }
    return seeds;
  }

  const remaining = maxResults - seeds.length;
  const perSite = Math.max(2, Math.ceil(remaining / BUSINESS_DIRECTORY_SITES.length));

  const batches = await Promise.all(
    BUSINESS_DIRECTORY_SITES.map((site) =>
      searchDirectorySite({
        industry: input.industry,
        country: input.country,
        keywords: input.keywords,
        siteId: site.id,
        maxProfiles: Math.min(MAX_PROFILES_PER_SITE, perSite),
      })
    )
  );

  const deduped = dedupeBusinessDirectoryListings(batches.flat());
  const ranked = rankListingsByCompleteness(deduped);

  for (const listing of ranked) {
    const seed = listingToSeed(listing, input.country);
    addSeed(seed);
    if (seeds.length >= maxResults) break;
  }

  if (seeds.length > 0) {
    recordScrapingToolSuccess("business-directory");
  } else if (batches.some((batch) => batch.length > 0)) {
    recordScrapingToolMiss("business-directory");
  } else {
    recordScrapingToolMiss("business-directory");
  }

  log.info("Business directory search completed", {
    industry: input.industry,
    country: input.country,
    profilesScraped: batches.flat().length,
    deduped: deduped.length,
    withWebsite: seeds.length,
    sources: [...new Set(seeds.map((seed) => seed.directoryListingSource ?? seed.source))],
  });

  return seeds;
}
