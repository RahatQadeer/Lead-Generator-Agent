import { describe, expect, it } from "vitest";

import { applyCriteria } from "@/lib/company-discovery/apply-criteria";
import type { DiscoveredCompany } from "@/types/company";

const HEALTHCARE_US = {
  industry: "Healthcare",
  country: "United States",
  companySizeMin: null,
  companySizeMax: null,
  technologies: [],
  keywords: [],
};

function company(overrides: Partial<DiscoveredCompany>): DiscoveredCompany {
  return {
    id: overrides.domain ?? "id",
    name: "Example",
    domain: "example.com",
    industry: null,
    description: null,
    employeeCount: null,
    country: "United States",
    city: null,
    state: null,
    linkedinUrl: null,
    websiteUrl: `https://${overrides.domain ?? "example.com"}`,
    technologies: null,
    confidenceScore: 85,
    ...overrides,
  } as DiscoveredCompany;
}

const AVANOS = company({
  name: "Avanos Medical, Inc.",
  domain: "avanos.com",
  industry: "Healthcare",
  description:
    "Avanos is a medical technology company providing healthcare solutions for pain management and enteral feeding to help get patients back to what matters.",
});

const KANDA = company({
  name: "Kanda Software: Custom Software Development Company",
  domain: "kandasoft.com",
  industry: "Technology",
  description:
    "Kanda is a trusted Software Development Company specializing in the development of time-sensitive and innovative solutions.",
});

const IT_SOLUTIONS = company({
  name: "IT Solutions",
  domain: "itsolutions-inc.com",
  industry: "Technology",
  description:
    "Managed IT, cybersecurity, and cloud services that keep your business secure and productive.",
});

describe("applyCriteria — industry gate", () => {
  it("does not re-admit companies confidently classified into another industry", () => {
    // Every expansion net (soft fallback, near-match recovery, related-industry,
    // inclusive-fit) previously let these back in, so a generic dev shop still
    // showed up in a Healthcare search at ~75% fit.
    const { companies } = applyCriteria([AVANOS, KANDA, IT_SOLUTIONS], HEALTHCARE_US);
    const domains = companies.map((c) => c.domain);

    expect(domains).toContain("avanos.com");
    expect(domains).not.toContain("kandasoft.com");
    expect(domains).not.toContain("itsolutions-inc.com");
  });

  it("reports the wrong-industry companies as filtered out", () => {
    const { rejected } = applyCriteria([AVANOS, KANDA, IT_SOLUTIONS], HEALTHCARE_US);

    expect(rejected.map((r) => r.domain)).toEqual(
      expect.arrayContaining(["kandasoft.com", "itsolutions-inc.com"])
    );
  });

  it("keeps the healthcare company even when it is the only match", () => {
    const { companies } = applyCriteria([KANDA, AVANOS], HEALTHCARE_US);

    expect(companies.map((c) => c.domain)).toEqual(["avanos.com"]);
  });
});
