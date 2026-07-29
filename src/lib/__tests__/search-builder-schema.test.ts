import { describe, expect, it } from "vitest";
import { parsePipelineRunRequest } from "@/lib/pipeline/parse-run-request";
import {
  emptySearchBuilderValues,
  fromSearchRow,
  searchBuilderSchema,
  toPipelineRunPayload,
  toSearchRow,
  type SearchBuilderValues,
} from "@/lib/search-builder/schema";

/** A valid baseline: named, with one company filter so the guard is satisfied. */
function valid(overrides: Partial<SearchBuilderValues> = {}): SearchBuilderValues {
  return {
    ...emptySearchBuilderValues,
    name: "US AI Startups",
    countries: ["United States"],
    industries: ["Artificial Intelligence"],
    ...overrides,
  };
}

function issuesFor(values: unknown): string[] {
  const result = searchBuilderSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("search builder validation", () => {
  it("accepts a well-formed search", () => {
    expect(searchBuilderSchema.safeParse(valid()).success).toBe(true);
  });

  it("requires a name", () => {
    expect(issuesFor(valid({ name: "" })).join(" ")).toMatch(/name/i);
  });

  it("requires at least one company filter", () => {
    // Otherwise the run matches the entire directory, which is never intended
    // and costs a very long scrape.
    const issues = issuesFor(
      valid({
        countries: [],
        industries: [],
        keywords: [],
        companyType: null,
        fundingStages: [],
        companySizeMin: null,
        companySizeMax: null,
      })
    );
    expect(issues.join(" ")).toMatch(/at least one company filter/i);
  });

  it("accepts a keyword alone as the company filter", () => {
    const result = searchBuilderSchema.safeParse(
      valid({ countries: [], industries: [], keywords: ["developer tools"] })
    );
    expect(result.success).toBe(true);
  });

  it("rejects an inverted size range", () => {
    const issues = issuesFor(valid({ companySizeMin: 500, companySizeMax: 10 }));
    expect(issues.join(" ")).toMatch(/greater than the minimum/i);
  });

  it("rejects an unknown decision-maker role", () => {
    const issues = issuesFor(valid({ roleKeys: ["ceo", "not-a-role"] }));
    expect(issues.join(" ")).toMatch(/not-a-role/);
  });
});

describe("row mapping", () => {
  it("keeps the legacy single-value columns in sync", () => {
    // Anything still reading `country`/`industry` must see a sensible value
    // rather than null after a save from the new builder.
    const row = toSearchRow(
      valid({ countries: ["Germany", "France"], industries: ["FinTech"] })
    );
    expect(row.country).toBe("Germany");
    expect(row.industry).toBe("FinTech");
    expect(row.countries).toEqual(["Germany", "France"]);
  });

  it("round-trips through toSearchRow / fromSearchRow", () => {
    const original = valid({
      countries: ["United States"],
      industries: ["SaaS"],
      companySizeMin: 11,
      companySizeMax: 50,
      companyType: "startup",
      fundingStages: ["seed", "series_a"],
      recentlyFundedMonths: 6,
      keywords: ["crm"],
      roleKeys: ["founder", "cto"],
      contactTypes: ["linkedin", "phone"],
      enabledProviders: ["scraper:ycombinator"],
    });

    const restored = fromSearchRow(toSearchRow(original) as Record<string, unknown>);

    expect(restored.countries).toEqual(original.countries);
    expect(restored.industries).toEqual(original.industries);
    expect(restored.companyType).toBe("startup");
    expect(restored.fundingStages).toEqual(["seed", "series_a"]);
    expect(restored.recentlyFundedMonths).toBe(6);
    expect(restored.roleKeys).toEqual(["founder", "cto"]);
    expect(restored.contactTypes).toEqual(["linkedin", "phone"]);
    expect(restored.enabledProviders).toEqual(["scraper:ycombinator"]);
  });

  it("falls back to the legacy columns for rows written before migration 035", () => {
    // A pre-035 row has no array columns at all; it must still open correctly.
    const restored = fromSearchRow({
      name: "Legacy search",
      country: "Canada",
      industry: "HealthTech",
      keywords: ["telemedicine"],
    });

    expect(restored.countries).toEqual(["Canada"]);
    expect(restored.industries).toEqual(["HealthTech"]);
    expect(restored.keywords).toEqual(["telemedicine"]);
  });

  it("drops enum values the schema no longer recognises", () => {
    const restored = fromSearchRow({
      name: "x",
      funding_stages: ["seed", "series_z"],
      contact_types: ["linkedin", "carrier_pigeon"],
      company_type: "conglomerate",
    });

    expect(restored.fundingStages).toEqual(["seed"]);
    expect(restored.contactTypes).toEqual(["linkedin"]);
    expect(restored.companyType).toBeNull();
  });
});

describe("form → pipeline API contract", () => {
  it("produces a payload the run endpoint accepts", () => {
    // The only thing pinning the builder to the API. If either side drifts, a
    // search that validates in the UI would be rejected at run time.
    const payload = toPipelineRunPayload(
      valid({
        fundingStages: ["seed", "series_a"],
        recentlyFundedMonths: 6,
        roleKeys: ["founder", "ceo"],
        enabledProviders: ["scraper:ycombinator"],
        limit: 25,
      }),
      "search-123"
    );

    const parsed = parsePipelineRunRequest(payload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.searchId).toBe("search-123");
    expect(parsed.value.roleKeys).toEqual(["founder", "ceo"]);
    expect(parsed.value.providerIds).toEqual(["scraper:ycombinator"]);
    expect(parsed.value.criteria.fundedWithinMonths).toBe(6);
    expect(parsed.value.criteria.limit).toBe(25);
  });

  it("passes a null searchId through for an unsaved run", () => {
    const parsed = parsePipelineRunRequest(toPipelineRunPayload(valid(), null));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.searchId).toBeNull();
  });
});
