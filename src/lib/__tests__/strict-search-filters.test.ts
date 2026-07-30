import { describe, expect, it } from "vitest";
import {
  filterCompaniesBySearchCriteria,
  passesStrictSearchFilters,
} from "@/lib/company-discovery/apply-criteria";
import type { DiscoveredCompany } from "@/types/company";

function company(overrides: Partial<DiscoveredCompany> = {}): DiscoveredCompany {
  return {
    id: "ycombinator:shipright",
    name: "ShipRight",
    domain: "shipright.com",
    industry: "Logistics",
    description: "Freight and supply chain software for shippers.",
    employeeCount: 40,
    country: "United States",
    city: "San Francisco",
    state: "CA",
    linkedinUrl: null,
    websiteUrl: "https://shipright.com",
    technologies: ["logistics"],
    confidenceScore: 70,
    ...overrides,
  };
}

const LOGISTICS_US = {
  industry: "Logistics",
  country: "United States",
  companySizeMin: null,
  companySizeMax: null,
  technologies: [] as string[],
  keywords: [] as string[],
};

describe("passesStrictSearchFilters", () => {
  it("accepts a company that matches industry and country", () => {
    expect(passesStrictSearchFilters(company(), LOGISTICS_US)).toBe(true);
  });

  it("rejects a company in the wrong industry", () => {
    expect(
      passesStrictSearchFilters(
        company({
          industry: "Healthcare",
          description: "Hospital management platform.",
          technologies: ["healthtech"],
        }),
        LOGISTICS_US
      )
    ).toBe(false);
  });

  it("rejects a company in the wrong country", () => {
    expect(
      passesStrictSearchFilters(
        company({ country: "Germany", city: "Berlin", state: null }),
        LOGISTICS_US
      )
    ).toBe(false);
  });

  it("rejects a company with unknown country when country is required", () => {
    expect(passesStrictSearchFilters(company({ country: null }), LOGISTICS_US)).toBe(false);
  });
});

describe("filterCompaniesBySearchCriteria", () => {
  it("keeps only companies that match the selected industry and country", () => {
    const filtered = filterCompaniesBySearchCriteria(
      [
        company(),
        company({
          id: "ycombinator:health",
          name: "HealthCo",
          domain: "healthco.com",
          industry: "Healthcare",
          description: "Digital health records.",
          technologies: ["healthtech"],
        }),
        company({
          id: "ycombinator:eu",
          name: "EuroShip",
          domain: "euroship.de",
          industry: "Logistics",
          description: "European freight marketplace.",
          country: "Germany",
          city: "Berlin",
          state: null,
        }),
      ],
      LOGISTICS_US
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe("ShipRight");
  });
});
