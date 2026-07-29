import { describe, expect, it } from "vitest";
import { validateCompanyForDiscovery } from "@/lib/company-discovery/validate-company";
import {
  passesHardRelevanceBlockers,
  searchTargetsInvestors,
} from "@/lib/scraping/company-relevance";
import { isLikelyCompanySearchResult } from "@/lib/scraping/company-search-filter";
import { isInvestorCompanyType, detectCompanyType } from "@/lib/scraping/company-type";
import type { DiscoveredCompany } from "@/types/company";

function fund(name: string, domain: string, description: string): DiscoveredCompany {
  return {
    id: "x",
    name,
    domain,
    industry: null,
    description,
    employeeCount: null,
    country: "United States",
    city: null,
    state: null,
    linkedinUrl: null,
    websiteUrl: `https://${domain}`,
    technologies: null,
    confidenceScore: 50,
  };
}

const FUNDS = [
  fund("Andreessen Horowitz", "a16z.com", "Venture capital firm investing in software companies."),
  fund("Sequoia Capital", "sequoiacap.com", "We help daring founders build legendary companies. Venture capital."),
  fund("Y Combinator", "ycombinator.com", "Startup accelerator program funding early-stage startups."),
  fund("Kleiner Perkins", "kleinerperkins.com", "Venture capital firm backing bold entrepreneurs."),
];

const VC_FILTERS = {
  industry: "Venture Capital",
  country: "United States",
  companySizeMin: null,
  companySizeMax: null,
  keywords: [],
  technologies: [],
} as Parameters<typeof validateCompanyForDiscovery>[1];

describe("searchTargetsInvestors", () => {
  it("detects investor searches, singular and plural", () => {
    for (const industry of ["Venture Capital", "VC", "VCs", "investor", "investors", "accelerator"]) {
      expect(searchTargetsInvestors({ industry, keywords: [] })).toBe(true);
    }
  });

  it("does not fire on ordinary B2B searches", () => {
    for (const industry of ["Healthcare", "SaaS", "E-commerce", "Logistics"]) {
      expect(searchTargetsInvestors({ industry, keywords: [] })).toBe(false);
    }
  });

  it("reads keywords and the search name too", () => {
    expect(searchTargetsInvestors({ industry: "Technology", keywords: ["venture capital"] })).toBe(true);
    expect(searchTargetsInvestors({ industry: "", keywords: [], searchName: "Top VC firms" })).toBe(true);
  });
});

describe("investor searches keep funds", () => {
  it.each(FUNDS.map((f) => [f.name, f] as const))("%s passes a VC search", (_name, company) => {
    // Funds are blocked at four layers by default; an investor search must clear all of them.
    expect(passesHardRelevanceBlockers(company, { industry: "Venture Capital", keywords: [] }).relevant).toBe(true);
    expect(validateCompanyForDiscovery(company, VC_FILTERS).accepted).toBe(true);
    expect(
      isLikelyCompanySearchResult(
        { title: company.name, url: company.websiteUrl!, snippet: company.description!, domain: company.domain! },
        { allowInvestors: true }
      )
    ).toBe(true);
    expect(isInvestorCompanyType(detectCompanyType(company).type)).toBe(true);
  });
});

describe("non-investor searches still reject funds", () => {
  it.each(FUNDS.map((f) => [f.name, f] as const))("%s is blocked on a SaaS search", (_name, company) => {
    expect(passesHardRelevanceBlockers(company, { industry: "SaaS", keywords: [] }).relevant).toBe(false);
    expect(
      isLikelyCompanySearchResult(
        { title: company.name, url: company.websiteUrl!, snippet: company.description!, domain: company.domain! },
        {}
      )
    ).toBe(false);
  });

  it("still accepts a real operating company", () => {
    const stripe = fund(
      "Stripe",
      "stripe.com",
      "Our platform lets businesses accept payments. We build financial infrastructure. Our product is an API platform."
    );
    stripe.industry = "FinTech";
    expect(passesHardRelevanceBlockers(stripe, { industry: "FinTech", keywords: [] }).relevant).toBe(true);
  });
});
