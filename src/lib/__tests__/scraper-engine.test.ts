import { describe, expect, it } from "vitest";
import { ScraperFactory } from "@/lib/scrapers/scraper-factory";
import { GithubOrganizationsScraper } from "@/lib/scrapers/sources/github-organizations-scraper";
import { ProductHuntScraper } from "@/lib/scrapers/sources/producthunt-scraper";
import { BetaListScraper } from "@/lib/scrapers/sources/betalist-scraper";
import { SaaSHubScraper } from "@/lib/scrapers/sources/saashub-scraper";
import { StartupRankingScraper } from "@/lib/scrapers/sources/startupranking-scraper";
import { SeedtableScraper } from "@/lib/scrapers/sources/seedtable-scraper";
import { OpenVCScraper } from "@/lib/scrapers/sources/openvc-scraper";
import { F6SScraper } from "@/lib/scrapers/sources/f6s-scraper";
import { IndieHackersScraper } from "@/lib/scrapers/sources/indiehackers-scraper";
import {
  isRestrictedSource,
  isRestrictedSourceEnabled,
} from "@/lib/scrapers/source-policy";
import type { ScraperRunContext } from "@/lib/scrapers/types";
import { dedupeScrapedProfiles } from "@/lib/scrapers/utils/dedupe";
import { validateScrapedProfile } from "@/lib/scrapers/utils/validate";
import { toDiscoveredCompany } from "@/lib/scrapers/utils/to-discovered-company";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";

function sampleProfile(overrides: Partial<ScrapedCompanyProfile> = {}): ScrapedCompanyProfile {
  return {
    source: "ycombinator",
    sourceUrl: "https://www.ycombinator.com/companies/acme",
    sourceCompanyId: "acme",
    name: "Acme Inc",
    websiteUrl: "https://acme.com",
    domain: "acme.com",
    description: "Acme builds workflow automation for operations teams.",
    industry: "B2B SaaS",
    category: "B2B SaaS",
    tags: ["saas"],
    country: "United States",
    city: "San Francisco",
    state: "CA",
    founders: [{ name: "Jane Doe" }],
    publicEmail: null,
    publicPhone: null,
    contactPageUrl: null,
    careersPageUrl: null,
    socialLinks: { linkedin: "https://linkedin.com/company/acme" },
    fundingStage: "seed",
    teamSize: 12,
    launchDate: null,
    websiteExtras: { technologies: ["Next.js"] },
    scrapedAt: new Date().toISOString(),
    errors: [],
    ...overrides,
  };
}

describe("ScraperFactory", () => {
  it("lists all registered sources", () => {
    const sources = ScraperFactory.listSources();
    expect(sources).toContain("ycombinator");
    expect(sources).toContain("producthunt");
    expect(sources.length).toBeGreaterThanOrEqual(10);
  });

  it("creates Y Combinator scraper", () => {
    const scraper = ScraperFactory.create("ycombinator");
    expect(scraper.sourceId).toBe("ycombinator");
    expect(scraper.displayName).toBe("Y Combinator");
  });

  it("creates a real (non-stub) GitHub Organizations scraper", () => {
    const scraper = ScraperFactory.create("github-organizations");
    expect(scraper).toBeInstanceOf(GithubOrganizationsScraper);
    expect(scraper.sourceId).toBe("github-organizations");
    expect(scraper.displayName).toBe("GitHub Organizations");
    expect(scraper.baseUrl).toBe("https://github.com");
  });

  it("creates a real (non-stub) Product Hunt scraper", () => {
    const scraper = ScraperFactory.create("producthunt");
    expect(scraper).toBeInstanceOf(ProductHuntScraper);
    expect(scraper.sourceId).toBe("producthunt");
    expect(scraper.displayName).toBe("Product Hunt");
  });

  it("creates a real (non-stub) BetaList scraper", () => {
    const scraper = ScraperFactory.create("betalist");
    expect(scraper).toBeInstanceOf(BetaListScraper);
    expect(scraper.sourceId).toBe("betalist");
    expect(scraper.displayName).toBe("BetaList");
  });

  it("creates a real (non-stub) SaaSHub scraper", () => {
    const scraper = ScraperFactory.create("saashub");
    expect(scraper).toBeInstanceOf(SaaSHubScraper);
    expect(scraper.sourceId).toBe("saashub");
    expect(scraper.displayName).toBe("SaaSHub");
  });

  it("registers all remaining sources as real (non-stub) scrapers", () => {
    expect(ScraperFactory.create("startupranking")).toBeInstanceOf(StartupRankingScraper);
    expect(ScraperFactory.create("seedtable")).toBeInstanceOf(SeedtableScraper);
    expect(ScraperFactory.create("openvc")).toBeInstanceOf(OpenVCScraper);
    expect(ScraperFactory.create("f6s")).toBeInstanceOf(F6SScraper);
    expect(ScraperFactory.create("indiehackers")).toBeInstanceOf(IndieHackersScraper);
  });

  it("registers all sources (venture-backed + general directories)", () => {
    expect(ScraperFactory.listSources()).toHaveLength(20);
  });
});

describe("restricted source opt-in policy", () => {
  function fakeContext(): ScraperRunContext {
    return {
      userId: "u",
      searchId: null,
      jobId: "j",
      options: {
        maxCompanies: 10,
        maxPages: 1,
        enrichFromWebsite: false,
        concurrency: 1,
        respectRobots: true,
        minIntervalMs: 0,
      },
      filters: {},
      signal: new AbortController().signal,
    };
  }

  it("flags the anti-bot / ToS-restricted sources as restricted", () => {
    for (const source of ["startupranking", "seedtable", "openvc", "f6s", "indiehackers"] as const) {
      expect(isRestrictedSource(source)).toBe(true);
    }
    expect(isRestrictedSource("ycombinator")).toBe(false);
    expect(isRestrictedSource("github-organizations")).toBe(false);
  });

  it("keeps restricted sources disabled unless SCRAPER_ENABLE_RESTRICTED opts in", () => {
    const original = process.env.SCRAPER_ENABLE_RESTRICTED;
    try {
      delete process.env.SCRAPER_ENABLE_RESTRICTED;
      expect(isRestrictedSourceEnabled("f6s")).toBe(false);

      process.env.SCRAPER_ENABLE_RESTRICTED = "f6s,indiehackers";
      expect(isRestrictedSourceEnabled("f6s")).toBe(true);
      expect(isRestrictedSourceEnabled("openvc")).toBe(false);

      process.env.SCRAPER_ENABLE_RESTRICTED = "all";
      expect(isRestrictedSourceEnabled("openvc")).toBe(true);
    } finally {
      if (original === undefined) delete process.env.SCRAPER_ENABLE_RESTRICTED;
      else process.env.SCRAPER_ENABLE_RESTRICTED = original;
    }
  });

  it("returns no seeds (and makes no network calls) for a disabled restricted source", async () => {
    const original = process.env.SCRAPER_ENABLE_RESTRICTED;
    delete process.env.SCRAPER_ENABLE_RESTRICTED;
    try {
      const scraper = ScraperFactory.create("startupranking");
      const profiles = await scraper.run(fakeContext(), {});
      expect(profiles).toEqual([]);
    } finally {
      if (original !== undefined) process.env.SCRAPER_ENABLE_RESTRICTED = original;
    }
  });
});

describe("scraper validation and mapping", () => {
  it("validates a complete profile", () => {
    const result = validateScrapedProfile(sampleProfile());
    expect(result.valid).toBe(true);
  });

  it("rejects profiles without a name", () => {
    const result = validateScrapedProfile(sampleProfile({ name: "" }));
    expect(result.valid).toBe(false);
  });

  it("maps to discovered company with directory provider id", () => {
    const company = toDiscoveredCompany(sampleProfile());
    expect(company.name).toBe("Acme Inc");
    expect(company.domain).toBe("acme.com");
    expect(company.linkedinUrl).toContain("linkedin.com");
    expect(company.id).toBe("ycombinator:acme");
  });

  it("deduplicates profiles by domain", () => {
    const profiles = [
      sampleProfile(),
      sampleProfile({ sourceCompanyId: "acme-2", name: "Acme Incorporated" }),
    ];
    const { unique, duplicateCount } = dedupeScrapedProfiles(profiles);
    expect(unique).toHaveLength(1);
    expect(duplicateCount).toBe(1);
  });
});
