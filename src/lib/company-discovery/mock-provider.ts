import { applyCriteria } from "@/lib/company-discovery/apply-criteria";
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
    technologies: ["Salesforce", "AWS"],
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
    technologies: ["React", "AWS", "PostgreSQL"],
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
    technologies: ["Node.js", "HubSpot"],
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
    technologies: ["Salesforce", "Azure"],
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
    technologies: ["React", "Node.js", "Docker"],
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
    technologies: ["WordPress"],
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
    technologies: ["Salesforce", "Python"],
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
    technologies: ["React", "Kubernetes", "PostgreSQL"],
  },
  {
    name: "ButterBee",
    domain: "butterbee.co",
    industry: "Technology",
    employeeCount: 10,
    country: "Pakistan",
    city: "Islamabad",
    state: null,
    linkedinUrl: null,
    websiteUrl: "https://butterbee.co",
    technologies: ["Next.js", "Node.js"],
  },
];

export class MockCompanyDiscoveryProvider implements CompanyDiscoveryProvider {
  readonly name = "mock";

  async search(params: CompanyDiscoveryParams): Promise<ProviderSearchResult> {
    await new Promise((r) => setTimeout(r, 300));

    const allCompanies: DiscoveredCompany[] = MOCK_COMPANIES.map((company, i) => ({
      ...company,
      id: `mock-${i}`,
    }));

    const { companies: matched } = applyCriteria(allCompanies, params);

    const totalEntries = matched.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / params.perPage));
    const start = (params.page - 1) * params.perPage;
    const pageItems = matched.slice(start, start + params.perPage);

    const companies: DiscoveredCompany[] = pageItems.map((company, i) => ({
      ...company,
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
