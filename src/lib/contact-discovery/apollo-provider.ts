import { ContactDiscoveryError } from "@/lib/contact-discovery/errors";
import { normalizeDomain } from "@/lib/search/exclusions";
import type { ContactDiscoveryProvider, ProviderContactSearchResult } from "@/lib/contact-discovery/types";
import type { ContactDiscoveryParams, DiscoveredContact } from "@/types/contact";

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

interface ApolloPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  organization?: {
    name?: string;
    primary_domain?: string;
  };
}

interface ApolloPeopleSearchResponse {
  people?: ApolloPerson[];
  contacts?: ApolloPerson[];
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

function apolloErrorMessage(body: ApolloPeopleSearchResponse, status: number): string {
  return body.error ?? body.message ?? `Apollo API returned status ${status}`;
}

function parseApolloError(
  status: number,
  body: ApolloPeopleSearchResponse
): ContactDiscoveryError {
  const message = apolloErrorMessage(body, status);

  if (status === 403 && body.error_code === "API_INACCESSIBLE") {
    return new ContactDiscoveryError(
      "PLAN_RESTRICTED",
      `${message} For local development, set COMPANY_DATA_PROVIDER=mock in .env.local.`,
      { statusCode: status, retryable: false }
    );
  }

  if (status === 401) {
    return new ContactDiscoveryError("AUTH_ERROR", message, {
      statusCode: status,
      retryable: false,
    });
  }

  if (status === 403) {
    return new ContactDiscoveryError(
      "AUTH_ERROR",
      `${message} Ensure you are using a Master API key from Apollo Settings → Integrations → API.`,
      { statusCode: status, retryable: false }
    );
  }

  if (status === 429) {
    return new ContactDiscoveryError("RATE_LIMIT", message, {
      statusCode: status,
      retryable: true,
    });
  }

  if (status >= 500) {
    return new ContactDiscoveryError("PROVIDER_ERROR", message, {
      statusCode: status,
      retryable: true,
    });
  }

  return new ContactDiscoveryError("PROVIDER_ERROR", message, {
    statusCode: status,
    retryable: false,
  });
}

function mapApolloPerson(
  person: ApolloPerson,
  companyId: string,
  companyName: string,
  companyDomain: string | null
): DiscoveredContact {
  const firstName = person.first_name ?? person.name?.split(" ")[0] ?? "Unknown";
  const lastName =
    person.last_name ?? person.name?.split(" ").slice(1).join(" ") ?? null;

  return {
    id: person.id ?? `apollo-${person.email ?? person.name ?? "unknown"}`,
    companyId,
    companyName,
    companyDomain,
    firstName,
    lastName,
    fullName:
      person.name ??
      [firstName, lastName].filter(Boolean).join(" "),
    title: person.title ?? "Unknown",
    email: person.email ?? null,
    linkedinUrl: person.linkedin_url ?? null,
  };
}

function buildApolloUrl(params: ContactDiscoveryParams): string {
  const url = new URL(`${APOLLO_BASE_URL}/mixed_people/search`);

  url.searchParams.set("page", String(params.page));
  url.searchParams.set("per_page", String(params.perPage));

  for (const title of params.jobTitles) {
    url.searchParams.append("person_titles[]", title);
  }

  for (const company of params.companies) {
    if (company.domain) {
      url.searchParams.append(
        "q_organization_domains_list[]",
        normalizeDomain(company.domain)
      );
    }
  }

  return url.toString();
}

export class ApolloContactDiscoveryProvider implements ContactDiscoveryProvider {
  readonly name = "apollo";

  constructor(private readonly apiKey: string) {}

  async search(params: ContactDiscoveryParams): Promise<ProviderContactSearchResult> {
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
      throw new ContactDiscoveryError(
        "NETWORK_ERROR",
        "Failed to reach Apollo API. Check your network connection.",
        { retryable: true, cause: error }
      );
    }

    let body: ApolloPeopleSearchResponse = {};
    try {
      body = (await response.json()) as ApolloPeopleSearchResponse;
    } catch {
      throw new ContactDiscoveryError(
        "PROVIDER_ERROR",
        "Apollo returned an invalid response.",
        { statusCode: response.status, retryable: false }
      );
    }

    if (!response.ok) {
      throw parseApolloError(response.status, body);
    }

    const people = body.people ?? body.contacts ?? [];
    const pagination = body.pagination ?? {};
    const domainToCompany = new Map(
      params.companies
        .filter((company) => company.domain)
        .map((company) => [normalizeDomain(company.domain!), company])
    );

    const contacts: DiscoveredContact[] = [];

    for (const person of people) {
      const domain = person.organization?.primary_domain
        ? normalizeDomain(person.organization.primary_domain)
        : null;
      const company = domain ? domainToCompany.get(domain) : params.companies[0];

      if (!company) continue;

      contacts.push(
        mapApolloPerson(
          person,
          company.id,
          company.name,
          company.domain
        )
      );
    }

    const page = pagination.page ?? params.page;
    const perPage = pagination.per_page ?? params.perPage;
    const totalEntries = pagination.total_entries ?? contacts.length;
    const totalPages = pagination.total_pages ?? 1;

    return {
      contacts,
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
