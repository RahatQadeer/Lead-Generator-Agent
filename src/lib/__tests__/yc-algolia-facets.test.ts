import { describe, expect, it } from "vitest";
import {
  buildYcCompaniesListingUrl,
  ycIndustriesForSearch,
  ycRegionsForCountry,
} from "@/lib/scrapers/sources/yc-algolia-facets";

describe("yc-algolia-facets", () => {
  it("maps Education to the YC industries facet", () => {
    expect(ycIndustriesForSearch("Education")).toEqual(["Education"]);
  });

  it("maps Canada to YC region facets", () => {
    expect(ycRegionsForCountry("Canada")).toEqual(["Canada"]);
  });

  it("builds the same style of URL as the YC website", () => {
    expect(
      buildYcCompaniesListingUrl({ industry: "Education", country: "Canada" })
    ).toBe("https://www.ycombinator.com/companies?regions=Canada&industry=Education");
  });
});
