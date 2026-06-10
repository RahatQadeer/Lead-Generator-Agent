import type { CompanyDiscoveryProvider, ProviderSearchResult } from "@/lib/company-discovery/types";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";

const MOCK_COMPANIES: Omit<DiscoveredCompany, "id">[] = [
  {
    name: "ABC Health",
    domain: "abchealth.com",
    industry: "Healthcare",
    employeeCount: 120,
    country: "United States",
    city: "Boston",
    state: "MA",
    linkedinUrl: "https://linkedin.com/company/abc-health",
    websiteUrl: "https://abchealth.com",
  },
  {
    name: "MedTech Pro",
    domain: "medtechpro.com",
    industry: "Healthcare",
    employeeCount: 300,
    country: "United States",
    city: "San Francisco",
    state: "CA",
    linkedinUrl: "https://linkedin.com/company/medtech-pro",
    websiteUrl: "https://medtechpro.com",
  },
  {
    name: "CareSync",
    domain: "caresync.io",
    industry: "Healthcare",
    employeeCount: 80,
    country: "United States",
    city: "Austin",
    state: "TX",
    linkedinUrl: "https://linkedin.com/company/caresync",
    websiteUrl: "https://caresync.io",
  },
  {
    name: "HealthBridge",
    domain: "healthbridge.com",
    industry: "Healthcare",
    employeeCount: 450,
    country: "United States",
    city: "Chicago",
    state: "IL",
    linkedinUrl: null,
    websiteUrl: "https://healthbridge.com",
  },
  {
    name: "NovaCare Systems",
    domain: "novacare.com",
    industry: "Healthcare",
    employeeCount: 210,
    country: "United States",
    city: "Seattle",
    state: "WA",
    linkedinUrl: null,
    websiteUrl: "https://novacare.com",
  },
  {
    name: "Competitor Labs",
    domain: "competitor.com",
    industry: "Healthcare",
    employeeCount: 150,
    country: "United States",
    city: "Denver",
    state: "CO",
    linkedinUrl: null,
    websiteUrl: "https://competitor.com",
  },
  {
    name: "FinEdge",
    domain: "finedge.com",
    industry: "Financial Services",
    employeeCount: 90,
    country: "United Kingdom",
    city: "London",
    state: null,
    linkedinUrl: null,
    websiteUrl: "https://finedge.com",
  },
  {
    name: "TechFlow",
    domain: "techflow.io",
    industry: "Technology",
    employeeCount: 65,
    country: "Canada",
    city: "Toronto",
    state: "ON",
    linkedinUrl: null,
    websiteUrl: "https://techflow.io",
  },
];

function matchesCriteria(
  company: Omit<DiscoveredCompany, "id">,
  params: CompanyDiscoveryParams
): boolean {
  if (
    params.industry &&
    company.industry?.toLowerCase() !== params.industry.toLowerCase()
  ) {
    return false;
  }

  if (
    params.country &&
    company.country?.toLowerCase() !== params.country.toLowerCase()
  ) {
    return false;
  }

  if (params.companySizeMin !== null && company.employeeCount !== null) {
    if (company.employeeCount < params.companySizeMin) return false;
  }

  if (params.companySizeMax !== null && company.employeeCount !== null) {
    if (company.employeeCount > params.companySizeMax) return false;
  }

  return true;
}

export class MockCompanyDiscoveryProvider implements CompanyDiscoveryProvider {
  readonly name = "mock";

  async search(params: CompanyDiscoveryParams): Promise<ProviderSearchResult> {
    await new Promise((r) => setTimeout(r, 300));

    const matched = MOCK_COMPANIES.filter((c) => matchesCriteria(c, params));

    const totalEntries = matched.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / params.perPage));
    const start = (params.page - 1) * params.perPage;
    const pageItems = matched.slice(start, start + params.perPage);

    const companies: DiscoveredCompany[] = pageItems.map((c, i) => ({
      ...c,
      id: `mock-${params.page}-${start + i}`,
    }));

    return {
      companies,
      pagination: {
        page: params.page,
        perPage: params.perPage,
        totalEntries,
        totalPages,
        hasMore: params.page < totalPages,
      },
    };
  }
}
