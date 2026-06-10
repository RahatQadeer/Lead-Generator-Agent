import { CompanyDiscoveryError } from "@/lib/company-discovery/errors";
import {
  buildEmployeeRange,
  normalizeLocation,
} from "@/lib/company-discovery/map-criteria";
import type { CompanyDiscoveryProvider, ProviderSearchResult } from "@/lib/company-discovery/types";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

interface ApolloOrganization {
  id?: string;
  name?: string;
  primary_domain?: string;
  website_url?: string;
  linkedin_url?: string;
  industry?: string;
  estimated_num_employees?: number;
  city?: string;
  state?: string;
  country?: string;
}

interface ApolloSearchResponse {
  organizations?: ApolloOrganization[];
  accounts?: ApolloOrganization[];
  pagination?: {
    page?: number;
    per_page?: number;
    total_entries?: number;
    total_pages?: number;
  };
  message?: string;
  error?: string;
  error_code?: string;
}

function mapApolloOrg(org: ApolloOrganization): DiscoveredCompany {
  return {
    id: org.id ?? `apollo-${org.primary_domain ?? org.name ?? "unknown"}`,
    name: org.name ?? "Unknown",
    domain: org.primary_domain ?? null,
    industry: org.industry ?? null,
    employeeCount: org.estimated_num_employees ?? null,
    country: org.country ?? null,
    city: org.city ?? null,
    state: org.state ?? null,
    linkedinUrl: org.linkedin_url ?? null,
    websiteUrl: org.website_url ?? null,
    technologies: null,
  };
}

function buildApolloUrl(params: CompanyDiscoveryParams): string {
  const url = new URL(`${APOLLO_BASE_URL}/mixed_companies/search`);

  url.searchParams.set("page", String(params.page));
  url.searchParams.set("per_page", String(params.perPage));

  const employeeRange = buildEmployeeRange(
    params.companySizeMin,
    params.companySizeMax
  );
  if (employeeRange) {
    url.searchParams.append("organization_num_employees_ranges[]", employeeRange);
  }

  if (params.country) {
    url.searchParams.append(
      "organization_locations[]",
      normalizeLocation(params.country)
    );
  }

  if (params.industry) {
    url.searchParams.append(
      "q_organization_keyword_tags[]",
      params.industry.toLowerCase()
    );
  }

  for (const keyword of params.keywords) {
    url.searchParams.append("q_organization_keyword_tags[]", keyword.toLowerCase());
  }

  for (const technology of params.technologies) {
    url.searchParams.append(
      "q_organization_keyword_tags[]",
      technology.toLowerCase()
    );
  }

  for (const country of params.exclusions.countries) {
    url.searchParams.append(
      "organization_not_locations[]",
      normalizeLocation(country)
    );
  }

  return url.toString();
}

function apolloErrorMessage(body: ApolloSearchResponse, status: number): string {
  return body.error ?? body.message ?? `Apollo API returned status ${status}`;
}

function parseApolloError(status: number, body: ApolloSearchResponse): CompanyDiscoveryError {
  const message = apolloErrorMessage(body, status);

  if (status === 403 && body.error_code === "API_INACCESSIBLE") {
    return new CompanyDiscoveryError(
      "PLAN_RESTRICTED",
      `${message} For local development, set COMPANY_DATA_PROVIDER=mock in .env.local.`,
      { statusCode: status, retryable: false }
    );
  }

  if (status === 401) {
    return new CompanyDiscoveryError("AUTH_ERROR", message, {
      statusCode: status,
      retryable: false,
    });
  }

  if (status === 403) {
    return new CompanyDiscoveryError(
      "AUTH_ERROR",
      `${message} Ensure you are using a Master API key from Apollo Settings → Integrations → API.`,
      { statusCode: status, retryable: false }
    );
  }

  if (status === 429) {
    return new CompanyDiscoveryError("RATE_LIMIT", message, {
      statusCode: status,
      retryable: true,
    });
  }

  if (status >= 500) {
    return new CompanyDiscoveryError("PROVIDER_ERROR", message, {
      statusCode: status,
      retryable: true,
    });
  }

  return new CompanyDiscoveryError("PROVIDER_ERROR", message, {
    statusCode: status,
    retryable: false,
  });
}

export class ApolloCompanyDiscoveryProvider implements CompanyDiscoveryProvider {
  readonly name = "apollo";

  constructor(private readonly apiKey: string) {}

  async search(params: CompanyDiscoveryParams): Promise<ProviderSearchResult> {
    const url = buildApolloUrl(params);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": this.apiKey,
        },
      });
    } catch (error) {
      throw new CompanyDiscoveryError(
        "NETWORK_ERROR",
        "Failed to reach Apollo API. Check your network connection.",
        { retryable: true, cause: error }
      );
    }

    let body: ApolloSearchResponse = {};
    try {
      body = (await response.json()) as ApolloSearchResponse;
    } catch {
      throw new CompanyDiscoveryError(
        "PROVIDER_ERROR",
        "Apollo returned an invalid response.",
        { statusCode: response.status, retryable: false }
      );
    }

    if (!response.ok) {
      throw parseApolloError(response.status, body);
    }

    const orgs = body.organizations ?? body.accounts ?? [];
    const pagination = body.pagination ?? {};

    const page = pagination.page ?? params.page;
    const perPage = pagination.per_page ?? params.perPage;
    const totalEntries = pagination.total_entries ?? orgs.length;
    const totalPages = pagination.total_pages ?? 1;

    return {
      companies: orgs.map(mapApolloOrg),
      pagination: {
        page,
        perPage,
        totalEntries,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }
}
