import { describe, expect, it } from "vitest";
import {
  matchesFilters,
  normalizeScraperFilters,
} from "@/lib/scrapers/filters";
import { parseScraperFilters } from "@/lib/scrapers/parse-filters";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";

function profile(overrides: Partial<ScrapedCompanyProfile> = {}): ScrapedCompanyProfile {
  return {
    source: "ycombinator",
    sourceUrl: "https://www.ycombinator.com/companies/acme",
    sourceCompanyId: "acme",
    name: "Acme Analytics",
    websiteUrl: "https://acme.com",
    domain: "acme.com",
    description: "Acme builds fintech payment infrastructure for SaaS teams.",
    industry: "Fintech",
    category: "Payments",
    tags: ["fintech", "payments", "saas"],
    country: "United States",
    city: "San Francisco",
    state: "CA",
    founders: [],
    publicEmail: null,
    publicPhone: null,
    contactPageUrl: null,
    careersPageUrl: null,
    socialLinks: {},
    fundingStage: "seed",
    teamSize: 25,
    launchDate: null,
    websiteExtras: {},
    scrapedAt: new Date().toISOString(),
    errors: [],
    ...overrides,
  };
}

describe("normalizeScraperFilters", () => {
  it("reports empty filters", () => {
    expect(normalizeScraperFilters({}).isEmpty).toBe(true);
    expect(normalizeScraperFilters(undefined).isEmpty).toBe(true);
    expect(normalizeScraperFilters({ keywords: [] }).isEmpty).toBe(true);
  });

  it("tokenizes text fields and coerces stages to an array", () => {
    const f = normalizeScraperFilters({
      industry: "Fin-Tech",
      fundingStage: "seed",
      companySizeMin: 10,
    });
    expect(f.industry).toEqual(["fin", "tech"]);
    expect(f.fundingStages).toEqual(["seed"]);
    expect(f.companySizeMin).toBe(10);
    expect(f.isEmpty).toBe(false);
  });
});

describe("matchesFilters", () => {
  it("matches when no filters are set", () => {
    expect(matchesFilters(profile(), normalizeScraperFilters({})).match).toBe(true);
  });

  it("matches on industry token", () => {
    const f = normalizeScraperFilters({ industry: "fintech" });
    expect(matchesFilters(profile(), f).match).toBe(true);
  });

  it("rejects a clearly different industry", () => {
    const f = normalizeScraperFilters({ industry: "agriculture" });
    const result = matchesFilters(profile(), f);
    expect(result.match).toBe(false);
    expect(result.reasons[0]).toMatch(/industry/i);
  });

  it("matches any keyword (OR semantics)", () => {
    const f = normalizeScraperFilters({ keywords: ["logistics", "payment"] });
    expect(matchesFilters(profile(), f).match).toBe(true);
  });

  it("rejects when no keyword appears", () => {
    const f = normalizeScraperFilters({ keywords: ["biotech", "genomics"] });
    expect(matchesFilters(profile(), f).match).toBe(false);
  });

  it("matches location by city or country", () => {
    expect(
      matchesFilters(profile(), normalizeScraperFilters({ location: "San Francisco" })).match
    ).toBe(true);
    expect(
      matchesFilters(profile(), normalizeScraperFilters({ location: "United States" })).match
    ).toBe(true);
  });

  it("matches United States filter against YC-style USA country codes", () => {
    const p = profile({ country: "USA", city: "San Francisco", state: "CA" });
    expect(
      matchesFilters(p, normalizeScraperFilters({ location: "United States" })).match
    ).toBe(true);
  });

  it("rejects unknown location when a location filter is set", () => {
    const p = profile({ country: null, city: null, state: null, tags: [] });
    const result = matchesFilters(p, normalizeScraperFilters({ location: "Berlin" }));
    expect(result.match).toBe(false);
    expect(result.reasons[0]).toMatch(/location/i);
  });

  it("rejects unknown industry when an industry filter is set", () => {
    const p = profile({
      industry: null,
      category: null,
      tags: [],
      description: null,
    });
    const result = matchesFilters(p, normalizeScraperFilters({ industry: "logistics" }));
    expect(result.match).toBe(false);
    expect(result.reasons[0]).toMatch(/industry unknown/i);
  });

  it("enforces company size range when size is known", () => {
    expect(
      matchesFilters(profile({ teamSize: 25 }), normalizeScraperFilters({ companySizeMin: 50 }))
        .match
    ).toBe(false);
    expect(
      matchesFilters(profile({ teamSize: 25 }), normalizeScraperFilters({ companySizeMax: 100 }))
        .match
    ).toBe(true);
  });

  it("is lenient when company size is unknown", () => {
    const p = profile({ teamSize: null });
    expect(
      matchesFilters(p, normalizeScraperFilters({ companySizeMin: 50, companySizeMax: 200 })).match
    ).toBe(true);
  });

  it("enforces funding stage when known but is lenient when unknown", () => {
    expect(
      matchesFilters(profile({ fundingStage: "seed" }), normalizeScraperFilters({ fundingStage: ["series_a", "series_b"] }))
        .match
    ).toBe(false);
    expect(
      matchesFilters(profile({ fundingStage: null }), normalizeScraperFilters({ fundingStage: "series_a" }))
        .match
    ).toBe(true);
  });
});

describe("parseScraperFilters", () => {
  it("coerces a raw request body safely", () => {
    const parsed = parseScraperFilters({
      industry: "  Fintech ",
      keywords: ["payments", 42, "", "  saas "],
      fundingStage: ["seed", "not_a_stage"],
      companySizeMin: "10",
      companySizeMax: -5,
    });
    expect(parsed.industry).toBe("Fintech");
    expect(parsed.keywords).toEqual(["payments", "saas"]);
    expect(parsed.fundingStage).toEqual(["seed"]);
    expect(parsed.companySizeMin).toBe(10);
    expect(parsed.companySizeMax).toBeNull();
  });

  it("returns empty filters for junk input", () => {
    expect(parseScraperFilters(null)).toEqual({});
    expect(parseScraperFilters("nope")).toEqual({});
    // A junk object yields a fully-null/empty (but structured) filter set.
    expect(normalizeScraperFilters(parseScraperFilters({ foo: "bar" })).isEmpty).toBe(true);
  });
});
