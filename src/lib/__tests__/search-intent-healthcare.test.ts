import { describe, expect, it } from "vitest";

import { parseSearchIntent } from "@/lib/search/search-intent";

function healthcareIntent() {
  return parseSearchIntent({
    searchName: "US Healthcare CTOs",
    industry: "Healthcare",
    country: "United States",
    keywords: [],
    companySizeMin: null,
    companySizeMax: null,
  });
}

describe("parseSearchIntent — healthcare", () => {
  it("never emits a query with no industry constraint", () => {
    // "Healthcare" matches no business-model pattern, so it fell back to the
    // "general" model, whose first phrase is "technology company" — producing
    // the bare query "technology company United States".
    const { queryVariants } = healthcareIntent();

    expect(queryVariants).not.toContain("technology company United States");
    for (const query of queryVariants) {
      expect(query.toLowerCase()).toMatch(/health|medical|hospital|biotech|pharma|cto/);
    }
  });

  it("does not search for IT/software vendors that merely serve healthcare", () => {
    const { queryVariants } = healthcareIntent();

    for (const query of queryVariants) {
      expect(query.toLowerCase()).not.toMatch(/\bit\b|software|information technology/);
    }
  });

  it("expands into healthcare-native queries", () => {
    const { queryVariants } = healthcareIntent();

    expect(queryVariants).toContain("healthcare company United States");
    expect(queryVariants).toContain("hospital health system United States");
    expect(queryVariants).toContain("medical device company United States");
  });

  it("keeps semantic terms free of generic tech vocabulary", () => {
    const { semanticTerms } = healthcareIntent();

    expect(semanticTerms).not.toContain("technology");
    expect(semanticTerms).not.toContain("software");
    expect(semanticTerms).toContain("healthcare");
  });

  it("still uses model phrases when a business model is explicit", () => {
    const { queryVariants } = parseSearchIntent({
      industry: "",
      country: "United States",
      keywords: ["fintech"],
      companySizeMin: null,
      companySizeMax: null,
    });

    expect(queryVariants).toContain("fintech company United States");
  });
});
