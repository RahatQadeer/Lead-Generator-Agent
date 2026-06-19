import { describe, expect, it } from "vitest";
import {
  buildLinkedInProfileSearchQueries,
  searchLinkedInProfile,
} from "@/lib/scraping/linkedin-profile-search";

describe("linkedin profile search queries", () => {
  it("builds structured Google/Bing site:linkedin.com/in queries", () => {
    const queries = buildLinkedInProfileSearchQueries({
      fullName: "John Smith",
      jobTitle: "CEO",
      companyName: "ABC Software Inc",
    });

    expect(queries[0]).toContain('site:linkedin.com/in "John Smith" CEO');
    expect(queries[0]).toContain("ABC Software");
    expect(queries.every((q) => q.includes("site:linkedin.com/in"))).toBe(true);
  });

  it("includes role-only and name-only fallbacks", () => {
    const queries = buildLinkedInProfileSearchQueries({
      fullName: "Shiv Charan Panjeta",
      jobTitle: "VP Engineering",
      companyName: "HealthTech Corp",
      companyDomain: "healthtech.com",
    });

    expect(
      queries.some((q) => q.includes('"Shiv Charan Panjeta"') && q.includes("VP"))
    ).toBe(true);
    expect(queries.some((q) => q.includes("healthtech.com"))).toBe(true);
    expect(queries.some((q) => q === 'site:linkedin.com/in "Shiv Charan Panjeta"')).toBe(true);
  });
});

describe("searchLinkedInProfile", () => {
  it("exports search function", () => {
    expect(typeof searchLinkedInProfile).toBe("function");
  });
});
