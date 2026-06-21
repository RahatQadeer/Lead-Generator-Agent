import { getDecisionMakerSearchRoles } from "@/lib/contact-discovery/apply-title-filter";
import { normalizeCompanyNameForSearch } from "@/lib/search/search-name-utils";
import { createLogger } from "@/lib/logger";
import {
  verifyPersonCompanyAffiliation,
} from "@/lib/scraping/company-affiliation";
import { isPlausiblePersonName } from "@/lib/scraping/data-quality";
import { fetchPage } from "@/lib/scraping/http-client";
import type { ParsedContact } from "@/lib/scraping/parse-html";
import { parseContactsFromHtml, isLeadershipDirectoryUrl } from "@/lib/scraping/parse-html";
import { discoverDecisionMakersViaLinkedIn } from "@/lib/scraping/linkedin-profile-scraper";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolMiss,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";
import * as cheerio from "cheerio";

const log = createLogger("scraping.leadership-search");

/** Cap web queries per company — each DDG/SearXNG call can take 10–15s. */
const MAX_LEADERSHIP_QUERIES = 5;
const MAX_DOMAIN_LEADERSHIP_QUERIES = 2;
const DOMAIN_PAGE_FETCH_LIMIT = 4;
const LEADERSHIP_SEARCH_TIMEOUT_MS = 10_000;

interface SearxngResult {
  title?: string;
  url?: string;
  content?: string;
}

interface SearxngResponse {
  results?: SearxngResult[];
}

const PREFERRED_SEARCH_ROLES = [
  "CEO",
  "Founder",
  "CTO",
  "Director",
  "Owner",
  "Manager",
  "President",
] as const;

function looksLikePersonName(value: string): boolean {
  return isPlausiblePersonName(value);
}

function pickSearchRoles(jobTitles: string[]): string[] {
  const normalized = jobTitles.map((title) => title.toLowerCase());
  const picked: string[] = [];

  for (const role of PREFERRED_SEARCH_ROLES) {
    const key = role.toLowerCase();
    if (normalized.some((title) => title.includes(key) || key.includes(title))) {
      picked.push(role);
    }
  }

  if (picked.length > 0) return picked.slice(0, 4);

  return jobTitles
    .map((title) => title.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function parseLinkedInSearchHit(
  title: string,
  content: string
): { fullName: string; jobTitle: string } | null {
  const withoutSuffix = title.replace(/\s*[-|]\s*LinkedIn.*$/i, "").trim();
  const parts = withoutSuffix.split(/\s*[-–|]\s*/).map((part) => part.trim()).filter(Boolean);

  if (parts.length === 0) return null;

  const fullName = parts[0];
  if (!looksLikePersonName(fullName)) return null;

  const jobTitle =
    parts.find((part, index) => index > 0 && part.length > 2) ??
    content.match(
      /\b(CEO|CTO|CFO|COO|Founder|Co-Founder|President|Director|Managing Director|Owner|Manager|VP|Vice President|Chief [A-Za-z]+ Officer)\b/i
    )?.[0] ??
    "Team Member";

  return { fullName, jobTitle };
}

async function searchSearxng(query: string, maxResults: number): Promise<SearxngResult[]> {
  const baseUrl = getSearxngBaseUrl();
  if (!baseUrl) return [];

  const searchUrl = new URL("/search", baseUrl);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("categories", "general");

  try {
    const response = await fetch(searchUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeadForge/1.0 (leadership research)",
      },
      signal: AbortSignal.timeout(LEADERSHIP_SEARCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      recordScrapingToolFailure("searxng");
      return [];
    }

    const body = (await response.json()) as SearxngResponse;
    const results = (body.results ?? []).slice(0, maxResults);
    if (results.length > 0) {
      recordScrapingToolSuccess("searxng");
    }
    return results;
  } catch (error) {
    log.warn("Leadership search failed", { query, error: String(error) });
    recordScrapingToolFailure("searxng");
    return [];
  }
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearxngResult[]> {
  if (!isScrapingToolAvailable("duckduckgo")) return [];

  const encoded = encodeURIComponent(query);
  const page = await fetchPage(`https://html.duckduckgo.com/html/?q=${encoded}`, {
    respectRobots: false,
    minIntervalMs: 1200,
    timeoutMs: LEADERSHIP_SEARCH_TIMEOUT_MS,
  });

  if (!page?.html) {
    recordScrapingToolFailure("duckduckgo");
    return [];
  }

  if (page.html.includes("anomaly-modal") || page.html.includes("challenge-form")) {
    recordScrapingToolFailure("duckduckgo");
    return [];
  }

  const $ = cheerio.load(page.html);
  const results: SearxngResult[] = [];

  $(".result").each((_, element) => {
    const title = $(element).find(".result__a").first().text().trim();
    let href = $(element).find(".result__a").first().attr("href") ?? "";
    const content = $(element).find(".result__snippet").first().text().trim();

    if (href.startsWith("//duckduckgo.com/l/?")) {
      href = decodeURIComponent(href.split("uddg=")[1]?.split("&")[0] ?? "");
    }

    if (title && href) {
      results.push({ title, url: href, content });
    }
  });

  const sliced = results.slice(0, maxResults);
  if (sliced.length > 0) {
    recordScrapingToolSuccess("duckduckgo");
  } else {
    recordScrapingToolMiss("duckduckgo");
  }
  return sliced;
}

export async function searchWeb(query: string, maxResults: number): Promise<SearxngResult[]> {
  const baseUrl = getSearxngBaseUrl();
  if (baseUrl) {
    return searchSearxng(query, maxResults);
  }

  if (isScrapingToolAvailable("duckduckgo")) {
    return searchDuckDuckGo(query, maxResults);
  }

  return [];
}

/**
 * Discover leadership via LinkedIn profile search + optional profile page scraping.
 */
export async function discoverLeadershipViaSearch(
  companyName: string,
  jobTitles: string[],
  domain?: string | null,
  options?: { broadDecisionMakerSearch?: boolean; scrapeProfiles?: boolean }
): Promise<ParsedContact[]> {
  return discoverDecisionMakersViaLinkedIn(companyName, jobTitles, domain, {
    broadDecisionMakerSearch: options?.broadDecisionMakerSearch,
    scrapeProfiles: options?.scrapeProfiles,
  });
}

function hostMatchesCompanyDomain(host: string, domain: string): boolean {
  const normalizedHost = host.replace(/^www\./, "").toLowerCase();
  const normalizedDomain = domain.replace(/^www\./, "").toLowerCase();
  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  );
}

/**
 * Use SearXNG site:domain queries to find leadership pages (e.g. /key-management/)
 * when they are not linked from the homepage crawl.
 */
export async function discoverLeadershipOnCompanyDomain(
  companyName: string,
  domain: string,
  jobTitles: string[],
  options?: { broadDecisionMakerSearch?: boolean }
): Promise<ParsedContact[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "");
  if (!cleanDomain) return [];

  const searchName = normalizeCompanyNameForSearch(companyName);
  const target = { name: searchName, domain: cleanDomain };
  const roles = options?.broadDecisionMakerSearch
    ? getDecisionMakerSearchRoles().slice(0, 6)
    : pickSearchRoles(jobTitles);
  const roleClause = roles.slice(0, 3).join(" OR ");
  const queries = [
    `site:${cleanDomain} (${roleClause})`,
    `site:${cleanDomain} (CEO OR founder OR director OR chairman OR management OR "key management")`,
  ].slice(0, MAX_DOMAIN_LEADERSHIP_QUERIES);

  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();
  const fetchedUrls = new Set<string>();

  for (const query of queries) {
    const results = await searchWeb(query, 8);

    for (const item of results) {
      const rawUrl = item.url?.trim();
      if (!rawUrl || fetchedUrls.size >= DOMAIN_PAGE_FETCH_LIMIT) continue;

      let host = "";
      try {
        host = new URL(rawUrl).hostname;
      } catch {
        continue;
      }
      if (!hostMatchesCompanyDomain(host, cleanDomain)) continue;

      const normalizedUrl = rawUrl.split("#")[0] ?? rawUrl;
      if (fetchedUrls.has(normalizedUrl)) continue;
      fetchedUrls.add(normalizedUrl);

      const page = await fetchPage(normalizedUrl, {
        respectRobots: true,
        minIntervalMs: 800,
        timeoutMs: LEADERSHIP_SEARCH_TIMEOUT_MS,
      });
      if (!page?.html) continue;

      const parsed = parseContactsFromHtml(page.html, cleanDomain, normalizedUrl);
      for (const person of parsed) {
        if (!looksLikePersonName(person.fullName)) continue;

        const affiliation = verifyPersonCompanyAffiliation(
          {
            title: person.title,
            bioText: person.affiliationText ?? person.title,
            source: "domain_search",
            onCompanyWebsite: true,
            leadershipPage: isLeadershipDirectoryUrl(normalizedUrl),
          },
          target
        );
        if (!affiliation.matches) continue;

        const key = `${person.fullName.toLowerCase()}|${person.title.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        contacts.push({
          ...person,
          sourceUrl: normalizedUrl,
          extractionSource: "domain_search",
        });

        if (contacts.length >= 8) break;
      }

      if (contacts.length >= 8) break;
    }

    if (contacts.length >= 8) break;
  }

  if (contacts.length > 0) {
    log.info("Domain leadership search discovered people", {
      company: companyName,
      domain: cleanDomain,
      count: contacts.length,
    });
  }

  return contacts;
}
