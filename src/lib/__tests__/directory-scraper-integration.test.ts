import { describe, expect, it } from "vitest";
import {
  getDirectoryScraperSources,
  areDirectoryScrapersEnabled,
} from "@/lib/company-discovery/directory-scraper-source";
import { mapParamsToScraperFilters } from "@/lib/company-discovery/map-scraper-filters";
import { foundersToContacts } from "@/lib/companies/persist-decision-makers";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";

function params(overrides: Partial<CompanyDiscoveryParams> = {}): CompanyDiscoveryParams {
  return {
    searchName: "Fintech founders",
    industry: "Fintech",
    country: "United States",
    companySizeMin: 10,
    companySizeMax: 200,
    keywords: ["payments"],
    technologies: ["stripe"],
    exclusions: { companies: [], domains: [], keywords: [] } as never,
    page: 1,
    perPage: 50,
    ...overrides,
  };
}

describe("mapParamsToScraperFilters", () => {
  it("maps a company search into scraper filters", () => {
    const f = mapParamsToScraperFilters(params());
    expect(f.industry).toBe("Fintech");
    expect(f.location).toBe("United States");
    expect(f.companySizeMin).toBe(10);
    expect(f.companySizeMax).toBe(200);
    expect(f.keywords).toEqual(["payments", "stripe"]);
  });

  it("nulls empty industry/location", () => {
    const f = mapParamsToScraperFilters(params({ industry: "", country: "" }));
    expect(f.industry).toBeNull();
    expect(f.location).toBeNull();
  });
});

describe("getDirectoryScraperSources / enablement", () => {
  it("defaults to venture-backed, non-restricted sources when YC runs separately", () => {
    const originalYc = process.env.ENABLE_YC_SCRAPER;
    const original = process.env.DIRECTORY_SCRAPER_SOURCES;
    process.env.ENABLE_YC_SCRAPER = "true";
    delete process.env.DIRECTORY_SCRAPER_SOURCES;
    try {
      expect(getDirectoryScraperSources()).toEqual([]);
    } finally {
      if (originalYc === undefined) delete process.env.ENABLE_YC_SCRAPER;
      else process.env.ENABLE_YC_SCRAPER = originalYc;
      if (original !== undefined) process.env.DIRECTORY_SCRAPER_SOURCES = original;
    }
  });

  it("includes YC in directory sources when the dedicated YC scraper is off", () => {
    const originalYc = process.env.ENABLE_YC_SCRAPER;
    const original = process.env.DIRECTORY_SCRAPER_SOURCES;
    process.env.ENABLE_YC_SCRAPER = "false";
    delete process.env.DIRECTORY_SCRAPER_SOURCES;
    try {
      expect(getDirectoryScraperSources()).toEqual(["ycombinator"]);
    } finally {
      if (originalYc === undefined) delete process.env.ENABLE_YC_SCRAPER;
      else process.env.ENABLE_YC_SCRAPER = originalYc;
      if (original !== undefined) process.env.DIRECTORY_SCRAPER_SOURCES = original;
    }
  });

  it("drops invalid AND non-venture-backed (general directory) sources", () => {
    const originalYc = process.env.ENABLE_YC_SCRAPER;
    const original = process.env.DIRECTORY_SCRAPER_SOURCES;
    process.env.ENABLE_YC_SCRAPER = "false";
    // betalist is a general directory → rejected; not-a-source is invalid → rejected;
    // techstars is venture-backed → kept.
    process.env.DIRECTORY_SCRAPER_SOURCES = "ycombinator, not-a-source , betalist, techstars";
    try {
      expect(getDirectoryScraperSources()).toEqual(["ycombinator", "techstars"]);
    } finally {
      if (originalYc === undefined) delete process.env.ENABLE_YC_SCRAPER;
      else process.env.ENABLE_YC_SCRAPER = originalYc;
      if (original === undefined) delete process.env.DIRECTORY_SCRAPER_SOURCES;
      else process.env.DIRECTORY_SCRAPER_SOURCES = original;
    }
  });

  it("is disabled only when explicitly turned off", () => {
    const original = process.env.ENABLE_DIRECTORY_SCRAPERS;
    try {
      delete process.env.ENABLE_DIRECTORY_SCRAPERS;
      expect(areDirectoryScrapersEnabled()).toBe(true);
      process.env.ENABLE_DIRECTORY_SCRAPERS = "false";
      expect(areDirectoryScrapersEnabled()).toBe(false);
    } finally {
      if (original === undefined) delete process.env.ENABLE_DIRECTORY_SCRAPERS;
      else process.env.ENABLE_DIRECTORY_SCRAPERS = original;
    }
  });
});

describe("foundersToContacts", () => {
  const company: DiscoveredCompany = {
    id: "ycombinator:acme",
    name: "Acme",
    domain: "acme.com",
    industry: "Fintech",
    description: null,
    employeeCount: 20,
    country: "United States",
    city: null,
    state: null,
    linkedinUrl: null,
    websiteUrl: "https://acme.com",
    technologies: null,
    confidenceScore: 70,
    founders: [
      { name: "Jane Doe", title: "Co-Founder & CEO", linkedinUrl: "https://linkedin.com/in/jane-doe" },
      { name: "Bob", title: null, linkedinUrl: null },
      { name: "  ", title: "CTO", linkedinUrl: null }, // dropped: no name
    ],
    directoryProfile: {
      source: "ycombinator",
      sourceUrl: "https://www.ycombinator.com/companies/acme",
    } as never,
  };

  it("maps founders to decision-maker contacts tied to the company db id", () => {
    const contacts = foundersToContacts(company, "db-123");
    expect(contacts).toHaveLength(2);

    const jane = contacts[0];
    expect(jane.companyId).toBe("db-123");
    expect(jane.firstName).toBe("Jane");
    expect(jane.lastName).toBe("Doe");
    expect(jane.title).toBe("Co-Founder & CEO");
    expect(jane.discoverySource).toBe("directory_listing");
    expect(jane.sourceUrl).toContain("ycombinator");

    // Single-word name + missing title falls back gracefully.
    const bob = contacts[1];
    expect(bob.firstName).toBe("Bob");
    expect(bob.lastName).toBeNull();
    expect(bob.title).toBe("Founder");
  });

  it("returns nothing when a company has no founders", () => {
    expect(foundersToContacts({ ...company, founders: [] }, "db-1")).toEqual([]);
  });
});
