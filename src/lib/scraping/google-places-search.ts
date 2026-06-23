import { createLogger } from "@/lib/logger";
import { getMajorCitiesForCountry } from "@/lib/scraping/country-major-cities";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import type { CompanyDirectorySeed } from "@/lib/scraping/company-directory-seeds";
import {
  getGooglePlacesMaxQueries,
  getGooglePlacesMaxResultsPerRun,
  getGooglePlacesPageSize,
  getGooglePlacesPagesPerQuery,
  getGooglePlacesPageTokenDelayMs,
} from "@/lib/scraping/google-places-config";
import { buildCompanySearchQuery } from "@/lib/scraping/web-search";
import { countryToIsoCode } from "@/lib/search/jurisdiction-codes";
import { parseSearchIntent } from "@/lib/search/search-intent";

const log = createLogger("scraping.google-places");
const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK =
  "places.displayName,places.formattedAddress,places.websiteUri,places.types,places.primaryType,places.businessStatus,places.nationalPhoneNumber,places.internationalPhoneNumber,nextPageToken";

/** Types we don't want as B2B company leads (unless the search targets that category). */
const EXCLUDED_PLACE_TYPES = new Set([
  "school",
  "university",
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

/** Healthcare place types — excluded for generic B2B, kept when the user searches hospitals/clinics. */
const HEALTHCARE_PLACE_TYPES = new Set([
  "hospital",
  "doctor",
  "dentist",
  "pharmacy",
  "medical_clinic",
  "health",
]);

function isHealthcarePlaceSearch(input: GooglePlacesSearchInput): boolean {
  const text = [input.industry, input.searchName, ...input.keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(hospital|clinic|healthcare|health care|medical|pharma|diagnostic|health|dentist|nursing)\b/i.test(
    text
  );
}

export interface GooglePlacesSearchInput {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  companySizeMin?: number | null;
  companySizeMax?: number | null;
}

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
  nextPageToken?: string;
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

function isPlacesSafeQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (/\bsite:/i.test(trimmed)) return false;
  return true;
}

function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const query of queries) {
    const normalized = query.trim().replace(/\s+/g, " ");
    if (!isPlacesSafeQuery(normalized)) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

/** Build text queries: national + intent variants + major cities for broader country coverage. */
export function buildGooglePlacesTextQueries(input: GooglePlacesSearchInput): string[] {
  const industry = input.industry.trim();
  const country = input.country.trim();
  const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);

  const primary = buildCompanySearchQuery({
    industry,
    country,
    keywords,
    technologies: [],
    companySizeMin: input.companySizeMin,
    companySizeMax: input.companySizeMax,
  });

  const intent = parseSearchIntent({
    searchName: input.searchName,
    industry,
    country,
    keywords,
    companySizeMin: input.companySizeMin,
    companySizeMax: input.companySizeMax,
  });

  const queries: string[] = [primary, ...intent.queryVariants];

  if (industry && country) {
    queries.push(`${industry} companies ${country}`);
    queries.push(`${industry} company ${country}`);
    if (keywords[0]) {
      queries.push(`${keywords[0]} company ${country}`);
    }
  }

  const searchCore = [industry, ...keywords.slice(0, 2)].filter(Boolean).join(" ").trim();

  for (const city of getMajorCitiesForCountry(country)) {
    if (searchCore) {
      queries.push(`${searchCore} company ${city} ${country}`);
    } else if (industry) {
      queries.push(`${industry} company ${city} ${country}`);
    }
  }

  return uniqueQueries(queries).slice(0, getGooglePlacesMaxQueries());
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

function isExcludedPlace(
  types: string[] | undefined,
  options?: { allowHealthcare?: boolean }
): boolean {
  if (!types?.length) return false;

  return types.some((type) => {
    const normalized = type.toLowerCase();
    if (options?.allowHealthcare && HEALTHCARE_PLACE_TYPES.has(normalized)) {
      return false;
    }
    return EXCLUDED_PLACE_TYPES.has(normalized);
  });
}

function mapPlaceToSeed(
  place: GooglePlace,
  fallbackCountry: string,
  options?: { allowHealthcare?: boolean }
): CompanyDirectorySeed | null {
  const name = place.displayName?.text?.trim();
  const website = place.websiteUri?.trim();
  if (!name || !website) return null;

  if (place.businessStatus && place.businessStatus !== "OPERATIONAL") return null;
  if (isExcludedPlace(place.types, options)) return null;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPlacesPage(
  apiKey: string,
  options: {
    textQuery: string;
    regionCode?: string;
    pageSize: number;
    pageToken?: string;
  }
): Promise<GooglePlacesSearchResponse> {
  const body: Record<string, unknown> = {
    textQuery: options.textQuery,
    languageCode: "en",
    pageSize: options.pageSize,
    ...(options.regionCode ? { regionCode: options.regionCode } : {}),
    ...(options.pageToken ? { pageToken: options.pageToken } : {}),
  };

  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });

  const payload = (await response.json()) as GooglePlacesSearchResponse;
  if (!response.ok && !payload.error?.message) {
    return {
      error: { message: `HTTP ${response.status}`, status: String(response.status) },
    };
  }
  return payload;
}

async function collectPlacesForQuery(
  apiKey: string,
  textQuery: string,
  regionCode: string | undefined,
  options: {
    maxPlaces: number;
    pageSize: number;
    maxPages: number;
    pageTokenDelayMs: number;
  }
): Promise<GooglePlace[]> {
  const collected: GooglePlace[] = [];
  let pageToken: string | undefined;
  let page = 0;

  while (collected.length < options.maxPlaces && page < options.maxPages) {
    let body: GooglePlacesSearchResponse;

    try {
      body = await fetchPlacesPage(apiKey, {
        textQuery,
        regionCode,
        pageSize: Math.min(options.pageSize, options.maxPlaces - collected.length),
        pageToken,
      });
    } catch (error) {
      log.warn("Google Places request failed", {
        query: textQuery,
        page,
        error: String(error),
      });
      break;
    }

    if (body.error?.message) {
      log.warn("Google Places API error", {
        query: textQuery,
        page,
        message: body.error.message,
      });
      break;
    }

    const batch = body.places ?? [];
    if (batch.length === 0 && !body.nextPageToken) break;

    collected.push(...batch);
    page += 1;

    const nextToken = body.nextPageToken?.trim();
    if (!nextToken || collected.length >= options.maxPlaces) break;

    pageToken = nextToken;
    await sleep(options.pageTokenDelayMs);
  }

  return collected.slice(0, options.maxPlaces);
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(getApiKey()) && isGoogleMapsDirectoryEnabled();
}

export async function searchGooglePlacesCompanies(
  input: GooglePlacesSearchInput & { maxResults?: number }
): Promise<CompanyDirectorySeed[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    log.info(
      "Google Places skipped — set GOOGLE_PLACES_API_KEY (Places API Text Search Pro SKU)"
    );
    return [];
  }

  const textQueries = buildGooglePlacesTextQueries(input);
  if (textQueries.length === 0) return [];

  const configuredCap = getGooglePlacesMaxResultsPerRun();
  const maxResults = Math.min(input.maxResults ?? configuredCap, configuredCap);
  const pageSize = getGooglePlacesPageSize();
  const maxPages = getGooglePlacesPagesPerQuery();
  const pageTokenDelayMs = getGooglePlacesPageTokenDelayMs();
  const regionCode = countryToIsoCode(input.country)?.toUpperCase() ?? undefined;
  const allowHealthcare = isHealthcarePlaceSearch(input);

  const perQueryCap = Math.min(
    pageSize * maxPages,
    Math.max(pageSize, Math.ceil(maxResults / Math.max(1, textQueries.length)))
  );

  const seeds: CompanyDirectorySeed[] = [];
  const seen = new Set<string>();
  let apiCalls = 0;

  for (const textQuery of textQueries) {
    if (seeds.length >= maxResults) break;

    const remaining = maxResults - seeds.length;
    const places = await collectPlacesForQuery(apiKey, textQuery, regionCode, {
      maxPlaces: Math.min(perQueryCap, remaining + pageSize),
      pageSize,
      maxPages,
      pageTokenDelayMs,
    });
    apiCalls += Math.min(maxPages, Math.max(1, Math.ceil(places.length / pageSize)));

    for (const place of places) {
      const seed = mapPlaceToSeed(place, input.country, { allowHealthcare });
      if (!seed?.domain || seen.has(seed.domain)) continue;
      seen.add(seed.domain);
      seeds.push(seed);
      if (seeds.length >= maxResults) break;
    }
  }

  log.info("Google Places search completed", {
    queries: textQueries.length,
    apiCallsEstimate: apiCalls,
    regionCode: regionCode ?? null,
    cap: maxResults,
    withWebsite: seeds.length,
  });

  return seeds;
}

/** @deprecated Use buildGooglePlacesTextQueries */
export const buildTextQueries = buildGooglePlacesTextQueries;
