import * as cheerio from "cheerio";
import { filterCompanySearchResults } from "@/lib/scraping/company-search-filter";
import { createLogger } from "@/lib/logger";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import { fetchPage } from "@/lib/scraping/http-client";
import { parseSearchIntent } from "@/lib/search/search-intent";
import { searchSearxngCompanies } from "@/lib/scraping/searxng-search";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolMiss,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";
import { buildCountryLocalCompanyQueries } from "@/lib/scraping/country-local-search";
import {
  buildWikipediaSearchQueries,
  searchWikipediaCompanies,
} from "@/lib/scraping/wikipedia-search";

const log = createLogger("scraping.web-search");

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string | null;
}

export type WebSearchBackend =
  | "searxng"
  | "wikipedia"
  | "searxng+wikipedia"
  | "duckduckgo";

function parseDuckDuckGoResults(html: string): WebSearchResult[] {
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  $(".result").each((_, element) => {
    const title = $(element).find(".result__a").first().text().trim();
    const href = $(element).find(".result__a").first().attr("href");
    const snippet = $(element).find(".result__snippet").first().text().trim();

    if (!title || !href) return;

    const url = href.startsWith("//duckduckgo.com/l/?")
      ? decodeURIComponent(href.split("uddg=")[1]?.split("&")[0] ?? "")
      : href;

    const domain = extractDomainFromUrl(url);
    if (!domain) return;

    results.push({ title, url, snippet, domain });
  });

  return results;
}

export function buildCompanySearchQuery(input: {
  industry: string;
  country: string;
  keywords: string[];
  technologies: string[];
  companySizeMin?: number | null;
  companySizeMax?: number | null;
}): string {
  const industry = input.industry.trim();
  const country = input.country.trim();
  const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);
  const technologies = input.technologies.map((t) => t.trim()).filter(Boolean);

  const combined = [industry, ...keywords].join(" ").toLowerCase();
  const saasSearch = /\bsaas\b|software as a service|b2b software/.test(combined);
  const healthSearch =
    /\b(healthtech|health tech|digital health|medtech|healthcare)\b/i.test(combined) ||
    industry.toLowerCase().includes("health");
  const techSearch = /\btech(nology)?\b|software|saas|startup/.test(combined);
  const smbSearch =
    input.companySizeMax !== null &&
    input.companySizeMax !== undefined &&
    input.companySizeMax <= 250;

  const parts: string[] = [];

  if (healthSearch && industry.toLowerCase().includes("health")) {
    parts.push(smbSearch ? "healthcare technology startup" : "healthcare technology company");
  } else if (saasSearch) {
    parts.push("B2B SaaS software company");
  } else if (techSearch && industry) {
    parts.push(`${industry} software company`);
  } else if (industry) {
    parts.push(industry, "company");
  } else {
    parts.push("company");
  }

  if (smbSearch) {
    parts.push("small business", "startup");
  }

  if (country) parts.push(country);
  parts.push(...keywords.slice(0, 2));
  parts.push(...technologies.slice(0, 2));

  return parts.join(" ").trim();
}

/** @deprecated Use buildWikipediaSearchQueries from wikipedia-search.ts */
export function buildWikipediaSearchQuery(input: {
  industry: string;
  country: string;
  keywords: string[];
}): string {
  return buildWikipediaSearchQueries(input)[0] ?? "";
}

function dedupeWebResults(results: WebSearchResult[], maxResults: number): WebSearchResult[] {
  const filtered = filterCompanySearchResults(results);
  const seen = new Set<string>();
  const unique: WebSearchResult[] = [];

  for (const result of filtered) {
    if (!result.domain || seen.has(result.domain)) continue;
    seen.add(result.domain);
    unique.push(result);
    if (unique.length >= maxResults) break;
  }

  return unique;
}

async function searchDuckDuckGoCompanies(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  if (!isScrapingToolAvailable("duckduckgo")) return [];

  const encoded = encodeURIComponent(query);
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;

  const page = await fetchPage(searchUrl, {
    respectRobots: false,
    minIntervalMs: 2000,
    timeoutMs: 15_000,
  });

  if (!page) {
    log.warn("DuckDuckGo search returned no page", { query });
    recordScrapingToolFailure("duckduckgo");
    return [];
  }

  if (page.html.includes("anomaly-modal") || page.html.includes("challenge-form")) {
    log.warn("DuckDuckGo bot challenge detected", { query });
    recordScrapingToolFailure("duckduckgo");
    return [];
  }

  const results = dedupeWebResults(parseDuckDuckGoResults(page.html), maxResults);
  if (results.length > 0) {
    recordScrapingToolSuccess("duckduckgo");
  } else {
    recordScrapingToolMiss("duckduckgo");
  }
  return results;
}

export async function searchWebCompanies(
  query: string,
  maxResults = 15,
  options: {
    industry?: string;
    country?: string;
    keywords?: string[];
    searchName?: string;
    companySizeMin?: number | null;
    companySizeMax?: number | null;
  } = {}
): Promise<WebSearchResult[]> {
  const industry = options.industry ?? "";
  const country = options.country ?? "";
  const keywords = options.keywords ?? [];

  const intent = parseSearchIntent({
    searchName: options.searchName ?? query,
    industry,
    country,
    keywords,
    companySizeMin: options.companySizeMin,
    companySizeMax: options.companySizeMax,
  });

  const localQueries =
    country.trim().length > 0
      ? buildCountryLocalCompanyQueries({ industry, country, keywords })
      : [];

  const searxngQueryVariants = [
    ...intent.queryVariants,
    ...localQueries,
  ]
    .filter((q, index, arr) => q.trim() && arr.indexOf(q) === index)
    .slice(0, 12);

  // 🥇 Search scraping first (SearXNG / Brave) — Apollo/Clay-style primary discovery
  const searxngBatches =
    isScrapingToolAvailable("searxng")
      ? await Promise.all(
          searxngQueryVariants.map((variant) =>
            searchSearxngCompanies(variant, Math.max(8, Math.ceil(maxResults / 3)))
          )
        )
      : [];
  const searxngResults = dedupeWebResults(searxngBatches.flat(), maxResults * 3);

  // Wikipedia supplements SearXNG with list-style company pages
  const wikiResults = isScrapingToolAvailable("wikipedia")
    ? await searchWikipediaCompanies(
        buildWikipediaSearchQueries({ industry, country, keywords }),
        maxResults
      )
    : [];

  const merged = dedupeWebResults([...searxngResults, ...wikiResults], maxResults);
  if (merged.length > 0) {
    if (wikiResults.length > 0) recordScrapingToolSuccess("wikipedia");
    log.info("Web search completed", {
      query,
      count: merged.length,
      searxng: searxngResults.length,
      wikipedia: wikiResults.length,
      backend: searxngResults.length > 0 ? "searxng+wikipedia" : "wikipedia",
    });
    return merged;
  }

  if (wikiResults.length === 0 && isScrapingToolAvailable("wikipedia")) {
    recordScrapingToolMiss("wikipedia");
  }

  // Wikipedia-only when SearXNG engines are blocked
  if (wikiResults.length > 0) {
    log.info("Web search completed", {
      query,
      count: wikiResults.length,
      backend: "wikipedia",
    });
    return wikiResults;
  }

  // 🥉 DuckDuckGo HTML — direct fallback when SearXNG + Wikipedia are empty
  if (!isScrapingToolAvailable("duckduckgo")) {
    log.warn("All available web search backends returned no results", { query });
    return [];
  }

  const ddgQueries = [
    query,
    ...intent.queryVariants.slice(0, 4),
  ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i);

  const ddgBatches = await Promise.all(
    ddgQueries.map((variant) => searchDuckDuckGoCompanies(variant, maxResults))
  );
  const ddgResults = dedupeWebResults(ddgBatches.flat(), maxResults);
  if (ddgResults.length > 0) {
    log.info("Web search completed", {
      query,
      count: ddgResults.length,
      backend: "duckduckgo",
    });
    return ddgResults;
  }

  log.warn("All web search backends returned no results", { query });
  return [];
}
