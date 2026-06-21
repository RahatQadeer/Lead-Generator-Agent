import { createLogger } from "@/lib/logger";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import type { CompanyDirectorySeed } from "@/lib/scraping/company-directory-seeds";
import { countryToIsoCode } from "@/lib/search/jurisdiction-codes";
import { isUsefulSearchName } from "@/lib/search/search-name-utils";

const log = createLogger("scraping.overpass");
const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "LeadForge/1.0 (company research; contact@righttail.com)";

/** OSM office tags that often map to B2B / tech companies. */
const OFFICE_TAGS = ["company", "it", "software", "telecommunication", "consulting"];

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function getOverpassUrl(): string {
  return process.env.OVERPASS_API_URL?.trim() || DEFAULT_OVERPASS_URL;
}

function isOverpassEnabled(): boolean {
  const flag = process.env.OVERPASS_DIRECTORY_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

function escapeOverpassString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildAreaSelector(country: string): string | null {
  const trimmed = country.trim();
  if (!trimmed) return null;

  const iso = countryToIsoCode(trimmed);
  if (iso) {
    return `area["ISO3166-1"="${iso.toUpperCase()}"][admin_level=2]->.searchArea;`;
  }

  return `area["name"="${escapeOverpassString(trimmed)}"][admin_level=2]->.searchArea;`;
}

function buildOverpassQuery(country: string, limit: number, industry?: string): string | null {
  const areaSelector = buildAreaSelector(country);
  if (!areaSelector) return null;

  const officeFilters = OFFICE_TAGS.map(
    (tag) => `  nwr["office"="${tag}"]["website"](area.searchArea);`
  ).join("\n");

  const industryNorm = (industry ?? "").toLowerCase();
  const healthcareExtras =
    industryNorm.includes("health") || industryNorm.includes("medical")
      ? `
  nwr["amenity"="hospital"]["website"](area.searchArea);
  nwr["amenity"="clinic"]["website"](area.searchArea);
  nwr["healthcare"](area.searchArea)["website"];`
      : "";

  return `[out:json][timeout:25];
${areaSelector}
(
${officeFilters}${healthcareExtras}
);
out center ${Math.min(limit, 50)};`;
}

function pickWebsite(tags: Record<string, string>): string | null {
  const candidates = [
    tags.website,
    tags["contact:website"],
    tags.url,
    tags["contact:url"],
  ].filter(Boolean);

  for (const raw of candidates) {
    const value = raw.trim();
    if (!value || value.includes("openstreetmap.org")) continue;
    return value.startsWith("http") ? value : `https://${value}`;
  }

  return null;
}

function pickCity(tags: Record<string, string>): string | null {
  return (
    tags["addr:city"]?.trim() ||
    tags["addr:place"]?.trim() ||
    tags["addr:suburb"]?.trim() ||
    null
  );
}

function matchesKeywords(
  name: string,
  tags: Record<string, string>,
  keywords: string[],
  industry: string,
  searchName?: string
): boolean {
  const terms = [
    isUsefulSearchName(searchName) ? searchName : null,
    industry.trim(),
    ...keywords.slice(0, 3),
  ]
    .filter((t): t is string => Boolean(t?.trim()))
    .map((t) => t.toLowerCase());

  if (terms.length === 0) return true;

  const haystack = [
    name,
    tags.description,
    tags.note,
    tags.company,
    tags.office,
    tags.industry,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return terms.some((term) => haystack.includes(term));
}

function mapElement(
  element: OverpassElement,
  fallbackCountry: string,
  keywords: string[],
  industry: string,
  searchName?: string,
  skipKeywordFilter = false
): CompanyDirectorySeed | null {
  const tags = element.tags ?? {};
  const name = tags.name?.trim() || tags.operator?.trim() || tags.brand?.trim();
  const website = pickWebsite(tags);
  if (!name || !website) return null;

  if (
    !skipKeywordFilter &&
    !matchesKeywords(name, tags, keywords, industry, searchName)
  ) {
    return null;
  }

  const domain = extractDomainFromUrl(website);
  if (!domain) return null;

  const city = pickCity(tags);
  const officeType = tags.office ?? "company";
  const phone = tags.phone ?? tags["contact:phone"] ?? null;

  const snippetParts = [
    "OpenStreetMap business directory.",
    city ? `City: ${city}.` : null,
    phone ? `Phone: ${phone}.` : null,
    `Type: office=${officeType}.`,
  ].filter(Boolean);

  return {
    title: name,
    url: website,
    snippet: snippetParts.join(" "),
    domain,
    source: "overpass",
    country: fallbackCountry.trim() || null,
    city,
  };
}

export function isOverpassConfigured(): boolean {
  return isOverpassEnabled();
}

export async function searchOverpassCompanies(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  maxResults?: number;
}): Promise<CompanyDirectorySeed[]> {
  if (!isOverpassEnabled()) {
    return [];
  }

  const maxResults = input.maxResults ?? 12;
  const query = buildOverpassQuery(input.country, maxResults * 3, input.industry);
  if (!query) {
    log.warn("Overpass skipped — no country for area selector");
    return [];
  }

  try {
    const response = await fetch(getOverpassUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(35_000),
    });

    if (!response.ok) {
      log.warn("Overpass API error", { status: response.status });
      return [];
    }

    const body = (await response.json()) as OverpassResponse;
    const elements = body.elements ?? [];

    const seen = new Set<string>();
    const seeds: CompanyDirectorySeed[] = [];

    for (const element of elements) {
      const seed = mapElement(
        element,
        input.country,
        input.keywords,
        input.industry,
        input.searchName
      );
      if (!seed?.domain || seen.has(seed.domain)) continue;
      seen.add(seed.domain);
      seeds.push(seed);
      if (seeds.length >= maxResults) break;
    }

    if (seeds.length === 0 && elements.length > 0) {
      for (const element of elements) {
        const seed = mapElement(
          element,
          input.country,
          input.keywords,
          input.industry,
          input.searchName,
          true
        );
        if (!seed?.domain || seen.has(seed.domain)) continue;
        seen.add(seed.domain);
        seeds.push(seed);
        if (seeds.length >= maxResults) break;
      }
    }

    log.info("Overpass directory search completed", {
      country: input.country,
      raw: elements.length,
      count: seeds.length,
    });

    return seeds;
  } catch (error) {
    log.warn("Overpass request failed", { error: String(error) });
    return [];
  }
}
