import { createLogger } from "@/lib/logger";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import type { CompanyDirectorySeed } from "@/lib/scraping/company-directory-seeds";
import { buildCompanySearchQuery } from "@/lib/scraping/web-search";
import { countryToIsoCode } from "@/lib/search/jurisdiction-codes";
import { parseSearchIntent } from "@/lib/search/search-intent";

const log = createLogger("scraping.google-places");
const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

/** Types we don't want as B2B company leads. */
const EXCLUDED_PLACE_TYPES = new Set([
  "school",
  "university",
  "hospital",
  "doctor",
  "dentist",
  "pharmacy",
  "church",
  "mosque",
  "hindu_temple",
  "synagogue",
  "cemetery",
  "park",
  "museum",
  "library",
  "local_government_office",
  "city_hall",
  "courthouse",
  "police",
  "fire_station",
  "post_office",
  "bus_station",
  "train_station",
  "airport",
  "atm",
  "gas_station",
  "grocery_store",
  "supermarket",
  "restaurant",
  "cafe",
  "bar",
  "night_club",
  "lodging",
  "hotel",
]);

interface GooglePlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  types?: string[];
  primaryType?: string;
  businessStatus?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
}

interface GooglePlacesSearchResponse {
  places?: GooglePlace[];
  error?: { message?: string; status?: string };
}

function getApiKey(): string | null {
  const key =
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

function isGoogleMapsDirectoryEnabled(): boolean {
  const flag = process.env.GOOGLE_MAPS_DIRECTORY_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

function buildTextQueries(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  companySizeMin?: number | null;
  companySizeMax?: number | null;
}): string[] {
  const primary = buildCompanySearchQuery({
    industry: input.industry,
    country: input.country,
    keywords: input.keywords,
    technologies: [],
    companySizeMin: input.companySizeMin,
    companySizeMax: input.companySizeMax,
  });

  const intent = parseSearchIntent({
    searchName: input.searchName,
    industry: input.industry,
    country: input.country,
    keywords: input.keywords,
    companySizeMin: input.companySizeMin,
    companySizeMax: input.companySizeMax,
  });

  const queries = [primary, ...intent.queryVariants].filter(Boolean);
  return [...new Set(queries.map((query) => query.trim()))].slice(0, 6);
}

function placeCompletenessScore(place: GooglePlace): number {
  let score = 45;
  if (place.websiteUri?.trim()) score += 25;
  if (place.nationalPhoneNumber?.trim() || place.internationalPhoneNumber?.trim()) {
    score += 10;
  }
  if (place.formattedAddress?.trim()) score += 5;
  if (place.primaryType || place.types?.length) score += 5;
  return Math.min(95, score);
}

function parseCityFromAddress(address: string | undefined): string | null {
  if (!address?.trim()) return null;
  const segments = address.split(",").map((s) => s.trim());
  if (segments.length >= 2) {
    return segments[segments.length - 2] ?? null;
  }
  return segments[0] ?? null;
}

function isExcludedPlace(types: string[] | undefined): boolean {
  if (!types?.length) return false;
  return types.some((type) => EXCLUDED_PLACE_TYPES.has(type.toLowerCase()));
}

function mapPlaceToSeed(
  place: GooglePlace,
  fallbackCountry: string
): CompanyDirectorySeed | null {
  const name = place.displayName?.text?.trim();
  const website = place.websiteUri?.trim();
  if (!name || !website) return null;

  if (place.businessStatus && place.businessStatus !== "OPERATIONAL") return null;
  if (isExcludedPlace(place.types)) return null;

  const domain = extractDomainFromUrl(website);
  if (!domain) return null;

  const address = place.formattedAddress ?? "";
  const city = parseCityFromAddress(address);
  const typeHint =
    place.primaryType?.replace(/_/g, " ") ??
    place.types?.slice(0, 3).join(", ").replace(/_/g, " ") ??
    "";
  const phone =
    place.nationalPhoneNumber?.trim() ||
    place.internationalPhoneNumber?.trim() ||
    null;

  const snippetParts = [
    "Google Maps business directory.",
    address ? `Address: ${address.slice(0, 100)}.` : null,
    typeHint ? `Category: ${typeHint}.` : null,
    phone ? `Phone: ${phone}.` : null,
  ].filter(Boolean);

  return {
    title: name,
    url: website.startsWith("http") ? website : `https://${website}`,
    snippet: snippetParts.join(" "),
    domain,
    source: "google-places",
    country: fallbackCountry.trim() || null,
    city,
    phone,
    industryHint: typeHint || null,
    completenessScore: placeCompletenessScore(place),
  };
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(getApiKey()) && isGoogleMapsDirectoryEnabled();
}

export async function searchGooglePlacesCompanies(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  maxResults?: number;
}): Promise<CompanyDirectorySeed[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    log.info(
      "Google Places skipped — set GOOGLE_PLACES_API_KEY (free $200/mo credit at console.cloud.google.com)"
    );
    return [];
  }

  const textQueries = buildTextQueries(input);
  if (textQueries.length === 0) return [];

  const maxResults = Math.min(input.maxResults ?? 15, 30);
  const regionCode = countryToIsoCode(input.country)?.toUpperCase() ?? undefined;
  const perQuery = Math.max(3, Math.ceil(maxResults / textQueries.length));

  const seeds: CompanyDirectorySeed[] = [];
  const seen = new Set<string>();

  for (const textQuery of textQueries) {
    if (seeds.length >= maxResults) break;

    try {
      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.websiteUri,places.types,places.primaryType,places.businessStatus,places.nationalPhoneNumber,places.internationalPhoneNumber",
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: Math.min(perQuery, 20),
          languageCode: "en",
          ...(regionCode ? { regionCode } : {}),
        }),
        signal: AbortSignal.timeout(25_000),
      });

      const body = (await response.json()) as GooglePlacesSearchResponse;

      if (!response.ok) {
        log.warn("Google Places API error", {
          query: textQuery,
          status: response.status,
          message: body.error?.message ?? "unknown",
        });
        continue;
      }

      for (const place of body.places ?? []) {
        const seed = mapPlaceToSeed(place, input.country);
        if (!seed?.domain || seen.has(seed.domain)) continue;
        seen.add(seed.domain);
        seeds.push(seed);
        if (seeds.length >= maxResults) break;
      }
    } catch (error) {
      log.warn("Google Places request failed", {
        query: textQuery,
        error: String(error),
      });
    }
  }

  log.info("Google Places search completed", {
    queries: textQueries,
    regionCode: regionCode ?? null,
    withWebsite: seeds.length,
  });

  return seeds;
}
