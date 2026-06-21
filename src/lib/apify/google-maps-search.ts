import { createLogger } from "@/lib/logger";
import { runApifyActorSync } from "@/lib/apify/client";
import {
  getApifyGoogleMapsActorId,
  getApifyMaxPlacesPerSearch,
  isApifyEnabled,
} from "@/lib/apify/config";
import type { CompanyDirectorySeed } from "@/lib/scraping/company-directory-seeds";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import { buildCompanySearchQuery } from "@/lib/scraping/web-search";
import { normalizeCountryName } from "@/lib/search/country-aliases";
import { parseSearchIntent } from "@/lib/search/search-intent";

const log = createLogger("apify.google-maps");

export interface ApifyGoogleMapsPlace {
  title?: string;
  name?: string;
  website?: string;
  phone?: string;
  address?: string;
  full_address?: string;
  city?: string;
  state?: string;
  countryCode?: string;
  country?: string;
  categoryName?: string;
  category?: string;
  totalScore?: number;
  reviewsCount?: number;
  url?: string;
  placeId?: string;
  emails?: string[];
  linkedIns?: string[];
  linkedin?: string;
}

function pickName(item: ApifyGoogleMapsPlace): string | null {
  const name = (item.title ?? item.name ?? "").trim();
  return name || null;
}

function pickCountry(item: ApifyGoogleMapsPlace, fallback: string): string | null {
  const raw = item.countryCode?.trim() || item.country?.trim() || fallback?.trim();
  if (!raw) return null;
  if (fallback && normalizeCountryName(raw) === normalizeCountryName(fallback)) {
    return fallback;
  }
  return raw;
}

function completenessScore(item: ApifyGoogleMapsPlace): number {
  let score = 45;
  if (item.website?.trim()) score += 25;
  if (item.phone?.trim()) score += 10;
  if (item.city?.trim()) score += 5;
  if (item.categoryName || item.category) score += 5;
  if ((item.emails?.length ?? 0) > 0) score += 10;
  if (item.linkedin || (item.linkedIns?.length ?? 0) > 0) score += 5;
  return Math.min(95, score);
}

/** Map a Google Maps scraper dataset row to a company directory seed. */
export function mapApifyGoogleMapsPlaceToSeed(
  item: ApifyGoogleMapsPlace,
  fallbackCountry: string
): CompanyDirectorySeed | null {
  const name = pickName(item);
  const website = item.website?.trim();
  if (!name || !website) return null;

  const domain = extractDomainFromUrl(website);
  if (!domain) return null;

  const category = item.categoryName ?? item.category ?? "";
  const address = item.address ?? item.full_address ?? "";
  const snippet = [category, address].filter(Boolean).join(" — ").slice(0, 280);

  const linkedin =
    item.linkedin?.trim() ||
    item.linkedIns?.find((url) => /linkedin\.com/i.test(url))?.trim() ||
    null;

  return {
    title: name,
    url: website.startsWith("http") ? website : `https://${website}`,
    snippet: snippet || `${name} — Google Maps listing`,
    domain,
    source: "apify",
    country: pickCountry(item, fallbackCountry),
    city: item.city?.trim() || null,
    phone: item.phone?.trim() || null,
    industryHint: category || null,
    socialLinks: linkedin
      ? { linkedin, twitter: null, facebook: null, instagram: null }
      : undefined,
    completenessScore: completenessScore(item),
  };
}

function buildApifySearchQueries(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
}): string[] {
  const primary = buildCompanySearchQuery({
    industry: input.industry,
    country: input.country,
    keywords: input.keywords,
    technologies: [],
  });

  const intent = parseSearchIntent({
    searchName: input.searchName,
    industry: input.industry,
    country: input.country,
    keywords: input.keywords,
  });

  const queries = [primary, ...intent.queryVariants].filter(Boolean);
  return [...new Set(queries.map((q) => q.trim()))].slice(0, 3);
}

/**
 * Discover company seeds via Apify Google Maps Scraper.
 * Requires APIFY_API_TOKEN and APIFY_ENABLED=true.
 */
export async function searchApifyGoogleMapsCompanies(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  maxResults?: number;
}): Promise<CompanyDirectorySeed[]> {
  if (!isApifyEnabled()) return [];

  const searchQueries = buildApifySearchQueries(input);
  if (searchQueries.length === 0) return [];

  const maxResults = input.maxResults ?? 15;
  const maxPerSearch = Math.min(
    getApifyMaxPlacesPerSearch(),
    Math.ceil(maxResults / searchQueries.length)
  );

  try {
    const items = await runApifyActorSync<ApifyGoogleMapsPlace>({
      actorId: getApifyGoogleMapsActorId(),
      toolId: "apify-google-maps",
      maxItems: maxResults,
      input: {
        searchStringsArray: searchQueries,
        locationQuery: input.country.trim() || undefined,
        maxCrawledPlacesPerSearch: maxPerSearch,
        language: "en",
        scrapeContacts: false,
        skipClosedPlaces: true,
      },
    });

    const seen = new Set<string>();
    const seeds: CompanyDirectorySeed[] = [];

    for (const item of items) {
      const seed = mapApifyGoogleMapsPlaceToSeed(item, input.country);
      if (!seed?.domain || seen.has(seed.domain)) continue;
      seen.add(seed.domain);
      seeds.push(seed);
      if (seeds.length >= maxResults) break;
    }

    log.info("Apify Google Maps companies mapped", {
      queries: searchQueries,
      raw: items.length,
      kept: seeds.length,
    });

    return seeds;
  } catch (error) {
    log.warn("Apify Google Maps search failed", {
      queries: searchQueries,
      error: String(error),
    });
    return [];
  }
}
