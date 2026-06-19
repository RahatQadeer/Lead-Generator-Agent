import { createLogger } from "@/lib/logger";
import type { CompanyDirectorySeed } from "@/lib/scraping/company-directory-seeds";
import { FAST_FETCH, fetchPage } from "@/lib/scraping/http-client";
import { mapPool } from "@/lib/scraping/parallel-pool";
import {
  PUBLIC_DATABASE_SITES,
  buildPublicDatabaseSearchQuery,
  isPublicDatabaseProfileUrl,
  matchPublicDatabaseSite,
  parsePublicDatabaseProfile,
  type PublicDatabaseId,
  type PublicDatabaseListing,
} from "@/lib/scraping/public-database-sites";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolMiss,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";

const log = createLogger("scraping.public-database");

const PROFILE_FETCH_CONCURRENCY = 2;
const MAX_PROFILES_PER_SITE = 6;

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
        "User-Agent": "LeadForge/1.0 (public database research)",
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
    log.warn("SearXNG public database search failed", { query, error: String(error) });
    recordScrapingToolFailure("searxng");
    return [];
  }
}

function listingToSeed(
  listing: PublicDatabaseListing,
  fallbackCountry: string
): CompanyDirectorySeed | null {
  if (!listing.domain) return null;

  const snippetParts = [
    `${listing.source} public listing.`,
    listing.description,
    listing.location ? `Location: ${listing.location}.` : null,
    listing.linkedinUrl ? "LinkedIn listed." : null,
  ].filter(Boolean);

  return {
    title: listing.name,
    url: listing.website ?? `https://${listing.domain}`,
    snippet: snippetParts.join(" ").slice(0, 400),
    domain: listing.domain,
    source: "public-database",
    country: listing.country ?? (fallbackCountry.trim() || null),
    city: listing.city,
    publicDatabaseSource: listing.source,
    socialLinks: listing.linkedinUrl
      ? { linkedin: listing.linkedinUrl, twitter: null, facebook: null, instagram: null }
      : undefined,
    completenessScore: listing.completenessScore,
  };
}

async function fetchPublicProfile(hit: RawSearchHit): Promise<PublicDatabaseListing | null> {
  if (!isPublicDatabaseProfileUrl(hit.url)) return null;

  const page = await fetchPage(hit.url, {
    ...FAST_FETCH,
    respectRobots: true,
    minIntervalMs: 750,
  });
  if (!page?.html) return null;

  const site = matchPublicDatabaseSite(hit.url);
  if (!site) return null;

  return parsePublicDatabaseProfile(page.html, hit.url, site.id, hit.title);
}

async function searchPublicDatabaseSite(input: {
  industry: string;
  country: string;
  keywords: string[];
  siteId: PublicDatabaseId;
  maxProfiles: number;
}): Promise<PublicDatabaseListing[]> {
  const site =
    PUBLIC_DATABASE_SITES.find((entry) => entry.id === input.siteId) ??
    PUBLIC_DATABASE_SITES[0];

  const query = buildPublicDatabaseSearchQuery(
    site,
    input.industry,
    input.country,
    input.keywords
  );

  const hits = await searchSearxngByUrl(query, input.maxProfiles * 3);
  const profileHits = hits.filter((hit) => isPublicDatabaseProfileUrl(hit.url));

  if (profileHits.length === 0) return [];

  const listings = await mapPool(
    profileHits.slice(0, input.maxProfiles),
    PROFILE_FETCH_CONCURRENCY,
    fetchPublicProfile
  );

  return listings.filter((listing): listing is PublicDatabaseListing => listing !== null);
}

function isPublicDatabaseEnabled(): boolean {
  const flag = process.env.PUBLIC_DATABASE_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

/** Scrape public Crunchbase and Wellfound profile pages for company seeds. */
export async function searchPublicDatabases(input: {
  industry: string;
  country: string;
  keywords: string[];
  maxResults?: number;
}): Promise<CompanyDirectorySeed[]> {
  if (!isPublicDatabaseEnabled()) {
    return [];
  }

  if (!getSearxngBaseUrl()) {
    log.info("Public database search skipped — SEARXNG_URL not configured");
    return [];
  }

  const maxResults = input.maxResults ?? 10;
  const perSite = Math.max(2, Math.ceil(maxResults / PUBLIC_DATABASE_SITES.length));

  const batches = await Promise.all(
    PUBLIC_DATABASE_SITES.map((site) =>
      searchPublicDatabaseSite({
        industry: input.industry,
        country: input.country,
        keywords: input.keywords,
        siteId: site.id,
        maxProfiles: Math.min(MAX_PROFILES_PER_SITE, perSite),
      })
    )
  );

  const seen = new Set<string>();
  const seeds: CompanyDirectorySeed[] = [];

  const ranked = batches
    .flat()
    .sort((a, b) => b.completenessScore - a.completenessScore);

  for (const listing of ranked) {
    const seed = listingToSeed(listing, input.country);
    if (!seed?.domain || seen.has(seed.domain)) continue;
    seen.add(seed.domain);
    seeds.push(seed);
    if (seeds.length >= maxResults) break;
  }

  if (seeds.length > 0) {
    recordScrapingToolSuccess("public-database");
  } else {
    recordScrapingToolMiss("public-database");
  }

  log.info("Public database search completed", {
    industry: input.industry,
    country: input.country,
    profilesScraped: batches.flat().length,
    withWebsite: seeds.length,
    sources: [...new Set(seeds.map((seed) => seed.publicDatabaseSource))],
  });

  return seeds;
}
