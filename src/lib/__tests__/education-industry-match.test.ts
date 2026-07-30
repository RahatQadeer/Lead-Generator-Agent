import { describe, expect, it } from "vitest";
import { passesStrictSearchFilters } from "@/lib/company-discovery/apply-criteria";
import { companyMatchesIndustry } from "@/lib/scraping/industry-classifier";
import { matchesFilters, normalizeScraperFilters } from "@/lib/scrapers/filters";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";

const PARTNERSTACK_DESCRIPTION =
  "PartnerStack is a full stack solution for partnerships. The platform supports partner marketing, referral, and reseller activity, and solves for partner application management, engagement, attribution, education, payouts, compliance, and additional partner channel needs.";

describe("Education industry matching", () => {
  it("does not treat PartnerStack partner-training copy as Education", () => {
    const match = companyMatchesIndustry(
      {
        name: "PartnerStack",
        domain: "partnerstack.com",
        industry: "B2B",
        description: PARTNERSTACK_DESCRIPTION,
        websiteUrl: "https://partnerstack.com",
      },
      "Education"
    );

    expect(match.matches).toBe(false);
  });

  it("rejects PartnerStack for an Education + Canada search", () => {
    const company = {
      id: "ycombinator:partnerstack",
      name: "PartnerStack",
      domain: "partnerstack.com",
      industry: "B2B",
      description: PARTNERSTACK_DESCRIPTION,
      employeeCount: 200,
      country: "Canada",
      city: "Toronto",
      state: "ON",
      linkedinUrl: null,
      websiteUrl: "https://partnerstack.com",
      technologies: ["B2B"],
      confidenceScore: 95,
    };

    expect(
      passesStrictSearchFilters(company, {
        industry: "Education",
        country: "Canada",
        companySizeMin: null,
        companySizeMax: null,
        technologies: [],
        keywords: [],
      })
    ).toBe(false);
  });

  it("accepts a real EdTech company for Education", () => {
    const match = companyMatchesIndustry(
      {
        name: "ClassroomOS",
        domain: "classroomos.com",
        industry: "EdTech",
        description: "Learning platform for K-12 schools and teachers.",
        websiteUrl: "https://classroomos.com",
      },
      "Education"
    );

    expect(match.matches).toBe(true);
  });

  it("rejects PartnerStack at the scraper filter layer", () => {
    const profile: ScrapedCompanyProfile = {
      source: "ycombinator",
      sourceUrl: "https://www.ycombinator.com/companies/partnerstack",
      sourceCompanyId: "partnerstack",
      name: "PartnerStack",
      websiteUrl: "https://partnerstack.com",
      domain: "partnerstack.com",
      description: PARTNERSTACK_DESCRIPTION,
      industry: "B2B",
      category: "B2B",
      tags: ["B2B"],
      country: "Canada",
      city: "Toronto",
      state: "ON",
      founders: [],
      publicEmail: null,
      publicPhone: null,
      contactPageUrl: null,
      careersPageUrl: null,
      socialLinks: {},
      fundingStage: null,
      teamSize: 200,
      launchDate: null,
      websiteExtras: {},
      scrapedAt: new Date().toISOString(),
      errors: [],
    };

    const result = matchesFilters(
      profile,
      normalizeScraperFilters({ industry: "Education", location: "Canada" })
    );
    expect(result.match).toBe(false);
  });
});
