import { afterEach, describe, expect, it } from "vitest";
import { extractEmails } from "@/lib/scraping/parse-html";
import {
  decodeHtmlEntities,
  formatReplySnippetForDisplay,
  stripQuotedReplyContent,
} from "@/lib/reply-tracking/extract-reply-text";
import {
  extractDomainFromUrl,
  isLikelyCompanyDomain,
} from "@/lib/scraping/extract-domain";
import { buildCompanySearchQuery } from "@/lib/scraping/web-search";
import { buildWikipediaSearchQueries } from "@/lib/scraping/wikipedia-search";
import { CSV_IMPORT_TEMPLATE, parseCsvLeads } from "@/lib/import/parse-csv";

describe("company search result filter", () => {
  it("blocks directory and article-like results", async () => {
    const {
      isLikelyCompanySearchResult,
      cleanCompanyNameFromSearchTitle,
      isArticleLikeTitle,
    } = await import("@/lib/scraping/company-search-filter");

    expect(
      isLikelyCompanySearchResult({
        title: "Top 20+ IT Companies in Pakistan (2026) - TechBehemoths",
        url: "https://techbehemoths.com/companies/pakistan",
        snippet: "list",
        domain: "techbehemoths.com",
      })
    ).toBe(false);

    expect(
      isLikelyCompanySearchResult({
        title: "Top Education Startups in Pakistan",
        url: "https://bouncewatch.com/startups/pakistan",
        snippet: "Discover top startups",
        domain: "bouncewatch.com",
      })
    ).toBe(false);

    expect(
      isLikelyCompanySearchResult({
        title: "70 Best Pakistan Education Startups",
        url: "https://startupill.com/pakistan",
        snippet: "list of startups",
        domain: "startupill.com",
      })
    ).toBe(false);

    expect(
      isLikelyCompanySearchResult({
        title: "Home",
        url: "https://edversity.com.pk/about",
        snippet: "online learning platform",
        domain: "edversity.com.pk",
      })
    ).toBe(true);

    expect(cleanCompanyNameFromSearchTitle("Home", "edversity.com.pk")).toBe("Edversity");

    expect(isArticleLikeTitle("Best 10 software companies in Pakistan")).toBe(true);
    expect(cleanCompanyNameFromSearchTitle("Arbisoft - Official Site", "arbisoft.com")).toBe(
      "Arbisoft"
    );

    expect(
      isLikelyCompanySearchResult({
        title: "10Pearls - Software Development Company",
        url: "https://10pearls.com",
        snippet: "software",
        domain: "10pearls.com",
      })
    ).toBe(true);
  });
});

describe("scraping extract-domain", () => {
  it("extracts domain from URL", () => {
    expect(extractDomainFromUrl("https://www.butterbee.co/team")).toBe("butterbee.co");
  });

  it("blocks social hosts", () => {
    expect(extractDomainFromUrl("https://linkedin.com/company/foo")).toBeNull();
  });

  it("validates company domains", () => {
    expect(isLikelyCompanyDomain("butterbee.co")).toBe(true);
    expect(isLikelyCompanyDomain("linkedin.com")).toBe(false);
    expect(isLikelyCompanyDomain("techbehemoths.com")).toBe(false);
    expect(isLikelyCompanyDomain("stanford.edu")).toBe(false);
    expect(isLikelyCompanyDomain("mod.gov.uk")).toBe(false);
  });
});

describe("non-commercial organization blockers", () => {
  it("rejects government, university, museum, and nonprofit entities", async () => {
    const {
      isNonCommercialOrganization,
      isNonCommercialDomain,
    } = await import("@/lib/scraping/org-type-blockers");
    const { isLikelyCompanySearchResult } = await import(
      "@/lib/scraping/company-search-filter"
    );

    expect(isNonCommercialDomain("harvard.edu")).toBe(true);
    expect(isNonCommercialDomain("defense.mil")).toBe(true);

    expect(
      isNonCommercialOrganization({
        name: "Smithsonian Institution",
        description: "National museum",
      }).blocked
    ).toBe(true);

    expect(
      isNonCommercialOrganization({
        name: "MIT",
        description: "Massachusetts Institute of Technology campus",
      }).blocked
    ).toBe(true);

    expect(
      isLikelyCompanySearchResult({
        title: "Stanford University",
        url: "https://stanford.edu",
        snippet: "research university",
        domain: "stanford.edu",
      })
    ).toBe(false);
  });

  it("rejects venture capital and accelerator programs", async () => {
    const { isInvestorOrAcceleratorOrganization } = await import(
      "@/lib/scraping/org-type-blockers"
    );
    const { passesHardRelevanceBlockers } = await import(
      "@/lib/scraping/company-relevance"
    );

    expect(
      isInvestorOrAcceleratorOrganization({
        name: "HAX – Hands-on Venture Capital for Hard Tech",
        description: "A program built for pre-seed startups",
      }).blocked
    ).toBe(true);

    expect(
      isInvestorOrAcceleratorOrganization({
        name: "Acme Software",
        description: "We build a SaaS platform for logistics teams",
      }).blocked
    ).toBe(false);

    expect(
      passesHardRelevanceBlockers(
        {
          id: "1",
          name: "HAX",
          domain: "hax.co",
          industry: "Technology",
          description: "venture capital for hard tech startups",
          employeeCount: null,
          country: "US",
          city: null,
          state: null,
          linkedinUrl: null,
          websiteUrl: "https://hax.co",
          technologies: null,
          confidenceScore: 80,
        },
        { industry: "Technology", keywords: ["startup"] }
      ).relevant
    ).toBe(false);
  });
});

describe("global country matching", () => {
  it("matches countries via aliases and domain TLD hints", async () => {
    const { countriesMatch } = await import("@/lib/search/country-aliases");
    const { matchesCountry } = await import("@/lib/company-discovery/apply-criteria");

    expect(countriesMatch(null, "Pakistan", { domain: "arbisoft.com.pk" })).toBe(true);
    expect(countriesMatch("PK", "Pakistan")).toBe(true);
    expect(countriesMatch("UAE", "United Arab Emirates")).toBe(true);

    expect(
      matchesCountry(
        {
          id: "1",
          name: "Arbisoft",
          domain: "arbisoft.com.pk",
          industry: "Technology",
          description: "Software company in Lahore, Pakistan",
          employeeCount: null,
          country: null,
          city: null,
          state: null,
          linkedinUrl: null,
          websiteUrl: "https://arbisoft.com.pk",
          technologies: null,
          confidenceScore: 50,
        },
        "Pakistan"
      )
    ).toBe(true);
  });
});

describe("lead quality scoring", () => {
  it("produces 0-100 breakdown with Apollo-style categories", async () => {
    const { computeLeadQualityBreakdown, scoreToCategory } = await import(
      "@/lib/lead-scoring/lead-quality-score"
    );

    const breakdown = computeLeadQualityBreakdown(
      {
        contactId: "1",
        role: "CEO",
        email: "jane@acme.com",
        emailSource: "found",
        linkedinUrl: "https://linkedin.com/in/janedoe",
        linkedInSource: "website",
        emailDisplayStatus: "verified",
        company: {
          name: "Acme",
          domain: "acme.com",
          industry: "Technology",
          description: "B2B software platform",
          employeeCount: 50,
          country: "United States",
          websiteUrl: "https://acme.com",
          technologies: ["React"],
        },
      },
      {
        industry: "Technology",
        country: "United States",
        companySizeMin: 11,
        companySizeMax: 200,
        technologies: [],
        jobTitles: ["CEO"],
      },
      "verified_email"
    );

    expect(breakdown.overallScore).toBeGreaterThanOrEqual(75);
    expect(scoreToCategory(breakdown.overallScore)).toBe("excellent");
    expect(breakdown.companyScore).toBeGreaterThan(0);
    expect(breakdown.personScore).toBeGreaterThan(0);
    expect(breakdown.contactScore).toBeGreaterThan(0);
  });
});

describe("firmographics extraction", () => {
  it("parses employee count from LinkedIn-style snippets", async () => {
    const { parseEmployeeCountFromText, parseCountryFromText } = await import(
      "@/lib/scraping/firmographics"
    );

    expect(parseEmployeeCountFromText("51-200 employees · Software")).toBe(126);
    expect(parseEmployeeCountFromText("Based in Lahore, Pakistan")).toBeNull();
    expect(parseCountryFromText("Software company in Lahore, Pakistan")).toBe("Pakistan");
  });
});

describe("decision maker title filter", () => {
  it("rejects advisors and board members", async () => {
    const { matchesJobTitle } = await import(
      "@/lib/contact-discovery/apply-title-filter"
    );

    expect(matchesJobTitle("Board Member", ["CEO", "Director"])).toBe(false);
    expect(matchesJobTitle("Strategic Advisor", ["CEO", "Founder"])).toBe(false);
    expect(matchesJobTitle("Former CEO at OtherCo", ["CEO"])).toBe(false);
    expect(matchesJobTitle("CEO", ["CEO", "Founder"])).toBe(true);
  });
});

describe("search intent parsing", () => {
  it("builds semantic query variants from search name and criteria", async () => {
    const { parseSearchIntent } = await import("@/lib/search/search-intent");

    const intent = parseSearchIntent({
      searchName: "tech pak",
      industry: "Technology",
      country: "Pakistan",
      keywords: ["software", "B2B"],
    });

    expect(intent.businessModels).toContain("b2b");
    expect(intent.queryVariants.length).toBeGreaterThan(0);
    expect(intent.queryVariants.some((q) => q.toLowerCase().includes("pakistan"))).toBe(true);
  });
});

describe("company fit breakdown", () => {
  it("returns explainable score factors", async () => {
    const { computeCompanyFitBreakdown } = await import(
      "@/lib/scraping/company-fit-breakdown"
    );

    const breakdown = computeCompanyFitBreakdown(
      {
        id: "1",
        name: "Arbisoft",
        domain: "arbisoft.com.pk",
        industry: "Technology",
        description: "Software engineering company in Pakistan",
        employeeCount: 80,
        country: "Pakistan",
        city: null,
        state: null,
        linkedinUrl: "https://linkedin.com/company/arbisoft",
        websiteUrl: "https://arbisoft.com.pk",
        technologies: null,
        confidenceScore: 70,
      },
      {
        industry: "Technology",
        country: "Pakistan",
        companySizeMin: 11,
        companySizeMax: 200,
        technologies: [],
        keywords: ["software"],
      }
    );

    expect(breakdown.overall).toBeGreaterThan(40);
    expect(breakdown.factors.length).toBeGreaterThan(3);
    expect(breakdown.verificationNotes.length).toBeGreaterThan(0);
  });
});

describe("strict company validation", () => {
  it("rejects Y Combinator for E-commerce Sweden search", async () => {
    const { validateCompanyForDiscovery } = await import(
      "@/lib/company-discovery/validate-company"
    );

    const result = validateCompanyForDiscovery(
      {
        id: "yc",
        name: "Y Combinator",
        domain: "ycombinator.com",
        industry: "Technology",
        description: "Startup accelerator and venture program",
        employeeCount: 100,
        country: "United States",
        city: null,
        state: null,
        linkedinUrl: null,
        websiteUrl: "https://ycombinator.com",
        technologies: null,
        confidenceScore: 90,
      },
      {
        industry: "E-commerce",
        country: "Sweden",
        companySizeMin: 51,
        companySizeMax: 200,
        technologies: [],
        keywords: [],
      }
    );

    expect(result.accepted).toBe(false);
    expect(result.reasons.some((r) => /accelerator/i.test(r))).toBe(true);
  });

  it("rejects Verdane for E-commerce Sweden search", async () => {
    const { validateCompanyForDiscovery } = await import(
      "@/lib/company-discovery/validate-company"
    );

    const result = validateCompanyForDiscovery(
      {
        id: "verdane",
        name: "Verdane",
        domain: "verdane.com",
        industry: "Finance",
        description: "European growth investor and private equity",
        employeeCount: 120,
        country: "Sweden",
        city: null,
        state: null,
        linkedinUrl: null,
        websiteUrl: "https://verdane.com",
        technologies: null,
        confidenceScore: 85,
      },
      {
        industry: "E-commerce",
        country: "Sweden",
        companySizeMin: 51,
        companySizeMax: 200,
        technologies: [],
        keywords: [],
      }
    );

    expect(result.accepted).toBe(false);
    expect(result.reasons.some((r) => /investment/i.test(r))).toBe(true);
    expect(result.reasons.some((r) => /E-commerce/i.test(r))).toBe(true);
  });

  it("accepts known e-commerce brand with unknown headcount (warning only)", async () => {
    const { validateCompanyForDiscovery } = await import(
      "@/lib/company-discovery/validate-company"
    );

    const result = validateCompanyForDiscovery(
      {
        id: "alibaba",
        name: "Alibaba",
        domain: "alibaba.com",
        industry: "Technology",
        description: "Technology company",
        employeeCount: null,
        country: "China",
        city: null,
        state: null,
        linkedinUrl: null,
        websiteUrl: "https://alibaba.com",
        technologies: null,
        confidenceScore: 85,
      },
      {
        industry: "E-commerce",
        country: "",
        companySizeMin: 51,
        companySizeMax: 200,
        technologies: [],
        keywords: [],
      }
    );

    expect(result.accepted).toBe(true);
    expect(result.warnings.some((w) => /employee count unknown/i.test(w))).toBe(true);
  });

  it("does not duplicate rejection reasons for type + industry mismatch", async () => {
    const { validateCompanyForDiscovery } = await import(
      "@/lib/company-discovery/validate-company"
    );

    const result = validateCompanyForDiscovery(
      {
        id: "adyen",
        name: "Adyen",
        domain: "adyen.com",
        industry: "Financial Services",
        description: "Payment platform for enterprises",
        employeeCount: null,
        country: "Netherlands",
        city: null,
        state: null,
        linkedinUrl: null,
        websiteUrl: "https://adyen.com",
        technologies: null,
        confidenceScore: 80,
      },
      {
        industry: "E-commerce",
        country: "",
        companySizeMin: 51,
        companySizeMax: 200,
        technologies: [],
        keywords: [],
      }
    );

    expect(result.accepted).toBe(false);
    const requiredIndustryLines = result.reasons.filter((r) =>
      /required industry/i.test(r)
    );
    expect(requiredIndustryLines.length).toBeLessThanOrEqual(1);
  });
});

describe("contact quality classification", () => {
  it("classifies generic emails as low quality", async () => {
    const { classifyContactQuality } = await import("@/lib/scraping/data-quality");

    expect(
      classifyContactQuality({ email: "info@shop.se", fullName: "Jane Doe" })
    ).toBe("low");
    expect(
      classifyContactQuality({
        email: "jane.doe@shop.se",
        fullName: "Jane Doe",
      })
    ).toBe("high");
    expect(
      classifyContactQuality({ email: null, linkedinUrl: "https://linkedin.com/in/jane" })
    ).toBe("medium");
  });
});

describe("company discovery ranking", () => {
  it("only accepts companies that pass strict validation", async () => {
    const { applyCriteria } = await import("@/lib/company-discovery/apply-criteria");

    const companies = [
      {
        id: "1",
        name: "Nordic Shop AB",
        domain: "nordicshop.se",
        industry: "E-commerce",
        description: "Swedish online fashion store selling products online",
        employeeCount: 80,
        country: "Sweden",
        city: null,
        state: null,
        linkedinUrl: null,
        websiteUrl: "https://nordicshop.se",
        technologies: null,
        confidenceScore: 70,
      },
      {
        id: "2",
        name: "Y Combinator",
        domain: "ycombinator.com",
        industry: "Technology",
        description: "Startup accelerator",
        employeeCount: 100,
        country: "United States",
        city: null,
        state: null,
        linkedinUrl: null,
        websiteUrl: "https://ycombinator.com",
        technologies: null,
        confidenceScore: 90,
      },
    ];

    const { companies: matched, rejected } = applyCriteria(companies, {
      industry: "E-commerce",
      country: "Sweden",
      companySizeMin: 51,
      companySizeMax: 200,
      technologies: [],
      keywords: [],
    });

    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe("Nordic Shop AB");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].name).toBe("Y Combinator");
  });
});

describe("company size filter", () => {
  it("allows unknown headcount through validation (warning, not reject)", async () => {
    const { validateCompanyForDiscovery } = await import(
      "@/lib/company-discovery/validate-company"
    );

    const result = validateCompanyForDiscovery(
      {
        id: "1",
        name: "Nordic Shop AB",
        domain: "nordicshop.se",
        industry: "E-commerce",
        description: "Swedish online fashion store selling products online",
        employeeCount: null,
        country: "Sweden",
        city: null,
        state: null,
        linkedinUrl: null,
        websiteUrl: "https://nordicshop.se",
        technologies: null,
        confidenceScore: 70,
      },
      {
        industry: "E-commerce",
        country: "Sweden",
        companySizeMin: 51,
        companySizeMax: 200,
        technologies: [],
        keywords: [],
      }
    );

    expect(result.accepted).toBe(true);
    expect(result.warnings.some((w) => /employee count unknown/i.test(w))).toBe(true);
  });

  it("matchesSize returns false for unknown headcount", async () => {
    const { matchesSize } = await import("@/lib/company-discovery/apply-criteria");

    const company = {
      id: "1",
      name: "Acme",
      domain: "acme.com",
      industry: "Technology",
      description: null,
      employeeCount: null,
      country: null,
      city: null,
      state: null,
      linkedinUrl: null,
      websiteUrl: null,
      technologies: null,
      confidenceScore: 50,
    };

    expect(matchesSize(company, 1, 100)).toBe(false);
    expect(matchesSize(company, null, null)).toBe(true);
  });
});

describe("company search filter", () => {
  it("rejects government and geography-only search hits", async () => {
    const {
      isLikelyCompanySearchResult,
      cleanCompanyNameFromSearchTitle,
      isHistoricalOrDefunctName,
    } = await import("@/lib/scraping/company-search-filter");

    expect(
      isLikelyCompanySearchResult({
        title: "Algeria",
        url: "https://el-mouradia.dz/",
        domain: "el-mouradia.dz",
        snippet: "Official site",
      })
    ).toBe(false);

    expect(isHistoricalOrDefunctName("Algeria")).toBe(true);
    expect(cleanCompanyNameFromSearchTitle("Welcome to ALDI", "aldi.com")).toBe("ALDI");
  });
});

describe("Pakistan technology search filters", () => {
  it("does not treat separate B2B + software keywords as SaaS-only mode", async () => {
    const { searchTargetsSaas, matchesSearchKeywords, assessCompanyRelevance } =
      await import("@/lib/scraping/company-relevance");

    const search = { industry: "Technology", keywords: ["B2B", "software"] };
    expect(searchTargetsSaas(search)).toBe(false);

    const company = {
      id: "1",
      name: "Arbisoft",
      domain: "arbisoft.com.pk",
      industry: "Technology",
      description: "Software engineering and technology services company in Pakistan",
      employeeCount: null,
      country: "Pakistan",
      city: null,
      state: null,
      linkedinUrl: null,
      websiteUrl: "https://arbisoft.com.pk",
      technologies: null,
      confidenceScore: 60,
    };

    expect(matchesSearchKeywords(company, search.keywords)).toBe(true);
    expect(assessCompanyRelevance(company, search).relevant).toBe(true);
  });

  it("passes full criteria for Pakistan technology companies", async () => {
    const { matchesCompanyCriteria } = await import(
      "@/lib/company-discovery/apply-criteria"
    );

    const company = {
      id: "1",
      name: "Arbisoft",
      domain: "arbisoft.com.pk",
      industry: "Technology",
      description: "Software engineering and technology services company in Pakistan",
      employeeCount: 80,
      country: "Pakistan",
      city: null,
      state: null,
      linkedinUrl: null,
      websiteUrl: "https://arbisoft.com.pk",
      technologies: null,
      confidenceScore: 60,
    };

    expect(
      matchesCompanyCriteria(company, {
        industry: "Technology",
        country: "Pakistan",
        companySizeMin: 1,
        companySizeMax: 100,
        technologies: [],
        keywords: ["B2B", "software"],
      })
    ).toBe(true);
  });

  it("matches B2B keyword when company profile mentions software only", async () => {
    const { matchesSearchKeywords } = await import("@/lib/scraping/company-relevance");

    expect(
      matchesSearchKeywords(
        {
          name: "Tech Co",
          domain: "techco.com.pk",
          industry: "Technology",
          description: "Custom software development for enterprises",
        },
        ["B2B", "software"]
      )
    ).toBe(true);
  });
});

describe("scraping web search query", () => {
  it("builds a search query from criteria", () => {
    const query = buildCompanySearchQuery({
      industry: "Technology",
      country: "Pakistan",
      keywords: ["startup"],
      technologies: ["Node.js"],
    });

    expect(query).toContain("Technology");
    expect(query).toContain("Pakistan");
    expect(query).toContain("startup");
  });

  it("builds wikipedia search queries from criteria", () => {
    const queries = buildWikipediaSearchQueries({
      industry: "Technology",
      country: "United States",
      keywords: ["software"],
    });

    expect(queries.length).toBeLessThanOrEqual(5);
    expect(queries.some((q) => q.includes("United States"))).toBe(true);
    expect(queries.some((q) => q === "Technology companies")).toBe(false);
  });

  it("ignores internal campaign search names in discovery queries", async () => {
    const { isUsefulSearchName } = await import("@/lib/search/search-name-utils");
    expect(isUsefulSearchName("SaaS Healthcare CTO Test")).toBe(false);
    expect(isUsefulSearchName("Pakistan healthtech outreach")).toBe(true);
  });

  it("deprioritizes foreign list-page seeds when country is set", async () => {
    const { seedLooksForeign } = await import("@/lib/scraping/rank-search-seeds");

    expect(
      seedLooksForeign(
        {
          title: "English | GE HealthCare (United States)",
          url: "https://gehealthcare.com",
          snippet: "Global healthcare",
          domain: "gehealthcare.com",
          seedSource: "web",
        },
        "Pakistan"
      )
    ).toBe(true);

    expect(
      seedLooksForeign(
        {
          title: "Islamabad Diagnostic Centre (Pvt) Ltd.",
          url: "https://idc.net.pk",
          snippet: "OpenStreetMap business directory.",
          domain: "idc.net.pk",
          country: "Pakistan",
          seedSource: "directory",
        },
        "Pakistan"
      )
    ).toBe(false);
  });
});

describe("wikipedia company search", () => {
  it("finds real companies with websites from wikipedia/wikidata", async () => {
    const { searchWikipediaCompanies } = await import(
      "@/lib/scraping/wikipedia-search"
    );
    const queries = buildWikipediaSearchQueries({
      industry: "Technology",
      country: "United States",
      keywords: ["software"],
    });
    const results = await searchWikipediaCompanies(queries, 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].domain).toMatch(/\./);
    expect(results[0].url).toMatch(/^https?:\/\//);
  }, 30_000);
});

describe("reply snippet formatting", () => {
  it("strips quoted thread content", () => {
    const raw =
      "hello rahat On Fri, 12 Jun 2026 at 13:41, Rahat Qadeer wrote: Hey Laiba";
    expect(stripQuotedReplyContent(raw)).toBe("hello rahat");
  });

  it("decodes html entities", () => {
    expect(decodeHtmlEntities("Rahat &lt;test@example.com&gt;")).toBe(
      "Rahat <test@example.com>"
    );
  });

  it("formats full snippet for display", () => {
    expect(
      formatReplySnippetForDisplay("Thanks! On Mon, Jan wrote: previous message")
    ).toBe("Thanks!");
  });
});

describe("parse-html email extraction", () => {
  it("extracts emails from html", () => {
    const emails = extractEmails(
      'Contact <a href="mailto:ceo@acme.com">ceo@acme.com</a>',
      "acme.com"
    );
    expect(emails).toContain("ceo@acme.com");
  });
});

describe("csv import parser", () => {
  it("parses valid csv rows", () => {
    const { rows, errors } = parseCsvLeads(CSV_IMPORT_TEMPLATE);
    expect(errors).toHaveLength(0);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].company).toBe("ButterBee");
  });
});

describe("scraping contact paths", () => {
  it("includes common team and leadership URLs", async () => {
    const { discoverCandidatePaths } = await import("@/lib/scraping/sitemap");
    const paths = await discoverCandidatePaths("example.com");

    expect(paths).toContain("https://example.com/about");
    expect(paths).toContain("https://example.com/our-team");
    expect(paths).toContain("https://example.com/management");
    expect(paths).toContain("https://example.com/staff");
    expect(paths).toContain("https://example.com/people");
    expect(paths).toContain("https://example.com/board");
    expect(paths).toContain("https://example.com/board-of-directors");
    expect(paths.length).toBeGreaterThanOrEqual(20);
  });
});

describe("scraping js detection", () => {
  it("detects Next.js SPA shells", async () => {
    const { isLikelyJsRendered, shouldTryPlaywrightFallback } = await import(
      "@/lib/scraping/js-detection"
    );

    const nextShell =
      '<html><body><div id="__next"></div><script>__NEXT_DATA__</script></body></html>';
    expect(isLikelyJsRendered(nextShell)).toBe(true);
    expect(shouldTryPlaywrightFallback(nextShell, false)).toBe(true);
    expect(shouldTryPlaywrightFallback(nextShell, true)).toBe(false);
  });
});

describe("scraping parse-html contacts", () => {
  it("extracts contacts from JSON-LD Person schema", async () => {
    const { parseContactsFromHtml } = await import("@/lib/scraping/parse-html");
    const html = `
      <html><body>
        <script type="application/ld+json">
          {"@type":"Person","name":"Sarah Chen","jobTitle":"CEO","email":"sarah@acme.com","sameAs":"https://linkedin.com/in/sarah-chen"}
        </script>
      </body></html>`;

    const contacts = parseContactsFromHtml(html, "acme.com");
    expect(contacts.length).toBe(1);
    expect(contacts[0].fullName).toBe("Sarah Chen");
    expect(contacts[0].title).toBe("CEO");
    expect(contacts[0].email).toBe("sarah@acme.com");
    expect(contacts[0].linkedinUrl).toContain("linkedin.com/in/sarah-chen");
  });

  it("parses h4 name with role on team pages", async () => {
    const { parseContactsFromHtml } = await import("@/lib/scraping/parse-html");
    const html = `
      <section class="team">
        <h4>Erik Johansson</h4>
        <p>CEO & Founder</p>
      </section>
    `;

    const contacts = parseContactsFromHtml(html, "shop.se", "https://shop.se/team");
    expect(contacts.length).toBeGreaterThan(0);
    expect(contacts[0].fullName).toBe("Erik Johansson");
    expect(contacts[0].title).toMatch(/ceo/i);
  });

  it("extracts phones via regex from company metadata", async () => {
    const { parseCompanyMetadata } = await import("@/lib/scraping/parse-html");
    const html = `
      <html><head>
        <meta name="description" content="Acme builds software for healthcare teams." />
        <title>Acme Health</title>
      </head><body>
        <p>Call us at +1 (555) 123-4567 or email hello@acme.com</p>
        <a href="https://linkedin.com/company/acme">LinkedIn</a>
      </body></html>`;

    const meta = parseCompanyMetadata(html, "acme.com");
    expect(meta.title).toBe("Acme Health");
    expect(meta.description).toContain("healthcare");
    expect(meta.emails.length).toBeGreaterThan(0);
    expect(meta.phones.length).toBeGreaterThan(0);
    expect(meta.socialLinks.linkedin).toContain("linkedin.com");
  });
});

describe("company and contact dedup relink", () => {
  const sampleCompany = {
    id: "apollo-1",
    name: "Acme SaaS",
    domain: "acme.com",
    industry: "Technology",
    description: null,
    employeeCount: 50,
    country: "United States",
    city: null,
    state: null,
    linkedinUrl: null,
    websiteUrl: "https://acme.com",
    technologies: null,
    confidenceScore: 80,
  };

  it("re-links known company duplicates to the current search", async () => {
    const { applyDedup } = await import("@/lib/company-discovery/apply-dedup");

    const result = applyDedup([sampleCompany], new Set(["acme.com"]));

    expect(result.companies).toHaveLength(1);
    expect(result.knownDuplicateCount).toBe(1);
    expect(result.duplicateCount).toBe(0);
  });

  it("drops known duplicates when relink is disabled", async () => {
    const { applyDedup } = await import("@/lib/company-discovery/apply-dedup");

    const result = applyDedup([sampleCompany], new Set(["acme.com"]), {
      relinkKnown: false,
    });

    expect(result.companies).toHaveLength(0);
    expect(result.knownDuplicateCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("re-links known contact duplicates to the current search", async () => {
    const { applyDedup } = await import("@/lib/contact-discovery/apply-dedup");

    const contact = {
      id: "scraping-acme-0",
      companyId: "company-uuid",
      companyName: "Acme SaaS",
      companyDomain: "acme.com",
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Doe",
      title: "CEO",
      department: null,
      email: null,
      emailIsGuessed: false,
      linkedinUrl: null,
      confidenceScore: 90,
    };

    const result = applyDedup(
      [contact],
      new Set(["company:company-uuid|name:jane doe"])
    );

    expect(result.contacts).toHaveLength(1);
    expect(result.knownDuplicateCount).toBe(1);
    expect(result.duplicateCount).toBe(0);
  });
});

describe("user-friendly messages", () => {
  it("maps error codes to plain language", async () => {
    const {
      getUserFriendlyError,
      getNoCompaniesMessage,
      getNoContactsMessage,
      getApiErrorMessage,
    } = await import("@/lib/ui/user-messages");

    expect(
      getUserFriendlyError({ code: "NETWORK_ERROR", message: "raw" })
    ).toContain("connect");

    expect(getNoCompaniesMessage({ filteredCount: 3, seedCount: 5, enrichedCount: 3 })).toContain(
      "No companies matched your country and industry filters"
    );

    expect(
      getNoCompaniesMessage({ seedCount: 8, enrichedCount: 8, filteredCount: 0 })
    ).toContain("No companies matched your search");

    expect(getApiErrorMessage({ code: "AUTH_ERROR", message: "Authentication required." })).toContain(
      "sign in"
    );

    expect(
      getNoContactsMessage({
        companyCount: 3,
        parsedCount: 0,
        scrapedCount: 0,
        searxngConfigured: true,
      })
    ).toContain("No people found on the company website");

    expect(
      getNoContactsMessage({
        companyCount: 2,
        parsedCount: 5,
        scrapedCount: 0,
        filteredCount: 5,
        jobTitles: ["CEO"],
      })
    ).toContain("none matched your roles");

    expect(
      getNoContactsMessage({
        companyCount: 1,
        parsedCount: 0,
        scrapedCount: 0,
        searxngConfigured: true,
      })
    ).toContain("No people found on the company website");

    expect(
      getNoContactsMessage({
        companyCount: 1,
        parsedCount: 0,
        scrapedCount: 0,
        searxngConfigured: false,
      })
    ).toContain("SearXNG is not configured");
  });
});

describe("intent to buy signals", () => {
  it("detects hiring, funding, and buying language", async () => {
    const { detectIntentSignals } = await import("@/lib/lead-enrichment/intent-signals");

    const funded = detectIntentSignals(
      "Acme raised a Series B funding round and is expanding into Europe."
    );
    expect(funded.signals.some((signal) => signal.id === "funding")).toBe(true);
    expect(funded.score).toBeGreaterThan(0);

    const hiring = detectIntentSignals("We are hiring engineers — join our growing team.");
    expect(hiring.signals.some((signal) => signal.id === "hiring")).toBe(true);

    const buying = detectIntentSignals(
      "Currently evaluating vendors and in the market for a new CRM platform."
    );
    expect(buying.signals.some((signal) => signal.id === "buying_language")).toBe(true);
  });
});

describe("company affiliation", () => {
  it("accepts current employees and rejects former or unrelated profiles", async () => {
    const {
      verifyPersonCompanyAffiliation,
      companyNamesMatch,
      textIndicatesFormerRoleAtTarget,
    } = await import("@/lib/scraping/company-affiliation");

    const target = { name: "Aria Systems", domain: "ariasystems.com" };

    expect(companyNamesMatch("Aria Systems Inc.", "Aria Systems")).toBe(true);

    expect(
      verifyPersonCompanyAffiliation(
        {
          title: "Team Member",
          bioText: "Anna Svensson",
          source: "website_team",
          onCompanyWebsite: true,
          leadershipPage: true,
        },
        target
      ).matches
    ).toBe(true);

    expect(
      verifyPersonCompanyAffiliation(
        {
          title: "Chief Executive Officer",
          bioText: "Tom Dibble leads the Aria Systems team",
          source: "website_team",
        },
        target
      ).matches
    ).toBe(true);

    expect(
      verifyPersonCompanyAffiliation(
        {
          title: "Former CEO at Aria Systems",
          bioText: "Now advisor",
          source: "website_team",
        },
        target
      ).matches
    ).toBe(false);

    expect(
      verifyPersonCompanyAffiliation(
        {
          title: "CEO",
          bioText: "Jane Doe - CEO - Aria Systems | LinkedIn",
          source: "linkedin_search",
        },
        target
      ).matches
    ).toBe(true);

    expect(
      verifyPersonCompanyAffiliation(
        {
          title: "CEO",
          bioText: "Jane Doe - CEO - Other Corp | LinkedIn",
          source: "linkedin_search",
        },
        target
      ).matches
    ).toBe(false);

    expect(
      verifyPersonCompanyAffiliation(
        {
          title: "Group Chief Executive Officer",
          bioText:
            "Dino Varkey - Group Chief Executive Officer, GEMS Education · GEMS Education | LinkedIn",
          source: "linkedin_search",
        },
        { name: "EduTech Global", domain: "edutechglobal.com" }
      ).matches
    ).toBe(false);

    expect(
      verifyPersonCompanyAffiliation(
        {
          title: "Chief Human Resource Officer",
          bioText: "Paras Kaushik",
          source: "website_team",
          onCompanyWebsite: true,
          leadershipPage: true,
        },
        { name: "HT Media", domain: "htmedia.in" }
      ).matches
    ).toBe(true);

    expect(
      verifyPersonCompanyAffiliation(
        {
          title: "Chief Product & Marketing Officer, Bandhan Life",
          bioText: "Guest speaker",
          source: "website_team",
          onCompanyWebsite: true,
          leadershipPage: true,
        },
        { name: "HT Media", domain: "htmedia.in" }
      ).matches
    ).toBe(false);
  });
});

describe("leadership web search", () => {
  it("parses LinkedIn search result titles", async () => {
    const { parseLinkedInSearchHit } = await import("@/lib/scraping/leadership-search");

    expect(
      parseLinkedInSearchHit("Jane Doe - CEO - Acme Corp | LinkedIn", "CEO at Acme")
    ).toEqual({
      fullName: "Jane Doe",
      jobTitle: "CEO",
    });

    expect(parseLinkedInSearchHit("LinkedIn", "")).toBeNull();
  });
});

describe("linkedin profile scraper", () => {
  it("parses public profile titles and HTML metadata", async () => {
    const {
      parseLinkedInProfileTitle,
      parseLinkedInProfileFromHtml,
    } = await import("@/lib/scraping/linkedin-profile-scraper");

    expect(
      parseLinkedInProfileTitle("Jane Doe - VP Engineering - Acme Health | LinkedIn")
    ).toEqual({
      fullName: "Jane Doe",
      jobTitle: "VP Engineering",
      affiliationText: "Jane Doe - VP Engineering - Acme Health",
    });

    const html = `<html><head>
      <meta property="og:title" content="Dan Torrens - Chief Executive Officer - eHealth Technologies | LinkedIn" />
      <meta property="og:description" content="CEO at eHealth Technologies" />
    </head></html>`;

    expect(parseLinkedInProfileFromHtml(html)).toMatchObject({
      fullName: "Dan Torrens",
      jobTitle: "Chief Executive Officer",
    });
  });
});

describe("press release leadership parser", () => {
  it("extracts executives from awards and press release HTML", async () => {
    const { parseLeadershipFromPressHtml } = await import(
      "@/lib/scraping/press-release-leaders"
    );

    const html = `
      <p><b>Rebecca Brennan, Sales Director</b>: Rebecca leads sales at Carahsoft.</p>
      <p><b>Brian O&rsquo;Donnell, Vice President</b>: Brian has been pivotal in Carahsoft growth.</p>
      <p>&ldquo;We are proud,&rdquo; said Craig P. Abod, Carahsoft President.</p>
    `;

    const contacts = parseLeadershipFromPressHtml(html, "https://carahsoft.com/awards/test");
    const names = contacts.map((contact) => contact.fullName);

    expect(names).toContain("Rebecca Brennan");
    expect(names).toContain("Brian O'Donnell");
    expect(names).toContain("Craig P. Abod");
  });
});

describe("industry classifier", () => {
  it("matches hospitality companies and rejects banks", async () => {
    const { companyMatchesIndustry } = await import("@/lib/scraping/industry-classifier");

    expect(
      companyMatchesIndustry(
        {
          name: "Marriott International",
          description: "Global hotel and resort hospitality company",
          industry: "Hospitality",
        },
        "Hospitality"
      ).matches
    ).toBe(true);

    expect(
      companyMatchesIndustry(
        {
          name: "Chase Bank",
          description: "Leading financial services and banking institution",
          industry: "Banking",
        },
        "Hospitality"
      ).matches
    ).toBe(false);

    expect(
      companyMatchesIndustry(
        {
          name: "Shell Oil",
          description: "Oil and gas petroleum energy company",
          industry: "Energy",
        },
        "Hospitality"
      ).conflictingIndustry
    ).toBe(true);
  });

  it("rejects media companies for Technology searches", async () => {
    const { companyMatchesIndustry } = await import("@/lib/scraping/industry-classifier");

    expect(
      companyMatchesIndustry(
        {
          name: "Fortune",
          domain: "fortune.com",
          description: "Business magazine and media publisher covering Fortune 500",
          industry: null,
        },
        "Technology"
      ).matches
    ).toBe(false);
  });

  it("accepts software companies for Technology searches", async () => {
    const { companyMatchesIndustry } = await import("@/lib/scraping/industry-classifier");

    expect(
      companyMatchesIndustry(
        {
          name: "Datadog",
          domain: "datadoghq.com",
          description: "Cloud software platform for monitoring and security",
          industry: "Technology",
        },
        "Technology"
      ).matches
    ).toBe(true);
  });
});

describe("healthcare company matching", () => {
  it("accepts healthtech software companies for healthcare searches", async () => {
    const { companyMatchesIndustry } = await import("@/lib/scraping/industry-classifier");
    const { validateCompanyForDiscovery } = await import(
      "@/lib/company-discovery/validate-company"
    );
    const { matchesSearchKeywords } = await import("@/lib/scraping/company-relevance");

    const company = {
      name: "PatientFlow",
      domain: "patientflow.io",
      industry: "Technology",
      description: "Digital health platform for hospital patient engagement.",
      websiteUrl: "https://patientflow.io",
    };

    expect(companyMatchesIndustry(company, "Healthcare").matches).toBe(true);
    expect(matchesSearchKeywords(company, ["healthtech", "healthcare"])).toBe(true);

    const validation = validateCompanyForDiscovery(
      {
        id: "1",
        ...company,
        employeeCount: null,
        country: "United States",
        city: null,
        state: null,
        linkedinUrl: null,
        technologies: null,
        confidenceScore: 60,
      },
      {
        industry: "Healthcare",
        country: "United States",
        companySizeMin: 1,
        companySizeMax: 5000,
        keywords: ["healthtech", "healthcare"],
      }
    );
    expect(validation.accepted).toBe(true);
  });
});

describe("company relevance filter", () => {
  it("rejects media, historical names, and weak SaaS matches", async () => {
    const { assessCompanyRelevance } = await import("@/lib/scraping/company-relevance");

    expect(
      assessCompanyRelevance(
        {
          id: "1",
          name: "Fortune",
          domain: "fortune.com",
          industry: null,
          description: "Business media and magazine publisher",
          employeeCount: null,
          country: "United States",
          city: null,
          state: null,
          linkedinUrl: null,
          websiteUrl: "https://fortune.com",
          technologies: null,
          confidenceScore: 50,
        },
        { industry: "Technology", keywords: ["saas"] }
      ).relevant
    ).toBe(false);

    expect(
      assessCompanyRelevance(
        {
          id: "2",
          name: "Thomas Edison",
          domain: "example.com",
          industry: null,
          description: null,
          employeeCount: null,
          country: null,
          city: null,
          state: null,
          linkedinUrl: null,
          websiteUrl: null,
          technologies: null,
          confidenceScore: 0,
        },
        { industry: "Technology", keywords: [] }
      ).relevant
    ).toBe(false);

    expect(
      assessCompanyRelevance(
        {
          id: "3",
          name: "Acme Cloud",
          domain: "acmecloud.io",
          industry: "Technology",
          description: "B2B SaaS software platform for sales teams",
          employeeCount: 120,
          country: "United States",
          city: null,
          state: null,
          linkedinUrl: null,
          websiteUrl: "https://acmecloud.io",
          technologies: ["React"],
          confidenceScore: 80,
        },
        { industry: "Technology", keywords: ["saas"] }
      ).relevant
    ).toBe(true);
  });

  it("allows generic keywords like saas without requiring homepage text match", async () => {
    const { assessCompanyRelevance } = await import("@/lib/scraping/company-relevance");

    expect(
      assessCompanyRelevance(
        {
          id: "4",
          name: "Linear",
          domain: "linear.app",
          industry: "Technology",
          description: "B2B SaaS software platform for product teams",
          employeeCount: 80,
          country: "United States",
          city: null,
          state: null,
          linkedinUrl: null,
          websiteUrl: "https://linear.app",
          technologies: null,
          confidenceScore: 70,
        },
        { industry: "Technology", keywords: ["saas", "software"] }
      ).relevant
    ).toBe(true);
  });

  it("rejects semiconductor companies for SaaS searches", async () => {
    const { assessCompanyRelevance } = await import("@/lib/scraping/company-relevance");

    expect(
      assessCompanyRelevance(
        {
          id: "5",
          name: "ChipWorks",
          domain: "chipworks.com",
          industry: "Technology",
          description: "Semiconductor chip maker and hardware foundry",
          employeeCount: 5000,
          country: "United States",
          city: null,
          state: null,
          linkedinUrl: null,
          websiteUrl: "https://chipworks.com",
          technologies: null,
          confidenceScore: 40,
        },
        { industry: "Technology", keywords: ["saas"] }
      ).relevant
    ).toBe(false);
  });

  it("accepts media companies for Media & Entertainment searches", async () => {
    const { assessCompanyRelevance } = await import("@/lib/scraping/company-relevance");
    const { companyMatchesIndustry } = await import("@/lib/scraping/industry-classifier");
    const { validateCompanyForDiscovery } = await import(
      "@/lib/company-discovery/validate-company"
    );

    const firstpost = {
      id: "fp",
      name: "Firstpost",
      domain: "firstpost.com",
      industry: "Media",
      description: "Indian news and media publisher covering politics and entertainment",
      employeeCount: 150,
      country: "India",
      city: "Mumbai",
      state: null,
      linkedinUrl: null,
      websiteUrl: "https://firstpost.com",
      technologies: null,
      confidenceScore: 70,
    };

    expect(
      assessCompanyRelevance(firstpost, {
        industry: "Media & Entertainment",
        keywords: ["media", "entertainment"],
      }).relevant
    ).toBe(true);

    expect(
      companyMatchesIndustry(
        {
          name: firstpost.name,
          domain: firstpost.domain,
          industry: firstpost.industry,
          description: firstpost.description,
          websiteUrl: firstpost.websiteUrl,
        },
        "Media & Entertainment"
      ).matches
    ).toBe(true);

    expect(
      validateCompanyForDiscovery(firstpost, {
        industry: "Media & Entertainment",
        country: "India",
        companySizeMin: 1,
        companySizeMax: 200,
        technologies: [],
        keywords: ["media"],
      }).accepted
    ).toBe(true);
  });
});

describe("finalize enriched leads", () => {
  it("keeps LinkedIn-only leads and discards contacts with neither channel", async () => {
    const { partitionEnrichedLeads } = await import("@/lib/lead-enrichment/finalize-lead");

    const base = {
      name: "Jane Doe",
      role: "CTO",
      company: "Acme",
      city: null,
      state: null,
      country: "US",
      location: "US",
      emailIsGuessed: false,
      emailSyntaxValid: null,
      emailDomainValid: null,
      emailVerificationStatus: null,
      emailVerifiedAt: null,
      leadScore: null,
      leadScoreFactors: null,
      leadScoredAt: null,
      companyId: "c1",
      searchId: "s1",
      enrichedAt: new Date().toISOString(),
      confidenceScore: 50,
      linkedInSource: "public_profile" as const,
      contactDetailType: null,
      contactPageUrl: null,
      intentScore: null,
      intentSignals: null,
      followUpsPaused: false,
      followUpsPausedReason: null,
      outreachChannel: null,
    };

    const { kept, discardedIds } = partitionEnrichedLeads([
      {
        ...base,
        id: "1",
        email: "jane@acme.com",
        emailSource: "found",
        linkedin: null,
      },
      {
        ...base,
        id: "2",
        email: null,
        emailSource: null,
        linkedin: "https://linkedin.com/in/jane-doe",
      },
      {
        ...base,
        id: "3",
        email: null,
        emailSource: null,
        linkedin: null,
      },
    ]);

    expect(kept).toHaveLength(2);
    expect(discardedIds).toEqual(["3"]);
    expect(kept.find((l) => l.id === "1")?.outreachChannel).toBe("email");
    expect(kept.find((l) => l.id === "2")?.outreachChannel).toBe("linkedin");
  });

  it("keeps contact-page-only leads when no email or LinkedIn", async () => {
    const { partitionEnrichedLeads } = await import("@/lib/lead-enrichment/finalize-lead");

    const { kept } = partitionEnrichedLeads([
      {
        id: "4",
        name: "John Smith",
        role: "CEO",
        company: "Acme",
        linkedin: null,
        city: null,
        state: null,
        country: "US",
        location: "US",
        email: null,
        emailIsGuessed: false,
        emailSource: null,
        linkedInSource: null,
        contactDetailType: "contact_page_only",
        contactPageUrl: "https://acme.com/contact",
        outreachChannel: null,
        emailSyntaxValid: null,
        emailDomainValid: null,
        emailVerificationStatus: null,
        emailVerifiedAt: null,
        leadScore: null,
        leadScoreFactors: null,
        leadScoredAt: null,
        intentScore: null,
        intentSignals: null,
        companyId: "c1",
        searchId: "s1",
        enrichedAt: new Date().toISOString(),
        confidenceScore: 40,
        followUpsPaused: false,
        followUpsPausedReason: null,
      },
    ]);

    expect(kept).toHaveLength(1);
    expect(kept[0]?.contactPageUrl).toBe("https://acme.com/contact");
  });

  it("does not assign shared company inboxes as personal email", async () => {
    const { partitionEnrichedLeads } = await import("@/lib/lead-enrichment/finalize-lead");

    const base = {
      name: "Jane Doe",
      role: "CTO",
      company: "Acme",
      city: null,
      state: null,
      country: "US",
      location: "US",
      emailIsGuessed: false,
      emailSyntaxValid: null,
      emailDomainValid: null,
      emailVerificationStatus: null,
      emailVerifiedAt: null,
      leadScore: null,
      leadScoreFactors: null,
      leadScoredAt: null,
      companyId: "c1",
      searchId: "s1",
      enrichedAt: new Date().toISOString(),
      confidenceScore: 50,
      linkedInSource: "public_profile" as const,
      contactPageUrl: "https://acme.com/contact",
      intentScore: null,
      intentSignals: null,
      followUpsPaused: false,
      followUpsPausedReason: null,
      outreachChannel: null,
    };

    const { kept } = partitionEnrichedLeads([
      {
        ...base,
        id: "1",
        email: "info@acme.com",
        emailSource: "found",
        contactDetailType: "public_email",
        linkedin: "https://linkedin.com/in/jane-doe",
      },
      {
        ...base,
        id: "2",
        name: "John Smith",
        email: "info@acme.com",
        emailSource: "found",
        contactDetailType: "public_email",
        linkedin: "https://linkedin.com/in/john-smith",
      },
    ]);

    expect(kept).toHaveLength(2);
    expect(kept.every((lead) => lead.email === null)).toBe(true);
    expect(kept.every((lead) => lead.outreachChannel === "linkedin")).toBe(true);
    expect(kept.every((lead) => lead.contactDetailType === "linkedin_only")).toBe(true);
  });

  it("dedupes the same personal email within one company", async () => {
    const { partitionEnrichedLeads } = await import("@/lib/lead-enrichment/finalize-lead");

    const base = {
      role: "Director",
      company: "Acme",
      city: null,
      state: null,
      country: "US",
      location: "US",
      emailIsGuessed: false,
      emailSyntaxValid: null,
      emailDomainValid: null,
      emailVerificationStatus: null,
      emailVerifiedAt: null,
      leadScore: null,
      leadScoreFactors: null,
      leadScoredAt: null,
      companyId: "c1",
      searchId: "s1",
      enrichedAt: new Date().toISOString(),
      confidenceScore: 50,
      linkedInSource: null,
      contactDetailType: null,
      contactPageUrl: null,
      intentScore: null,
      intentSignals: null,
      followUpsPaused: false,
      followUpsPausedReason: null,
      outreachChannel: null,
    };

    const { kept } = partitionEnrichedLeads([
      {
        ...base,
        id: "1",
        name: "Jane Doe",
        email: "jane@acme.com",
        emailSource: "found",
        linkedin: null,
      },
      {
        ...base,
        id: "2",
        name: "Jane Doe",
        email: "jane@acme.com",
        emailSource: "found",
        linkedin: "https://linkedin.com/in/jane-doe",
      },
    ]);

    const withEmail = kept.filter((lead) => lead.email);
    expect(withEmail).toHaveLength(1);
    expect(withEmail[0]?.id).toBe("1");
    expect(kept.find((lead) => lead.id === "2")?.email).toBeNull();
    expect(kept.find((lead) => lead.id === "2")?.outreachChannel).toBe("linkedin");
  });
});

describe("apply criteria strict mode", () => {
  it("returns empty when no company strictly matches", async () => {
    const { applyCriteria } = await import("@/lib/company-discovery/apply-criteria");

    const result = applyCriteria(
      [
        {
          id: "1",
          name: "Fortune",
          domain: "fortune.com",
          industry: null,
          description: "Business magazine publisher",
          employeeCount: null,
          country: "United States",
          city: null,
          state: null,
          linkedinUrl: null,
          websiteUrl: "https://fortune.com",
          technologies: null,
          confidenceScore: 40,
        },
      ],
      {
        industry: "Technology",
        country: "United States",
        companySizeMin: null,
        companySizeMax: null,
        technologies: [],
        keywords: ["saas"],
      }
    );

    expect(result.companies).toHaveLength(0);
  });

  it("keeps strictly matching SaaS companies", async () => {
    const { applyCriteria } = await import("@/lib/company-discovery/apply-criteria");

    const result = applyCriteria(
      [
        {
          id: "1",
          name: "CloudApp",
          domain: "cloudapp.io",
          industry: "Technology",
          description: "B2B SaaS software platform for teams",
          employeeCount: 80,
          country: "United States",
          city: null,
          state: null,
          linkedinUrl: null,
          websiteUrl: "https://cloudapp.io",
          technologies: null,
          confidenceScore: 70,
        },
      ],
      {
        industry: "Technology",
        country: "United States",
        companySizeMin: null,
        companySizeMax: null,
        technologies: [],
        keywords: ["saas"],
      }
    );

    expect(result.companies).toHaveLength(1);
    expect(result.companies[0]?.domain).toBe("cloudapp.io");
  });
});

describe("contact title filter", () => {
  it("matches roles selected in the search", async () => {
    const { matchesJobTitle, applyTitleFilter, isLeadershipTitle } = await import(
      "@/lib/contact-discovery/apply-title-filter"
    );

    expect(matchesJobTitle("Team Member", ["CEO", "Founder"])).toBe(false);
    expect(matchesJobTitle("Chief Executive Officer", ["CEO"])).toBe(true);
    expect(matchesJobTitle("Chief Technology Officer", ["CTO"])).toBe(true);
    expect(matchesJobTitle("Co-Founder", ["Founder"])).toBe(true);
    expect(matchesJobTitle("Co-Founder & CTO", ["CTO", "Founder"])).toBe(true);
    expect(matchesJobTitle("President & CEO", ["CEO"])).toBe(true);
    expect(matchesJobTitle("Managing Director", ["Director"])).toBe(true);
    expect(matchesJobTitle("General Manager", ["Manager"])).toBe(true);
    expect(matchesJobTitle("Workshop Manager", ["Manager"])).toBe(false);
    expect(matchesJobTitle("Office Manager", ["Manager"])).toBe(false);
    expect(matchesJobTitle("Business Owner", ["Owner"])).toBe(true);
    expect(matchesJobTitle("Marketing Director", ["Director"])).toBe(true);
    expect(matchesJobTitle("Software Engineer", ["CEO"])).toBe(false);
    expect(matchesJobTitle("Marketing Director", ["CEO"])).toBe(false);
    expect(matchesJobTitle("Board Member", ["CEO"])).toBe(false);
    expect(matchesJobTitle("Executive Director", ["CEO"])).toBe(false);
    expect(matchesJobTitle("Advisory Board Member", ["Founder"])).toBe(false);
    expect(isLeadershipTitle("Co-Founder & CTO")).toBe(true);
    expect(isLeadershipTitle("Software Engineer")).toBe(false);

    const { contacts, filteredCount } = applyTitleFilter(
      [
        {
          id: "1",
          companyId: "c1",
          companyName: "Acme",
          companyDomain: "acme.com",
          firstName: "Jane",
          lastName: "Doe",
          fullName: "Jane Doe",
          title: "Chief Executive Officer",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
        {
          id: "2",
          companyId: "c1",
          companyName: "Acme",
          companyDomain: "acme.com",
          firstName: "Bob",
          lastName: "Smith",
          fullName: "Bob Smith",
          title: "Intern",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
      ],
      ["CEO"]
    );

    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.fullName).toBe("Jane Doe");
    expect(filteredCount).toBe(1);

    const fallback = applyTitleFilter(
      [
        {
          id: "5",
          companyId: "c1",
          companyName: "Acme",
          companyDomain: "acme.com",
          firstName: "Jane",
          lastName: "Doe",
          fullName: "Jane Doe",
          title: "Chief Executive Officer",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
        {
          id: "6",
          companyId: "c1",
          companyName: "Acme",
          companyDomain: "acme.com",
          firstName: "Sam",
          lastName: "Lee",
          fullName: "Sam Lee",
          title: "Software Engineer",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
      ],
      ["CTO"]
    );
    expect(fallback.contacts).toHaveLength(1);
    expect(fallback.contacts[0]?.fullName).toBe("Jane Doe");
    expect(fallback.relaxedMatch).toBe(true);

    const vpEngRelated = applyTitleFilter(
      [
        {
          id: "7",
          companyId: "c1",
          companyName: "HealthCo",
          companyDomain: "healthco.com",
          firstName: "Alex",
          lastName: "Kim",
          fullName: "Alex Kim",
          title: "Chief Technology Officer",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
        {
          id: "8",
          companyId: "c1",
          companyName: "HealthCo",
          companyDomain: "healthco.com",
          firstName: "Pat",
          lastName: "Nurse",
          fullName: "Pat Nurse",
          title: "Registered Nurse",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
      ],
      ["VP Engineering"]
    );
    expect(vpEngRelated.contacts).toHaveLength(1);
    expect(vpEngRelated.contacts[0]?.title).toBe("Chief Technology Officer");
    expect(vpEngRelated.relaxedMatch).toBe(true);

    const vpEngExact = applyTitleFilter(
      [
        {
          id: "9",
          companyId: "c1",
          companyName: "HealthCo",
          companyDomain: "healthco.com",
          firstName: "Riley",
          lastName: "Park",
          fullName: "Riley Park",
          title: "Vice President of Technology",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
      ],
      ["VP Engineering"]
    );
    expect(vpEngExact.contacts).toHaveLength(1);
    expect(vpEngExact.relaxedMatch).toBe(false);

    const vpEngMixed = applyTitleFilter(
      [
        {
          id: "10",
          companyId: "c1",
          companyName: "HealthCo",
          companyDomain: "healthco.com",
          firstName: "Riley",
          lastName: "Park",
          fullName: "Riley Park",
          title: "Vice President of Technology",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
        {
          id: "11",
          companyId: "c1",
          companyName: "HealthCo",
          companyDomain: "healthco.com",
          firstName: "Chris",
          lastName: "Lee",
          fullName: "Chris Lee",
          title: "Chief Executive Officer",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
        {
          id: "12",
          companyId: "c1",
          companyName: "HealthCo",
          companyDomain: "healthco.com",
          firstName: "Sam",
          lastName: "Dev",
          fullName: "Sam Dev",
          title: "Chief Technology Officer",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
      ],
      ["VP Engineering"]
    );
    expect(vpEngMixed.contacts).toHaveLength(3);
    expect(vpEngMixed.relaxedMatch).toBe(true);

    const inferredFromAboutPage = applyTitleFilter(
      [
        {
          id: "13",
          companyId: "c1",
          companyName: "eHealth",
          companyDomain: "ehealthtechnologies.com",
          firstName: "Dan",
          lastName: "Torrens",
          fullName: "Dan Torrens",
          title: "Team Member",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
          sourceUrl: "https://ehealthtechnologies.com/about",
          titleContext: "Dan Torrens Chief Executive Officer View Bio",
        },
        {
          id: "14",
          companyId: "c1",
          companyName: "eHealth",
          companyDomain: "ehealthtechnologies.com",
          firstName: "Sean",
          lastName: "Ways",
          fullName: "Sean Ways",
          title: "Team Member",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
          sourceUrl: "https://ehealthtechnologies.com/about",
          titleContext: "Sean Ways Vice President of Engineering View Bio",
        },
      ],
      ["VP Engineering"]
    );
    expect(inferredFromAboutPage.contacts.length).toBeGreaterThanOrEqual(2);
    expect(inferredFromAboutPage.contacts.some((c) => c.fullName === "Sean Ways")).toBe(true);
    expect(inferredFromAboutPage.contacts.some((c) => c.fullName === "Dan Torrens")).toBe(true);

    const junk = applyTitleFilter(
      [
        {
          id: "4",
          companyId: "c1",
          companyName: "Acme",
          companyDomain: "acme.com",
          firstName: "Our",
          lastName: "Mission",
          fullName: "Our Mission",
          title: "Marketing Director",
          department: null,
          email: null,
          emailIsGuessed: false,
          linkedinUrl: null,
          confidenceScore: 0,
        },
      ],
      ["CEO"]
    );
    expect(junk.contacts).toHaveLength(0);

    expect(() =>
      applyTitleFilter(
        [
          {
            id: "3",
            companyId: "c1",
            companyName: "Acme",
            companyDomain: "acme.com",
            firstName: "Bad",
            lastName: null,
            fullName: "Bad Row",
            title: undefined as unknown as string,
            department: null,
            email: null,
            emailIsGuessed: false,
            linkedinUrl: null,
            confidenceScore: 0,
          },
        ],
        ["CEO"]
      )
    ).not.toThrow();
  });
});

describe("linkedin data quality", () => {
  it("keeps only personal /in/ profile URLs for contacts", async () => {
    const {
      isValidPersonLinkedInUrl,
      sanitizePersonLinkedInUrl,
      linkedinProfileMatchesPerson,
      sanitizePersonLinkedInForContact,
    } = await import("@/lib/scraping/data-quality");

    expect(
      isValidPersonLinkedInUrl("https://www.linkedin.com/in/steve-hasker")
    ).toBe(true);
    expect(
      isValidPersonLinkedInUrl("https://www.linkedin.com/company/appen")
    ).toBe(false);
    expect(sanitizePersonLinkedInUrl("https://linkedin.com/company/appen")).toBe(
      null
    );
    expect(
      linkedinProfileMatchesPerson(
        "https://www.linkedin.com/in/steve-hasker",
        "Steve Hasker"
      )
    ).toBe(true);
    expect(
      sanitizePersonLinkedInForContact(
        "https://www.linkedin.com/in/appen",
        "Jane Doe",
        "Appen"
      )
    ).toBe(null);
  });

  it("rejects company LinkedIn URLs that do not match the business", async () => {
    const { sanitizeCompanyLinkedInForCompany } = await import(
      "@/lib/scraping/data-quality"
    );

    expect(
      sanitizeCompanyLinkedInForCompany(
        "https://www.linkedin.com/company/acme-corp",
        "Acme Corp",
        "acme.com"
      )
    ).toBe("https://www.linkedin.com/company/acme-corp");
    expect(
      sanitizeCompanyLinkedInForCompany(
        "https://www.linkedin.com/company/random-partner",
        "Acme Corp",
        "acme.com"
      )
    ).toBe(null);
  });

  it("rejects junk parsed as person names", async () => {
    const { isPlausiblePersonName } = await import("@/lib/scraping/data-quality");

    expect(isPlausiblePersonName("Jane Doe")).toBe(true);
    expect(isPlausiblePersonName("Professor Dr. Rizwan Uppal")).toBe(true);
    expect(isPlausiblePersonName("Mr. Bilal Aslam Qureshi")).toBe(true);
    expect(isPlausiblePersonName("Our Mission")).toBe(false);
    expect(isPlausiblePersonName("Contact Us")).toBe(false);
    expect(isPlausiblePersonName("Partner Enquiry")).toBe(false);
    expect(isPlausiblePersonName("Your Product Modernization Partner")).toBe(false);
    expect(isPlausiblePersonName("Our Trusted Technology Partner")).toBe(false);
  });

  it("parses IDC-style key management cards (h3 + span.qualification)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { parseContactsFromHtml, isLeadershipDirectoryUrl } = await import(
      "@/lib/scraping/parse-html"
    );
    const { verifyPersonCompanyAffiliation } = await import(
      "@/lib/scraping/company-affiliation"
    );

    const html = readFileSync(
      join(process.cwd(), "src/lib/__tests__/idc-parse.fixture.html"),
      "utf8"
    );
    const url = "https://idc.net.pk/department/key-management/";
    const contacts = parseContactsFromHtml(html, "idc.net.pk", url);

    expect(contacts.length).toBeGreaterThanOrEqual(2);
    expect(contacts.some((c) => /rizwan/i.test(c.fullName) && /ceo|chairman/i.test(c.title))).toBe(
      true
    );

    const rizwan = contacts.find((c) => /rizwan/i.test(c.fullName));
    expect(rizwan).toBeDefined();
    expect(
      verifyPersonCompanyAffiliation(
        {
          title: rizwan!.title,
          bioText: rizwan!.affiliationText,
          source: "website_team",
          onCompanyWebsite: true,
          leadershipPage: isLeadershipDirectoryUrl(url),
        },
        { name: "Islamabad Diagnostic Centre (Pvt) Ltd.", domain: "idc.net.pk" }
      ).matches
    ).toBe(true);

    expect(isLeadershipDirectoryUrl(url)).toBe(true);
  });
});

describe("global company directory seeds", () => {
  it("maps country names to ISO and Wikidata jurisdiction codes", async () => {
    const { countryToIsoCode, countryToWikidataId } = await import(
      "@/lib/search/jurisdiction-codes"
    );

    expect(countryToIsoCode("Pakistan")).toBe("pk");
    expect(countryToIsoCode("United Kingdom")).toBe("gb");
    expect(countryToWikidataId("Pakistan")).toBe("Q843");
    expect(countryToWikidataId("United States")).toBe("Q30");
  });

  it("prefers directory seeds over web search for the same domain", async () => {
    const { mergeCompanySeeds } = await import("@/lib/scraping/merge-company-seeds");

    const merged = mergeCompanySeeds(
      [
        {
          title: "Acme Software (Pvt) Ltd",
          url: "https://acme.com",
          snippet: "Official company registry (OpenCorporates). Registered in Pakistan.",
          domain: "acme.com",
          source: "opencorporates",
          country: "Pakistan",
          city: "Lahore",
        },
      ],
      [
        {
          title: "Random blog mention of Acme",
          url: "https://acme.com/blog",
          snippet: "A listicle mentioning acme",
          domain: "acme.com",
        },
        {
          title: "Beta Corp",
          url: "https://beta.io",
          snippet: "From web search",
          domain: "beta.io",
        },
      ],
      10
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]?.domain).toBe("acme.com");
    expect(merged[0]?.seedSource).toBe("directory");
    expect(merged[0]?.country).toBe("Pakistan");
    expect(merged[0]?.snippet).toContain("OpenCorporates");
    expect(merged[1]?.domain).toBe("beta.io");
  });

  it("excludes directory host domains from merged seeds", async () => {
    const { mergeCompanySeeds } = await import("@/lib/scraping/merge-company-seeds");

    const merged = mergeCompanySeeds(
      [
        {
          title: "Should not appear",
          url: "https://opencorporates.com/companies/pk/123",
          snippet: "Registry page only",
          domain: "opencorporates.com",
          source: "opencorporates",
          country: "Pakistan",
          city: null,
        },
      ],
      [],
      5
    );

    expect(merged).toHaveLength(0);
  });

  it("reports Overpass as configured when enabled", async () => {
    const { isOverpassConfigured } = await import("@/lib/scraping/overpass-search");

    const original = process.env.OVERPASS_DIRECTORY_ENABLED;
    process.env.OVERPASS_DIRECTORY_ENABLED = "true";
    expect(isOverpassConfigured()).toBe(true);
    process.env.OVERPASS_DIRECTORY_ENABLED = "false";
    expect(isOverpassConfigured()).toBe(false);
    if (original) process.env.OVERPASS_DIRECTORY_ENABLED = original;
    else delete process.env.OVERPASS_DIRECTORY_ENABLED;
  });
});

describe("pipeline stack", () => {
  it("defines Apollo/Clay-style tier order", async () => {
    const { getPipelineStackConfig } = await import("@/lib/scraping/pipeline-stack");

    const tiers = getPipelineStackConfig();
    expect(tiers.map((t) => t.tier)).toEqual(["search", "website", "profiles", "email"]);
    expect(tiers[0]?.priority).toBe(1);
    expect(tiers[0]?.label).toContain("Search");
  });
});

describe("AI page extraction", () => {
  it("parses leadership JSON from model output", async () => {
    const { parseAiPeopleJson, mapAiRowsToContacts } = await import(
      "@/lib/scraping/ai-page-extraction"
    );

    const rows = parseAiPeopleJson(
      'Here are the leaders:\n[{"fullName":"Jane Doe","title":"Chief Technology Officer","email":null}]'
    );
    expect(rows).toHaveLength(1);

    const contacts = mapAiRowsToContacts(rows, "https://acme.com/team", "acme.com");
    expect(contacts[0]?.fullName).toBe("Jane Doe");
    expect(contacts[0]?.title).toBe("Chief Technology Officer");
  });
});

describe("env validation", () => {
  it("ignores paid providers when DISABLE_PAID_APIS is enabled", async () => {
    const { validateServerEnv, resetEnvCacheForTests } = await import("@/lib/env");
    const { getConfiguredProviderName } = await import(
      "@/lib/company-discovery/factory"
    );
    const { getConfiguredEmailVerificationProviderName } = await import(
      "@/lib/email-verification/factory"
    );
    resetEnvCacheForTests();
    const original = { ...process.env };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.DISABLE_PAID_APIS = "true";
    process.env.COMPANY_DATA_PROVIDER = "apollo";
    process.env.APOLLO_API_KEY = "test-key";
    process.env.EMAIL_VERIFICATION_PROVIDER = "hunter";
    process.env.HUNTER_API_KEY = "test-key";

    expect(getConfiguredProviderName()).toBe("scraping");
    expect(getConfiguredEmailVerificationProviderName()).toBe("dns");

    const result = validateServerEnv();
    expect(result.valid).toBe(true);
    expect(
      result.warnings.some((w) => w.includes("apollo is ignored"))
    ).toBe(true);

    process.env = original;
    resetEnvCacheForTests();
  });
});

describe("scraping tool health circuit breaker", () => {
  it("disables a tool after repeated failures and re-enables after reset", async () => {
    const {
      isScrapingToolAvailable,
      recordScrapingToolFailure,
      recordScrapingToolSuccess,
      resetScrapingToolHealth,
    } = await import("@/lib/scraping/tool-health");

    resetScrapingToolHealth();
    expect(isScrapingToolAvailable("duckduckgo")).toBe(true);

    recordScrapingToolFailure("duckduckgo");
    recordScrapingToolFailure("duckduckgo");
    expect(isScrapingToolAvailable("duckduckgo")).toBe(true);

    recordScrapingToolFailure("duckduckgo");
    expect(isScrapingToolAvailable("duckduckgo")).toBe(false);

    recordScrapingToolSuccess("duckduckgo");
    expect(isScrapingToolAvailable("duckduckgo")).toBe(true);

    resetScrapingToolHealth();
  });

  it("disables a tool after repeated empty results", async () => {
    const {
      isScrapingToolAvailable,
      recordScrapingToolMiss,
      resetScrapingToolHealth,
    } = await import("@/lib/scraping/tool-health");

    resetScrapingToolHealth();
    for (let i = 0; i < 5; i++) {
      recordScrapingToolMiss("ai-extraction");
    }
    expect(isScrapingToolAvailable("ai-extraction")).toBe(false);
    resetScrapingToolHealth();
  });
});

describe("Apify integration", () => {
  it("formats actor ids for the Apify API", async () => {
    const { formatApifyActorId } = await import("@/lib/apify/config");
    expect(formatApifyActorId("compass/crawler-google-places")).toBe(
      "compass~crawler-google-places"
    );
    expect(formatApifyActorId("compass~crawler-google-places")).toBe(
      "compass~crawler-google-places"
    );
  });

  it("is disabled unless explicitly enabled and paid APIs are allowed", async () => {
    const { isApifyEnabled } = await import("@/lib/apify/config");
    const token = process.env.APIFY_API_TOKEN;
    const enabled = process.env.APIFY_ENABLED;
    const paid = process.env.DISABLE_PAID_APIS;

    process.env.APIFY_API_TOKEN = "test-token";
    process.env.APIFY_ENABLED = "true";
    process.env.DISABLE_PAID_APIS = "true";
    expect(isApifyEnabled()).toBe(false);

    process.env.DISABLE_PAID_APIS = "false";
    expect(isApifyEnabled()).toBe(true);

    process.env.APIFY_ENABLED = "false";
    expect(isApifyEnabled()).toBe(false);

    if (token === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = token;
    if (enabled === undefined) delete process.env.APIFY_ENABLED;
    else process.env.APIFY_ENABLED = enabled;
    if (paid === undefined) delete process.env.DISABLE_PAID_APIS;
    else process.env.DISABLE_PAID_APIS = paid;
  });

  it("maps Google Maps dataset rows to company seeds", async () => {
    const { mapApifyGoogleMapsPlaceToSeed } = await import(
      "@/lib/apify/google-maps-search"
    );

    const seed = mapApifyGoogleMapsPlaceToSeed(
      {
        title: "Acme Software",
        website: "https://acme.example",
        city: "Berlin",
        countryCode: "DE",
        categoryName: "Software company",
        phone: "+49 30 123456",
      },
      "Germany"
    );

    expect(seed?.domain).toBe("acme.example");
    expect(seed?.source).toBe("apify");
    expect(seed?.city).toBe("Berlin");
    expect(seed?.country).toBe("Germany");
    expect(seed?.industryHint).toBe("Software company");
  });
});

describe("rank merged seeds by search", () => {
  it("prioritizes seeds that match industry and keywords", async () => {
    const { rankMergedSeedsBySearch } = await import("@/lib/scraping/rank-search-seeds");

    const seeds = [
      {
        title: "Random Retail Shop",
        url: "https://shop.example",
        snippet: "local grocery store",
        domain: "shop.example",
        country: "Germany",
        city: "Berlin",
        seedSource: "web" as const,
      },
      {
        title: "Acme SaaS GmbH",
        url: "https://acme.example",
        snippet: "B2B SaaS software platform for enterprises",
        domain: "acme.example",
        country: "Germany",
        city: "Berlin",
        seedSource: "directory" as const,
        directorySource: "apify" as const,
        industryHint: "Software company",
        completenessScore: 80,
      },
    ];

    const ranked = rankMergedSeedsBySearch(seeds, {
      industry: "Technology",
      country: "Germany",
      keywords: ["saas", "software"],
      companySizeMin: null,
      companySizeMax: null,
      technologies: [],
    });

    expect(ranked[0]?.domain).toBe("acme.example");
  });
});

describe("google places search", () => {
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalEnabled = process.env.GOOGLE_MAPS_DIRECTORY_ENABLED;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
    if (originalMapsKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
    if (originalEnabled === undefined) delete process.env.GOOGLE_MAPS_DIRECTORY_ENABLED;
    else process.env.GOOGLE_MAPS_DIRECTORY_ENABLED = originalEnabled;
  });

  it("reports configured when GOOGLE_PLACES_API_KEY is set", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    const { isGooglePlacesConfigured } = await import(
      "@/lib/scraping/google-places-search"
    );
    expect(isGooglePlacesConfigured()).toBe(true);
  });

  it("accepts GOOGLE_MAPS_API_KEY alias", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    process.env.GOOGLE_MAPS_API_KEY = "maps-key";
    const { isGooglePlacesConfigured } = await import(
      "@/lib/scraping/google-places-search"
    );
    expect(isGooglePlacesConfigured()).toBe(true);
  });

  it("skips when GOOGLE_MAPS_DIRECTORY_ENABLED is false", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    process.env.GOOGLE_MAPS_DIRECTORY_ENABLED = "false";
    const { isGooglePlacesConfigured } = await import(
      "@/lib/scraping/google-places-search"
    );
    expect(isGooglePlacesConfigured()).toBe(false);
  });
});

describe("business directory sites", () => {
  it("detects profile URLs for supported directories", async () => {
    const {
      isBusinessDirectoryProfileUrl,
      matchBusinessDirectorySite,
    } = await import("@/lib/scraping/business-directory-sites");

    expect(
      isBusinessDirectoryProfileUrl("https://www.hotfrog.com/company/acme-software-london")
    ).toBe(true);
    expect(matchBusinessDirectorySite("https://www.manta.com/c/mt1234/acme-corp")?.id).toBe(
      "manta"
    );
    expect(
      matchBusinessDirectorySite("https://clutch.co/profile/acme-software")?.id
    ).toBe("clutch");
    expect(
      matchBusinessDirectorySite("https://www.goodfirms.co/profile/acme-software")?.id
    ).toBe("goodfirms");
    expect(
      matchBusinessDirectorySite("https://www.europages.co.uk/en/companies/acme-ltd.html")?.id
    ).toBe("europages");
    expect(
      isBusinessDirectoryProfileUrl("https://www.localchamber.org/members/acme-inc")
    ).toBe(true);
    expect(isBusinessDirectoryProfileUrl("https://www.hotfrog.com/search/london/software")).toBe(
      false
    );
  });

  it("parses JSON-LD organization data from directory pages", async () => {
    const { parseBusinessDirectoryProfile } = await import(
      "@/lib/scraping/business-directory-sites"
    );

    const html = `<!DOCTYPE html>
<html>
<head><title>Acme Software | Hotfrog</title></head>
<body>
<script type="application/ld+json">
{
  "@type": "Organization",
  "name": "Acme Software Ltd",
  "url": "https://acme.example.com",
  "telephone": "+44 20 7946 0958",
  "description": "B2B SaaS platform for workflow automation across enterprise teams.",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "1 High Street",
    "addressLocality": "London",
    "addressCountry": "United Kingdom"
  }
}
</script>
<a href="https://www.linkedin.com/company/acme-software">LinkedIn</a>
</body>
</html>`;

    const listing = parseBusinessDirectoryProfile(
      html,
      "https://www.hotfrog.com/company/acme-software-london",
      "hotfrog",
      "Acme Software"
    );

    expect(listing?.name).toBe("Acme Software Ltd");
    expect(listing?.website).toBe("https://acme.example.com");
    expect(listing?.domain).toBe("acme.example.com");
    expect(listing?.phone).toBe("+44 20 7946 0958");
    expect(listing?.city).toBe("London");
    expect(listing?.location).toContain("London");
    expect(listing?.socialLinks.linkedin).toContain("linkedin.com/company/acme-software");
    expect(listing?.completenessScore).toBeGreaterThan(70);
  });

  it("deduplicates by domain and ranks by completeness", async () => {
    const {
      dedupeBusinessDirectoryListings,
      rankListingsByCompleteness,
      scoreListingCompleteness,
    } = await import("@/lib/scraping/business-directory-sites");

    const sparse = {
      name: "Acme",
      website: "https://acme.example.com",
      phone: null,
      location: null,
      description: null,
      socialLinks: { linkedin: null, twitter: null, facebook: null, instagram: null },
      domain: "acme.example.com",
      profileUrl: "https://hotfrog.com/company/acme",
      source: "hotfrog" as const,
      city: null,
      country: null,
      completenessScore: scoreListingCompleteness({
        name: "Acme",
        website: "https://acme.example.com",
        phone: null,
        location: null,
        description: null,
        socialLinks: { linkedin: null, twitter: null, facebook: null, instagram: null },
      }),
    };

    const rich = {
      ...sparse,
      phone: "+1 555 0100",
      location: "Austin, TX",
      description: "Enterprise software consultancy with cloud migration services.",
      socialLinks: {
        linkedin: "https://linkedin.com/company/acme",
        twitter: null,
        facebook: null,
        instagram: null,
      },
      profileUrl: "https://clutch.co/profile/acme",
      source: "clutch" as const,
      completenessScore: scoreListingCompleteness({
        name: "Acme",
        website: "https://acme.example.com",
        phone: "+1 555 0100",
        location: "Austin, TX",
        description: "Enterprise software consultancy with cloud migration services.",
        socialLinks: {
          linkedin: "https://linkedin.com/company/acme",
          twitter: null,
          facebook: null,
          instagram: null,
        },
      }),
    };

    const deduped = dedupeBusinessDirectoryListings([sparse, rich]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.phone).toBe("+1 555 0100");

    const ranked = rankListingsByCompleteness([sparse, { ...rich, name: "Beta Corp", domain: "beta.example.com" }]);
    expect(ranked[0]?.completenessScore).toBeGreaterThanOrEqual(ranked[1]?.completenessScore ?? 0);
  });

  it("prefers regional Hotfrog domains for Pakistan and India", async () => {
    const {
      pickHotfrogDomainsForCountry,
      buildDirectorySearchQueries,
      BUSINESS_DIRECTORY_SITES,
    } = await import("@/lib/scraping/business-directory-sites");

    expect(pickHotfrogDomainsForCountry("Pakistan")).toEqual(["hotfrog.com", "hotfrog.in"]);
    expect(pickHotfrogDomainsForCountry("India")[0]).toBe("hotfrog.in");

    const hotfrog = BUSINESS_DIRECTORY_SITES.find((site) => site.id === "hotfrog");
    expect(hotfrog).toBeDefined();
    const queries = buildDirectorySearchQueries(hotfrog!, "Healthcare", "Pakistan", []);
    expect(queries.some((q) => q.includes("site:hotfrog.com"))).toBe(true);
    expect(queries.some((q) => q.includes("site:hotfrog.in"))).toBe(true);
  });
});

describe("country-local company search", () => {
  it("builds ccTLD and Pakistan directory queries", async () => {
    const { buildCountryLocalCompanyQueries, countryCcTld } = await import(
      "@/lib/scraping/country-local-search"
    );

    expect(countryCcTld("Pakistan")).toBe("pk");

    const queries = buildCountryLocalCompanyQueries({
      industry: "Healthcare",
      country: "Pakistan",
      keywords: ["SaaS"],
    });

    expect(queries.some((q) => q.includes("site:.pk"))).toBe(true);
    expect(queries.some((q) => q.includes("yellowpages.com.pk"))).toBe(true);
    expect(queries.some((q) => q.includes("hospital clinic"))).toBe(true);
  });
});

describe("search pipeline step gating", () => {
  it("unlocks each step only after the previous step has saved data", async () => {
    const { derivePipelineStepStates } = await import(
      "@/lib/search/pipeline-steps"
    );

    const empty = derivePipelineStepStates({
      companyCount: 0,
      contactCount: 0,
      enrichedCount: 0,
      verifiedCount: 0,
      scoredCount: 0,
      emailLeadCount: 0,
    });
    expect(empty.step1.enabled).toBe(true);
    expect(empty.step2.enabled).toBe(false);
    expect(empty.step5.enabled).toBe(false);

    const afterCompanies = derivePipelineStepStates({
      companyCount: 3,
      contactCount: 0,
      enrichedCount: 0,
      verifiedCount: 0,
      scoredCount: 0,
      emailLeadCount: 0,
    });
    expect(afterCompanies.step2.enabled).toBe(true);
    expect(afterCompanies.step3.enabled).toBe(false);

    const afterPeople = derivePipelineStepStates({
      companyCount: 3,
      contactCount: 5,
      enrichedCount: 0,
      verifiedCount: 0,
      scoredCount: 0,
      emailLeadCount: 0,
    });
    expect(afterPeople.step3.enabled).toBe(true);
    expect(afterPeople.step4.enabled).toBe(false);

    const afterEnrichLinkedInOnly = derivePipelineStepStates({
      companyCount: 3,
      contactCount: 5,
      enrichedCount: 4,
      verifiedCount: 0,
      scoredCount: 0,
      emailLeadCount: 0,
    });
    expect(afterEnrichLinkedInOnly.step4.skipped).toBe(true);
    expect(afterEnrichLinkedInOnly.step5.enabled).toBe(true);

    const afterEnrichWithEmail = derivePipelineStepStates({
      companyCount: 3,
      contactCount: 5,
      enrichedCount: 4,
      verifiedCount: 0,
      scoredCount: 0,
      emailLeadCount: 2,
    });
    expect(afterEnrichWithEmail.step4.enabled).toBe(true);
    expect(afterEnrichWithEmail.step5.enabled).toBe(false);

    const afterVerify = derivePipelineStepStates({
      companyCount: 3,
      contactCount: 5,
      enrichedCount: 4,
      verifiedCount: 2,
      scoredCount: 0,
      emailLeadCount: 2,
    });
    expect(afterVerify.step5.enabled).toBe(true);
  });
});

describe("free scraping pipeline extensions", () => {
  it("builds common email pattern candidates", async () => {
    const { buildEmailPatternCandidates } = await import(
      "@/lib/scraping/guess-email-patterns"
    );

    expect(buildEmailPatternCandidates("John", "Smith", "abc.com")).toEqual([
      "john@abc.com",
      "john.smith@abc.com",
      "j.smith@abc.com",
      "johnsmith@abc.com",
    ]);
  });

  it("matches Crunchbase and Wellfound profile URLs", async () => {
    const {
      isPublicDatabaseProfileUrl,
      matchPublicDatabaseSite,
    } = await import("@/lib/scraping/public-database-sites");

    expect(
      isPublicDatabaseProfileUrl("https://www.crunchbase.com/organization/acme-health")
    ).toBe(true);
    expect(matchPublicDatabaseSite("https://wellfound.com/company/acme")?.id).toBe(
      "wellfound"
    );
    expect(isPublicDatabaseProfileUrl("https://acme.com/about")).toBe(false);
  });

  it("matches expanded CTO title aliases", async () => {
    const { matchesJobTitle } = await import(
      "@/lib/contact-discovery/apply-title-filter"
    );

    expect(matchesJobTitle("VP Engineering", ["CTO"])).toBe(true);
    expect(matchesJobTitle("Head of Technology", ["CTO"])).toBe(true);
    expect(matchesJobTitle("IT Director", ["Director"])).toBe(true);
  });
});
