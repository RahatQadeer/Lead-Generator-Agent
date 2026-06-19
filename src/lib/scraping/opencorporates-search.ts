import { createLogger } from "@/lib/logger";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import type { CompanyDirectorySeed } from "@/lib/scraping/company-directory-seeds";
import { countryToIsoCode } from "@/lib/search/jurisdiction-codes";

const log = createLogger("scraping.opencorporates");
const BASE_URL = "https://api.opencorporates.com/v0.4";
const USER_AGENT = "LeadForge/1.0 (company research; contact@righttail.com)";
const MAX_DETAIL_FETCHES = 8;

interface OpenCorporatesCompany {
  name?: string;
  company_number?: string;
  jurisdiction_code?: string;
  current_status?: string;
  registered_address_in_full?: string;
  registered_address?: {
    locality?: string;
    region?: string;
    country?: string;
  };
  opencorporates_url?: string;
}

interface OpenCorporatesSearchResponse {
  results?: {
    companies?: Array<{ company: OpenCorporatesCompany }>;
    total_count?: number;
  };
}

interface OpenCorporatesStatement {
  data_type?: string;
  description?: string;
  properties?: Record<string, unknown>;
}

interface OpenCorporatesStatementsResponse {
  results?: {
    statements?: Array<{ statement: OpenCorporatesStatement }>;
  };
}

function getApiToken(): string | null {
  const token = process.env.OPEN_CORPORATES_API_TOKEN?.trim();
  return token || null;
}

function buildSearchQuery(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
}): string {
  const parts = [
    input.searchName?.trim(),
    input.industry.trim(),
    ...input.keywords.slice(0, 2),
  ].filter(Boolean);

  return parts.join(" ").trim();
}

function parseCityFromAddress(company: OpenCorporatesCompany): string | null {
  const addr = company.registered_address;
  if (addr?.locality?.trim()) return addr.locality.trim();
  const full = company.registered_address_in_full ?? "";
  const firstLine = full.split(/[,;\n]/)[0]?.trim();
  return firstLine || null;
}

function countryFromCompany(company: OpenCorporatesCompany, fallback: string): string | null {
  const addrCountry = company.registered_address?.country?.trim();
  if (addrCountry) return addrCountry;
  return fallback.trim() || null;
}

function extractWebsiteFromStatements(statements: OpenCorporatesStatement[]): string | null {
  for (const stmt of statements) {
    const type = (stmt.data_type ?? "").toLowerCase();
    if (!type.includes("website") && !type.includes("url")) continue;

    const props = stmt.properties ?? {};
    for (const value of Object.values(props)) {
      if (typeof value === "string" && value.includes(".")) {
        return value.startsWith("http") ? value : `https://${value}`;
      }
      if (
        value &&
        typeof value === "object" &&
        "value" in value &&
        typeof (value as { value: unknown }).value === "string"
      ) {
        const url = (value as { value: string }).value;
        return url.startsWith("http") ? url : `https://${url}`;
      }
    }

    const desc = stmt.description ?? "";
    const urlMatch = desc.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) return urlMatch[0];
  }

  return null;
}

async function ocFetch<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const token = getApiToken();
  if (!token) return null;

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "X-API-TOKEN": token,
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      log.warn("OpenCorporates API error", { status: response.status, path });
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    log.warn("OpenCorporates request failed", { path, error: String(error) });
    return null;
  }
}

async function fetchCompanyWebsite(
  jurisdictionCode: string,
  companyNumber: string
): Promise<string | null> {
  const body = await ocFetch<OpenCorporatesStatementsResponse>(
    `/companies/${jurisdictionCode}/${companyNumber}/statements`,
    { per_page: "20" }
  );

  const statements =
    body?.results?.statements?.map((row) => row.statement).filter(Boolean) ?? [];

  return extractWebsiteFromStatements(statements);
}

function mapToSeed(
  company: OpenCorporatesCompany,
  website: string | null,
  fallbackCountry: string
): CompanyDirectorySeed | null {
  const name = company.name?.trim();
  if (!name) return null;

  const status = (company.current_status ?? "").toLowerCase();
  if (status && status !== "active" && status !== "live") return null;

  const domain = website ? extractDomainFromUrl(website) : null;
  const country = countryFromCompany(company, fallbackCountry);
  const city = parseCityFromAddress(company);

  const url =
    website ?? company.opencorporates_url ?? (domain ? `https://${domain}` : null);

  if (!url) return null;

  const snippetParts = [
    "Official company registry (OpenCorporates).",
    country ? `Registered in ${country}.` : null,
    city ? `Address: ${city}.` : null,
    company.registered_address_in_full
      ? company.registered_address_in_full.slice(0, 120)
      : null,
  ].filter(Boolean);

  return {
    title: name,
    url,
    snippet: snippetParts.join(" "),
    domain,
    source: "opencorporates",
    country,
    city,
  };
}

export function isOpenCorporatesConfigured(): boolean {
  return Boolean(getApiToken());
}

export async function searchOpenCorporatesCompanies(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  maxResults?: number;
}): Promise<CompanyDirectorySeed[]> {
  const token = getApiToken();
  if (!token) {
    log.info("OpenCorporates skipped — set OPEN_CORPORATES_API_TOKEN for registry seeds");
    return [];
  }

  const query = buildSearchQuery(input);
  if (!query) return [];

  const maxResults = input.maxResults ?? 15;
  const params: Record<string, string> = {
    q: query,
    per_page: String(Math.min(maxResults, 30)),
    order: "score",
    inactive: "false",
  };

  const iso = countryToIsoCode(input.country);
  if (iso) {
    params.country_code = iso;
  }

  const body = await ocFetch<OpenCorporatesSearchResponse>("/companies/search", params);
  const items = body?.results?.companies ?? [];

  if (items.length === 0) {
    log.info("OpenCorporates search returned no companies", { query, country: iso });
    return [];
  }

  const seeds: CompanyDirectorySeed[] = [];
  let detailFetches = 0;

  for (const row of items) {
    if (seeds.length >= maxResults) break;

    const company = row.company;
    if (!company?.name || !company.jurisdiction_code || !company.company_number) continue;

    let website: string | null = null;
    if (detailFetches < MAX_DETAIL_FETCHES) {
      website = await fetchCompanyWebsite(
        company.jurisdiction_code,
        company.company_number
      );
      detailFetches += 1;
    }

    const seed = mapToSeed(company, website, input.country);
    if (!seed) continue;

    if (!seed.domain && seeds.length < maxResults - 1) continue;

    seeds.push(seed);
  }

  log.info("OpenCorporates search completed", {
    query,
    country: iso,
    count: seeds.length,
    withDomain: seeds.filter((s) => s.domain).length,
  });

  return seeds;
}
