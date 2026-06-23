import { describe, expect, it } from "vitest";
import {
  buildLinkedInProfileSearchQueries,
  buildNameAndRoleLinkedInQuery,
  buildNaturalLinkedInSearchQuery,
  buildPrimaryLinkedInGoogleQuery,
  isExactLinkedInSearchHit,
  meaningfulRoleKeywords,
  pickLinkedInFromOrderedHits,
  searchLinkedInProfile,
} from "@/lib/scraping/linkedin-profile-search";

const baseInput = {
  fullName: "John Smith",
  jobTitle: "CEO",
  companyName: "ABC Software Inc",
};

describe("linkedin profile search queries", () => {
  it("builds name + full role query like a manual Google search (no company)", () => {
    const query = buildNameAndRoleLinkedInQuery(
      "Rahat Qadeer",
      "Software Engineer Full Stack Developer"
    );

    expect(query).toBe(
      "Rahat Qadeer software engineer full stack developer linkedin"
    );
    expect(meaningfulRoleKeywords("Software Engineer Full Stack Developer")).toBe(
      "software engineer full stack developer"
    );
  });

  it("builds natural Google query like a manual search (name + role + company + linkedin)", () => {
    const natural = buildNaturalLinkedInSearchQuery({
      fullName: "Rahat Qadeer",
      jobTitle: "Software Engineering",
      companyName: "Right Tail",
    });

    expect(natural).toBe("Rahat Qadeer Software Engineering Right Tail linkedin");
  });

  it("builds primary Google query with name, role, and company", () => {
    const primary = buildPrimaryLinkedInGoogleQuery(baseInput);

    expect(primary).toContain('site:linkedin.com/in "John Smith"');
    expect(primary).toContain("CEO");
    expect(primary).toContain("ABC Software");
  });

  it("builds structured Google/Bing site:linkedin.com/in queries", () => {
    const queries = buildLinkedInProfileSearchQueries(baseInput);

    expect(queries[0]).toBe("John Smith CEO linkedin");
    expect(queries).toContain("John Smith CEO ABC Software Inc linkedin");
    expect(queries.some((q) => q.includes('site:linkedin.com/in "John Smith"'))).toBe(true);
    expect(queries.every((q) => q.includes("linkedin"))).toBe(true);
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

describe("pickLinkedInFromOrderedHits", () => {
  it("prefers an exact name + company match over the first result", () => {
    const picked = pickLinkedInFromOrderedHits(baseInput, [
      {
        title: "Jane Doe - CTO - Other Co | LinkedIn",
        url: "https://www.linkedin.com/in/jane-doe/",
        content: "CTO at Other Co",
        backend: "searxng",
      },
      {
        title: "John Smith - CEO - ABC Software Inc | LinkedIn",
        url: "https://www.linkedin.com/in/john-smith/",
        content: "CEO at ABC Software Inc",
        backend: "searxng",
      },
    ]);

    expect(picked?.url).toBe("https://www.linkedin.com/in/john-smith");
    expect(isExactLinkedInSearchHit(baseInput, {
      title: "John Smith - CEO - ABC Software Inc | LinkedIn",
      url: "https://www.linkedin.com/in/john-smith/",
      content: "CEO at ABC Software Inc",
    })).toBe(true);
  });

  it("returns null when no result mentions the target company", () => {
    const picked = pickLinkedInFromOrderedHits(baseInput, [
      {
        title: "John Smith - Founder | LinkedIn",
        url: "https://www.linkedin.com/in/john-smith-founder/",
        content: "Founder and operator",
        backend: "searxng",
      },
    ]);

    expect(picked).toBeNull();
  });

  it("accepts a name + slug match without company when company match is not required", () => {
    const picked = pickLinkedInFromOrderedHits(
      {
        fullName: "Jack Silk",
        jobTitle: "Software Engineer",
        companyName: "ABC Software Inc",
        requireCompanyMatch: false,
      },
      [
        {
          title: "Jack Silk - Software Engineer | LinkedIn",
          url: "https://www.linkedin.com/in/jack-silk/",
          content: "Building products and platforms",
          backend: "searxng",
        },
      ]
    );

    expect(picked?.url).toBe("https://www.linkedin.com/in/jack-silk");
    expect(picked?.companyMatch).toBe(false);
  });

  it("rejects profiles that name a different employer", () => {
    const picked = pickLinkedInFromOrderedHits(
      {
        fullName: "Dino Varkey",
        jobTitle: "Group Chief Executive Officer",
        companyName: "EduTech Global",
      },
      [
        {
          title:
            "Dino Varkey - Group Chief Executive Officer, GEMS Education · GEMS Education | LinkedIn",
          url: "https://www.linkedin.com/in/dino-varkey/",
          content: "Group Chief Executive Officer at GEMS Education",
          backend: "searxng",
        },
      ]
    );

    expect(picked).toBeNull();
  });
});

describe("searchLinkedInProfile", () => {
  it("exports search function", () => {
    expect(typeof searchLinkedInProfile).toBe("function");
  });
});
