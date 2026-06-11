import { LeadEnrichmentError } from "@/lib/lead-enrichment/errors";
import { formatLocation } from "@/lib/lead-enrichment/format-location";
import type { LeadEnrichmentProvider } from "@/lib/lead-enrichment/types";
import type { EnrichedLead, LeadEnrichmentInput } from "@/types/lead";

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

interface ApolloPersonMatchResponse {
  person?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    title?: string;
    email?: string;
    linkedin_url?: string;
    city?: string;
    state?: string;
    country?: string;
    organization?: {
      name?: string;
    };
  };
  error?: string;
  error_code?: string;
  message?: string;
}

function apolloErrorMessage(body: ApolloPersonMatchResponse, status: number): string {
  return body.error ?? body.message ?? `Apollo API returned status ${status}`;
}

async function matchPerson(
  apiKey: string,
  input: LeadEnrichmentInput
): Promise<ApolloPersonMatchResponse["person"] | null> {
  const url = new URL(`${APOLLO_BASE_URL}/people/match`);

  if (input.email) {
    url.searchParams.set("email", input.email);
  }
  if (input.linkedinUrl) {
    url.searchParams.set("linkedin_url", input.linkedinUrl);
  }
  if (input.fullName) {
    url.searchParams.set("name", input.fullName);
  }
  if (input.companyName) {
    url.searchParams.set("organization_name", input.companyName);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": apiKey,
    },
  });

  let body: ApolloPersonMatchResponse = {};
  try {
    body = (await response.json()) as ApolloPersonMatchResponse;
  } catch {
    throw new LeadEnrichmentError(
      "PROVIDER_ERROR",
      "Apollo returned an invalid response.",
      { statusCode: response.status, retryable: false }
    );
  }

  if (!response.ok) {
    const message = apolloErrorMessage(body, response.status);

    if (response.status === 403 && body.error_code === "API_INACCESSIBLE") {
      throw new LeadEnrichmentError(
        "PLAN_RESTRICTED",
        `${message} For local development, set COMPANY_DATA_PROVIDER=mock in .env.local.`,
        { statusCode: response.status, retryable: false }
      );
    }

    if (response.status === 429) {
      throw new LeadEnrichmentError("RATE_LIMIT", message, {
        statusCode: response.status,
        retryable: true,
      });
    }

    return null;
  }

  return body.person ?? null;
}

export class ApolloLeadEnrichmentProvider implements LeadEnrichmentProvider {
  readonly name = "apollo";

  constructor(private readonly apiKey: string) {}

  async enrich(inputs: LeadEnrichmentInput[]): Promise<EnrichedLead[]> {
    const enrichedAt = new Date().toISOString();
    const leads: EnrichedLead[] = [];

    for (const input of inputs) {
      let person: ApolloPersonMatchResponse["person"] | null = null;

      try {
        person = await matchPerson(this.apiKey, input);
      } catch (error) {
        if (error instanceof LeadEnrichmentError && error.retryable) {
          throw error;
        }
      }

      const city = person?.city ?? input.companyCity;
      const state = person?.state ?? input.companyState;
      const country = person?.country ?? input.companyCountry;

      leads.push({
        id: input.id,
        name:
          person?.name ??
          ([person?.first_name, person?.last_name].filter(Boolean).join(" ") ||
            input.fullName),
        role: person?.title ?? input.title,
        company: person?.organization?.name ?? input.companyName,
        linkedin: person?.linkedin_url ?? input.linkedinUrl,
        city,
        state,
        country,
        location: formatLocation(city, state, country),
        email: person?.email ?? input.email,
        emailSyntaxValid: null,
        emailDomainValid: null,
        emailVerificationStatus: null,
        emailVerifiedAt: null,
        companyId: input.companyId,
        searchId: null,
        enrichedAt,
      });
    }

    return leads;
  }
}
