import { CompanyDiscoveryError } from "@/lib/company-discovery/errors";
import type {
  CompanyDiscoveryProvider,
  ProviderSearchResult,
} from "@/lib/company-discovery/types";
import { createLogger } from "@/lib/logger";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";

const log = createLogger("company-discovery.companies-house");
const BASE_URL = "https://api.company-information.service.gov.uk";

interface CompaniesHouseAddress {
  locality?: string;
  region?: string;
  country?: string;
}

interface CompaniesHouseSearchItem {
  title?: string;
  company_number?: string;
  company_status?: string;
  address?: CompaniesHouseAddress;
  description?: string;
  snippet?: string;
}

interface CompaniesHouseSearchResponse {
  items?: CompaniesHouseSearchItem[];
  total_results?: number;
  items_per_page?: number;
  start_index?: number;
}

function buildSearchQuery(params: CompanyDiscoveryParams): string {
  return [
    params.industry,
    ...params.keywords.slice(0, 2),
    ...params.technologies.slice(0, 1),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function mapCompany(
  item: CompaniesHouseSearchItem,
  params: CompanyDiscoveryParams,
  index: number
): DiscoveredCompany | null {
  if (!item.title || !item.company_number) return null;
  if (item.company_status && item.company_status !== "active") return null;

  const slug = slugify(item.title);
  const guessedDomain = slug ? `${slug}.co.uk` : null;

  return {
    id: `ch-${item.company_number}`,
    name: item.title,
    domain: guessedDomain,
    industry: params.industry || item.description || null,
    description: item.description ?? null,
    employeeCount: null,
    country: "United Kingdom",
    city: item.address?.locality ?? null,
    state: item.address?.region ?? null,
    linkedinUrl: null,
    websiteUrl: guessedDomain ? `https://${guessedDomain}` : null,
    technologies: params.technologies.length ? params.technologies : null,
    confidenceScore: 65,
  };
}

export class CompaniesHouseDiscoveryProvider implements CompanyDiscoveryProvider {
  readonly name = "companies-house";

  constructor(private readonly apiKey: string) {}

  async search(params: CompanyDiscoveryParams): Promise<ProviderSearchResult> {
    const country = params.country.toLowerCase();
    if (
      country !== "united kingdom" &&
      country !== "uk" &&
      country !== "great britain" &&
      country !== "england"
    ) {
      throw new CompanyDiscoveryError(
        "VALIDATION_ERROR",
        "Companies House only supports United Kingdom searches. Set country to United Kingdom.",
        { statusCode: 400, retryable: false }
      );
    }

    const query = buildSearchQuery(params);
    if (!query) {
      throw new CompanyDiscoveryError(
        "VALIDATION_ERROR",
        "Add an industry or keyword to search UK companies.",
        { statusCode: 400, retryable: false }
      );
    }

    const startIndex = (params.page - 1) * params.perPage;
    const url = new URL(`${BASE_URL}/search/companies`);
    url.searchParams.set("q", query);
    url.searchParams.set("items_per_page", String(params.perPage));
    url.searchParams.set("start_index", String(startIndex));

    const auth = Buffer.from(`${this.apiKey}:`).toString("base64");

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new CompanyDiscoveryError(
        "NETWORK_ERROR",
        "Failed to reach Companies House API.",
        { retryable: true, cause: error }
      );
    }

    if (!response.ok) {
      const body = await response.text();
      log.warn("Companies House API error", { status: response.status, body });
      throw new CompanyDiscoveryError(
        response.status === 401 ? "AUTH_ERROR" : "PROVIDER_ERROR",
        "Companies House API request failed. Check COMPANIES_HOUSE_API_KEY.",
        { statusCode: response.status, retryable: response.status >= 500 }
      );
    }

    const body = (await response.json()) as CompaniesHouseSearchResponse;
    const items = body.items ?? [];
    const companies = items
      .map((item, index) => mapCompany(item, params, index))
      .filter((company): company is DiscoveredCompany => company !== null);

    const totalEntries = body.total_results ?? companies.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / params.perPage));

    return {
      companies,
      pagination: {
        page: params.page,
        perPage: params.perPage,
        totalEntries,
        totalPages,
        hasMore: startIndex + companies.length < totalEntries,
      },
    };
  }
}
