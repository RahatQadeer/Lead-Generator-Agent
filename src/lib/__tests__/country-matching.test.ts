import { describe, expect, it } from "vitest";

import { countriesMatch, textMentionsCountry } from "@/lib/search/country-aliases";

describe("textMentionsCountry", () => {
  it("does not treat ordinary prose containing 'us' as a United States mention", () => {
    // The alias table maps "us" -> "united states". Matched as a substring, it hit
    // every one of these, which neutralized the country filter for every search.
    const prose = [
      "Global business directory (Wikidata). Country: China.",
      "Trees Technologies Islamabad software house",
      "Health Next Diagnostics, Islamabad - trusted diagnostic lab",
      "Leading healthcare industry provider in Lahore",
      "About us | Contact us",
    ];

    for (const text of prose) {
      expect(textMentionsCountry(text, "United States")).toBe(false);
    }
  });

  it("still recognizes genuine country mentions", () => {
    expect(textMentionsCountry("Headquartered in the United States", "United States")).toBe(true);
    expect(textMentionsCountry("A USA-based medical device maker", "United States")).toBe(true);
    expect(textMentionsCountry("Serving the u.s. market since 1998", "United States")).toBe(true);
    expect(textMentionsCountry("An American healthcare provider", "United States")).toBe(true);
  });

  it("does not match short ISO aliases embedded in unrelated words", () => {
    // "in" -> india and "it" -> italy previously matched almost any sentence.
    expect(textMentionsCountry("Based in Chicago, providing IT services", "India")).toBe(false);
    expect(textMentionsCountry("Based in Chicago, providing IT services", "Italy")).toBe(false);
  });
});

describe("countriesMatch", () => {
  it("treats a known company country as authoritative", () => {
    // Previously the mismatch fell through to the description, where marketing
    // copy re-admitted the company.
    expect(
      countriesMatch("Pakistan", "United States", {
        domain: "healthnextpk.com",
        description: "Islamabad's integrated diagnostic centre trusted by business customers",
      })
    ).toBe(false);
  });

  it("matches a company whose known country is the target", () => {
    expect(countriesMatch("United States", "United States", { domain: "avanos.com" })).toBe(true);
    expect(countriesMatch("US", "United States", { domain: "avanos.com" })).toBe(true);
  });

  it("falls back to a country-code TLD when the country is unknown", () => {
    expect(countriesMatch(null, "United States", { domain: "example.pk" })).toBe(false);
    expect(countriesMatch(null, "Pakistan", { domain: "example.pk" })).toBe(true);
  });

  it("does not treat generic TLDs as location evidence", () => {
    // .co is sold worldwide; betterhealthcare.co is a New York company. It must
    // not be read as Colombian, and an unlocatable company is not a mismatch.
    expect(countriesMatch(null, "Colombia", { domain: "betterhealthcare.co" })).toBe(true);
    expect(countriesMatch(null, "United States", { domain: "betterhealthcare.co" })).toBe(true);
  });

  it("treats an unlocatable company as unknown rather than a mismatch", () => {
    // Most web-search seeds never resolve a country; rejecting them outright
    // would gut recall. The fit score down-ranks them instead.
    expect(countriesMatch(null, "United States", { domain: "example.com" })).toBe(true);
  });

  it("passes everything when no country filter is set", () => {
    expect(countriesMatch("Pakistan", "")).toBe(true);
  });
});
