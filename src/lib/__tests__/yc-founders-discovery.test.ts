import { describe, expect, it } from "vitest";
import {
  discoverYcContactsForCompany,
  isYcCompany,
  parseDirectoryProfile,
} from "@/lib/contact-discovery/yc-founders-discovery";
import type { ContactDiscoveryTargetCompany } from "@/types/contact";

const YC_COMPANY: ContactDiscoveryTargetCompany = {
  id: "db-1",
  name: "Acme Corp",
  domain: "acme.com",
  providerCompanyId: "ycombinator:acme",
  directoryProfile: {
    source: "ycombinator",
    sourceUrl: "https://www.ycombinator.com/companies/acme",
    category: null,
    tags: [],
    founders: [
      { name: "Jane Doe", title: "Founder/CEO", linkedinUrl: "https://linkedin.com/in/jane" },
      { name: "John Smith", title: "Co-Founder/CTO" },
    ],
    publicEmail: null,
    publicPhone: null,
    contactPageUrl: null,
    careersPageUrl: null,
    socialLinks: {},
    fundingStage: null,
    investors: [],
    teamSize: null,
    launchDate: null,
    websiteExtras: {},
    sources: [],
  },
};

describe("parseDirectoryProfile", () => {
  it("parses a valid directory profile", () => {
    const profile = parseDirectoryProfile({
      source: "ycombinator",
      sourceUrl: "https://www.ycombinator.com/companies/acme",
      founders: [],
    });
    expect(profile?.source).toBe("ycombinator");
  });

  it("returns null for invalid payloads", () => {
    expect(parseDirectoryProfile(null)).toBeNull();
    expect(parseDirectoryProfile("bad")).toBeNull();
  });
});

describe("isYcCompany", () => {
  it("detects YC companies by directory profile or provider id", () => {
    expect(isYcCompany(YC_COMPANY)).toBe(true);
    expect(
      isYcCompany({
        ...YC_COMPANY,
        directoryProfile: null,
        providerCompanyId: "ycombinator:acme",
      })
    ).toBe(true);
    expect(
      isYcCompany({
        ...YC_COMPANY,
        directoryProfile: null,
        providerCompanyId: "google-places:abc",
      })
    ).toBe(false);
  });
});

describe("discoverYcContactsForCompany", () => {
  it("returns YC founders first and skips other sources when titles match", async () => {
    const result = await discoverYcContactsForCompany(YC_COMPANY, ["CEO", "Founder"]);

    expect(result.founderPool).toHaveLength(2);
    expect(result.contacts.length).toBeGreaterThan(0);
    expect(result.skipOtherSources).toBe(true);
    expect(result.contacts[0]?.discoverySource).toBe("directory_listing");
    expect(result.contacts[0]?.fullName).toBe("Jane Doe");
  });

  it("returns empty for non-YC companies", async () => {
    const result = await discoverYcContactsForCompany(
      {
        ...YC_COMPANY,
        providerCompanyId: "google-places:abc",
        directoryProfile: null,
      },
      ["CEO"]
    );
    expect(result.founderPool).toHaveLength(0);
    expect(result.skipOtherSources).toBe(false);
  });
});
