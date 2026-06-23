import { describe, expect, it, afterEach } from "vitest";
import {
  buildGooglePlacesTextQueries,
} from "@/lib/scraping/google-places-search";
import { getMajorCitiesForCountry } from "@/lib/scraping/country-major-cities";
import {
  getGooglePlacesMaxQueries,
  getGooglePlacesMaxResultsPerRun,
} from "@/lib/scraping/google-places-config";

describe("buildGooglePlacesTextQueries", () => {
  const originalMaxQueries = process.env.GOOGLE_PLACES_MAX_QUERIES;

  afterEach(() => {
    if (originalMaxQueries === undefined) delete process.env.GOOGLE_PLACES_MAX_QUERIES;
    else process.env.GOOGLE_PLACES_MAX_QUERIES = originalMaxQueries;
  });

  it("includes national and city-scoped queries for a country", () => {
    process.env.GOOGLE_PLACES_MAX_QUERIES = "20";

    const queries = buildGooglePlacesTextQueries({
      industry: "healthtech",
      country: "Pakistan",
      keywords: ["saas"],
    });

    expect(queries.some((q) => /Pakistan/i.test(q))).toBe(true);
    expect(queries.some((q) => /Karachi/i.test(q) && /Pakistan/i.test(q))).toBe(true);
    expect(queries.some((q) => /site:/i.test(q))).toBe(false);
    expect(queries.length).toBeGreaterThan(6);
  });

  it("respects GOOGLE_PLACES_MAX_QUERIES cap", () => {
    process.env.GOOGLE_PLACES_MAX_QUERIES = "5";

    const queries = buildGooglePlacesTextQueries({
      industry: "SaaS",
      country: "United States",
      keywords: [],
    });

    expect(queries.length).toBeLessThanOrEqual(5);
  });
});

describe("google places config", () => {
  const envBackup: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("defaults to 200 max results per run", () => {
    envBackup.GOOGLE_PLACES_MAX_RESULTS_PER_RUN = process.env.GOOGLE_PLACES_MAX_RESULTS_PER_RUN;
    delete process.env.GOOGLE_PLACES_MAX_RESULTS_PER_RUN;
    expect(getGooglePlacesMaxResultsPerRun()).toBe(200);
  });

  it("defaults to 12 max queries", () => {
    envBackup.GOOGLE_PLACES_MAX_QUERIES = process.env.GOOGLE_PLACES_MAX_QUERIES;
    delete process.env.GOOGLE_PLACES_MAX_QUERIES;
    expect(getGooglePlacesMaxQueries()).toBe(12);
  });
});

describe("getMajorCitiesForCountry", () => {
  it("returns cities for known countries", () => {
    expect(getMajorCitiesForCountry("Pakistan")).toContain("Lahore");
    expect(getMajorCitiesForCountry("United Kingdom").length).toBeGreaterThan(0);
  });

  it("returns empty for unknown country codes", () => {
    expect(getMajorCitiesForCountry("Atlantis")).toEqual([]);
  });
});
