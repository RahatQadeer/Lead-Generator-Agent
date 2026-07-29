import { describe, expect, it } from "vitest";
import { contactNeedsLinkedInWebSearch } from "@/lib/contact-discovery/resolve-linkedin-profiles";
import { personNameVariants } from "@/lib/scraping/contact-name-match";
import {
  buildLinkedInProfileSearchQueries,
  buildLinkedInSearchLayers,
  buildNameAndRoleLinkedInQuery,
  buildNaturalLinkedInSearchQuery,
  buildPrimaryLinkedInGoogleQuery,
  isExactLinkedInSearchHit,
  meaningfulRoleKeywords,
  pickLinkedInFromOrderedHits,
  searchLinkedInProfile,
} from "@/lib/scraping/linkedin-profile-search";
import { companySearchVariants } from "@/lib/search/search-name-utils";

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

  it("adds city and country location variants when available", () => {
    const queries = buildLinkedInProfileSearchQueries({
      fullName: "Jane Doe",
      jobTitle: "CEO",
      companyName: "Acme Ltd",
      companyCity: "London",
      companyCountry: "United Kingdom",
    });

    expect(queries.some((q) => q.includes("London") && q.includes("linkedin"))).toBe(true);
    expect(queries.some((q) => q.includes("United Kingdom"))).toBe(true);
    expect(queries.some((q) => q.includes("Acme Ltd London"))).toBe(true);
  });
});

describe("search term variants", () => {
  it("expands a compound company name into its spaced spelling", () => {
    // "righttail" is not a separate variant — search is case-insensitive, so it is
    // the same query as "RightTail".
    expect(companySearchVariants("RightTail")).toEqual(["RightTail", "Right Tail"]);
  });

  it("drops the legal suffix before expanding, and adds the domain root", () => {
    expect(companySearchVariants("RightTail Pvt Ltd", "www.right-tail.com")).toEqual([
      "RightTail Pvt Ltd",
      "RightTail",
      "Right Tail",
      "right-tail",
    ]);
  });

  it("adds a joined spelling for an already-spaced name", () => {
    expect(companySearchVariants("ABC Software Inc")).toEqual([
      "ABC Software Inc",
      "ABC Software",
      "abcsoftware",
    ]);
  });

  it("shortens a name with middle parts to first + last", () => {
    expect(personNameVariants("Rahat Ali Qadeer")).toEqual([
      "Rahat Ali Qadeer",
      "Rahat Qadeer",
    ]);
    expect(personNameVariants("Rahat Qadeer")).toEqual(["Rahat Qadeer"]);
  });
});

describe("buildLinkedInSearchLayers", () => {
  it("tries the stored company spelling before the split spelling", () => {
    const layers = buildLinkedInSearchLayers({
      fullName: "Rahat Qadeer",
      jobTitle: "Software Engineer",
      companyName: "RightTail",
    });

    expect(layers[0].label).toBe("primary");
    expect(layers[0].queries).toContain(
      "Rahat Qadeer Software Engineer RightTail linkedin"
    );

    const labels = layers.map((layer) => layer.label);
    expect(labels).toContain("company:Right Tail");
    expect(labels.indexOf("company:Right Tail")).toBeGreaterThan(labels.indexOf("primary"));

    const splitLayer = layers.find((layer) => layer.label === "company:Right Tail");
    expect(splitLayer?.queries).toContain("Rahat Qadeer Right Tail linkedin");
    expect(splitLayer?.queries).toContain('site:linkedin.com/in "Rahat Qadeer" "Right Tail"');
  });

  it("orders company spelling layers from closest to loosest", () => {
    const labels = buildLinkedInSearchLayers({
      fullName: "John Smith",
      jobTitle: "CEO",
      companyName: "ABC Software Inc",
    }).map((layer) => layer.label);

    expect(labels.indexOf("company:ABC Software")).toBeLessThan(
      labels.indexOf("company:abcsoftware")
    );
  });

  it("adds shortened-name layers after the company spelling layers", () => {
    const layers = buildLinkedInSearchLayers({
      fullName: "Rahat Ali Qadeer",
      jobTitle: "CEO",
      companyName: "RightTail",
    });

    const labels = layers.map((layer) => layer.label);
    const firstNameLayer = labels.findIndex((label) => label.startsWith("name:"));
    const lastCompanyLayer = labels.map((l) => l.startsWith("company:")).lastIndexOf(true);

    expect(firstNameLayer).toBeGreaterThan(lastCompanyLayer);
    expect(labels).toContain("name:Rahat Qadeer company:RightTail");
    expect(
      layers.find((layer) => layer.label === "name:Rahat Qadeer company:RightTail")?.queries
    ).toContain("Rahat Qadeer CEO RightTail linkedin");
  });

  it("never repeats a query across layers", () => {
    const layers = buildLinkedInSearchLayers({
      fullName: "Jane Doe",
      jobTitle: "CEO",
      companyName: "Acme Ltd",
      companyDomain: "acme.com",
      companyCity: "London",
    });

    const all = layers.flatMap((layer) => layer.queries.map((q) => q.toLowerCase()));
    expect(all.length).toBe(new Set(all).size);
    expect(layers.every((layer) => layer.queries.length > 0)).toBe(true);
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

describe("contactNeedsLinkedInWebSearch", () => {
  const baseContact = {
    id: "c1",
    companyId: "co1",
    companyName: "Acme",
    companyDomain: "acme.com",
    firstName: "John",
    lastName: "Smith",
    fullName: "John Smith",
    title: "CEO",
    department: null,
    email: null,
    emailIsGuessed: false,
    linkedinUrl: null,
    confidenceScore: 50,
  };

  it("returns true when LinkedIn URL is missing", () => {
    expect(contactNeedsLinkedInWebSearch(baseContact, "Acme")).toBe(true);
  });

  it("returns true when website LinkedIn slug does not match the person", () => {
    expect(
      contactNeedsLinkedInWebSearch(
        {
          ...baseContact,
          linkedinUrl: "https://www.linkedin.com/in/jane-doe/",
        },
        "Acme"
      )
    ).toBe(true);
  });

  it("returns false when LinkedIn slug matches the person", () => {
    expect(
      contactNeedsLinkedInWebSearch(
        {
          ...baseContact,
          linkedinUrl: "https://www.linkedin.com/in/john-smith/",
        },
        "Acme"
      )
    ).toBe(false);
  });
});
