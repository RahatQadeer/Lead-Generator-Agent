import { describe, expect, it } from "vitest";

import {
  assessWebsiteQuality,
  classifyWebsiteLiveness,
  extractVisibleText,
  isDeadWebsiteStatus,
  verifyWebsite,
} from "@/lib/scraping/website-verification";
import {
  computeSemanticRelevance,
  SEMANTIC_RELEVANCE_FLOOR,
  tokenize,
} from "@/lib/company-discovery/semantic-relevance";
import {
  collectCompanySources,
  computeCompanyVerification,
  countTrustedSources,
} from "@/lib/company-discovery/company-verification";

const LIVE_HTML = `
  <html><head><title>Acme Health — Digital Health Platform</title></head>
  <body>
    <nav><a href="/about">About us</a><a href="/contact">Contact</a><a href="/products">Products</a></nav>
    <h1>Acme Health</h1>
    <p>${"Acme Health builds a HIPAA-compliant digital health platform for hospitals and clinics. ".repeat(20)}</p>
  </body></html>`;

describe("website liveness classification", () => {
  it("marks a substantive site as live", () => {
    const result = classifyWebsiteLiveness({ reachable: true, html: LIVE_HTML, title: "Acme Health" });
    expect(result.status).toBe("live");
    expect(result.live).toBe(true);
  });

  it("detects a parked / for-sale domain", () => {
    const html = "<html><body><h1>This domain is for sale. Buy this domain via HugeDomains.</h1></body></html>";
    const result = classifyWebsiteLiveness({ reachable: true, html, title: "buy this domain" });
    expect(result.status).toBe("parked");
    expect(isDeadWebsiteStatus(result.status)).toBe(true);
  });

  it("detects a coming-soon / under-construction placeholder", () => {
    const html = "<html><body><h1>Coming soon</h1><p>Our website is under construction.</p></body></html>";
    const result = classifyWebsiteLiveness({ reachable: true, html, title: "Coming soon" });
    expect(result.status).toBe("placeholder");
    expect(isDeadWebsiteStatus(result.status)).toBe(true);
  });

  it("detects a default server template", () => {
    const html = "<html><body><h1>Welcome to nginx!</h1></body></html>";
    expect(classifyWebsiteLiveness({ reachable: true, html }).status).toBe("placeholder");
  });

  it("detects an error / suspended body served with 200", () => {
    const html = "<html><body><h1>Account Suspended</h1><p>This site has been suspended.</p></body></html>";
    const result = classifyWebsiteLiveness({ reachable: true, html, title: "Account Suspended" });
    expect(result.status).toBe("error_page");
    expect(isDeadWebsiteStatus(result.status)).toBe(true);
  });

  it("treats an unreachable fetch as non-live but NOT affirmatively dead", () => {
    const result = classifyWebsiteLiveness({ reachable: false, html: null });
    expect(result.status).toBe("unreachable");
    expect(result.live).toBe(false);
    // Crucial: a blocked/timed-out fetch must not be rejected as dead.
    expect(isDeadWebsiteStatus(result.status)).toBe(false);
  });

  it("flags a reachable but near-empty page as low_content (not dead)", () => {
    const result = classifyWebsiteLiveness({ reachable: true, html: "<html><body>Hi</body></html>" });
    expect(result.status).toBe("low_content");
    expect(isDeadWebsiteStatus(result.status)).toBe(false);
  });

  it("strips markup when extracting visible text", () => {
    const text = extractVisibleText("<div><script>var x=1;</script><p>Hello&nbsp;world</p></div>");
    expect(text).toBe("Hello world");
  });
});

describe("website quality assessment", () => {
  it("detects About / Contact / Products and rewards content depth", () => {
    const quality = assessWebsiteQuality(LIVE_HTML);
    expect(quality.hasAbout).toBe(true);
    expect(quality.hasContact).toBe(true);
    expect(quality.hasProductsOrServices).toBe(true);
    expect(quality.qualityScore).toBeGreaterThanOrEqual(80);
  });

  it("scores a thin, structure-less page low", () => {
    const quality = assessWebsiteQuality("<html><body><p>Hello</p></body></html>");
    expect(quality.hasAbout).toBe(false);
    expect(quality.qualityScore).toBeLessThan(40);
  });

  it("verifyWebsite bundles liveness + quality", () => {
    const result = verifyWebsite({ reachable: true, html: LIVE_HTML, title: "Acme Health" });
    expect(result.status).toBe("live");
    expect(result.quality?.hasContact).toBe(true);
  });
});

describe("semantic relevance", () => {
  it("tokenizes and drops stopwords/short tokens", () => {
    expect(tokenize("The Digital Health Companies")).toEqual(["digital", "health"]);
  });

  it("scores a strong industry + keyword match highly", () => {
    const result = computeSemanticRelevance(
      { industry: "Digital Health", keywords: ["telemedicine", "hospital"] },
      {
        name: "Acme Digital Health",
        industry: "Digital Health",
        description: "Telemedicine platform for hospital networks.",
      }
    );
    expect(result.score).toBeGreaterThanOrEqual(SEMANTIC_RELEVANCE_FLOOR);
    expect(result.strong).toBe(true);
  });

  it("scores an off-topic company low", () => {
    const result = computeSemanticRelevance(
      { industry: "Healthcare AI", keywords: ["diagnostics"] },
      { name: "Joe's Pizzeria", industry: "Restaurant", description: "Wood-fired pizza and pasta." }
    );
    expect(result.score).toBeLessThan(SEMANTIC_RELEVANCE_FLOOR);
  });

  it("does not penalize a clear industry match that lacks keyword echoes", () => {
    const result = computeSemanticRelevance(
      { industry: "Fintech", keywords: ["blockchain", "defi"] },
      { name: "PayFlow", industry: "Fintech", description: "Payments infrastructure for banks." }
    );
    // Exact industry-phrase presence floors the score at 70.
    expect(result.score).toBeGreaterThanOrEqual(70);
  });
});

describe("company cross-verification", () => {
  it("counts trusted sources and excludes bare web search", () => {
    const sources = collectCompanySources({
      seedSource: "web",
      websiteStatus: "live",
      websiteUrl: "https://acme.com",
      linkedinUrl: "https://linkedin.com/company/acme",
    });
    // official_website + linkedin + web_search
    expect(sources).toHaveLength(3);
    // web_search is not trusted corroboration.
    expect(countTrustedSources(sources)).toBe(2);
  });

  it("maps directory origins to trusted source kinds", () => {
    const sources = collectCompanySources({ seedSource: "directory", directorySource: "google-places" });
    expect(sources[0].kind).toBe("google_maps");
  });

  it("verifies a live, cross-verified, high-confidence company", () => {
    const sources = collectCompanySources({
      seedSource: "directory",
      directorySource: "opencorporates",
      websiteStatus: "live",
      websiteUrl: "https://acme.com",
      linkedinUrl: "https://linkedin.com/company/acme",
    });
    const verdict = computeCompanyVerification({
      websiteStatus: "live",
      sources,
      confidenceScore: 90,
      semanticRelevance: 88,
    });
    expect(verdict.status).toBe("verified");
    expect(verdict.crossVerified).toBe(true);
    expect(verdict.reasons).toHaveLength(0);
  });

  it("rejects a company with an affirmatively dead website", () => {
    const verdict = computeCompanyVerification({
      websiteStatus: "parked",
      sources: [],
      confidenceScore: 90,
      semanticRelevance: 90,
    });
    expect(verdict.status).toBe("rejected");
  });

  it("downgrades a single-source company to needs_verification", () => {
    const sources = collectCompanySources({
      seedSource: "web",
      websiteStatus: "live",
      websiteUrl: "https://acme.com",
    });
    const verdict = computeCompanyVerification({
      websiteStatus: "live",
      sources,
      confidenceScore: 90,
      semanticRelevance: 90,
    });
    expect(verdict.status).toBe("needs_verification");
    expect(verdict.crossVerified).toBe(false);
    expect(verdict.reasons.join(" ")).toMatch(/trusted source/i);
  });

  it("flags a weak semantic match even when cross-verified", () => {
    const sources = collectCompanySources({
      seedSource: "directory",
      directorySource: "wikidata",
      websiteStatus: "live",
      websiteUrl: "https://acme.com",
      linkedinUrl: "https://linkedin.com/company/acme",
    });
    const verdict = computeCompanyVerification({
      websiteStatus: "live",
      sources,
      confidenceScore: 90,
      semanticRelevance: 20,
    });
    expect(verdict.status).toBe("needs_verification");
    expect(verdict.reasons.join(" ")).toMatch(/semantic/i);
  });
});
