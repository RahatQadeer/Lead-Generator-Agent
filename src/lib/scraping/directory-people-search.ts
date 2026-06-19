import * as cheerio from "cheerio";
import { createLogger } from "@/lib/logger";
import {
  BUSINESS_DIRECTORY_SITES,
  isBusinessDirectoryProfileUrl,
  matchBusinessDirectorySite,
  parseBusinessDirectoryProfile,
} from "@/lib/scraping/business-directory-sites";
import { isPlausiblePersonName } from "@/lib/scraping/data-quality";
import { FAST_FETCH, fetchPage } from "@/lib/scraping/http-client";
import { parseContactsFromHtml, type ParsedContact } from "@/lib/scraping/parse-html";
import {
  isPublicDatabaseProfileUrl,
  matchPublicDatabaseSite,
} from "@/lib/scraping/public-database-sites";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";
import {
  recordScrapingToolFailure,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";

const log = createLogger("scraping.directory-people");

const MAX_DIRECTORY_QUERIES = 3;
const MAX_PROFILES = 4;
const SEARCH_TIMEOUT_MS = 12_000;

const DIRECTORY_PEOPLE_SITES = ["clutch", "goodfirms", "hotfrog", "manta"] as const;

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

async function searchDirectoryWeb(query: string, maxResults: number): Promise<SearchHit[]> {
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
        "User-Agent": "LeadForge/1.0 (directory people research)",
      },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      recordScrapingToolFailure("searxng");
      return [];
    }

    const body = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };

    const hits: SearchHit[] = [];
    const seen = new Set<string>();

    for (const item of body.results ?? []) {
      if (!item.url || !item.title) continue;
      const url = item.url.split("#")[0] ?? item.url;
      if (seen.has(url)) continue;
      seen.add(url);
      hits.push({
        title: item.title.trim(),
        url,
        snippet: item.content?.trim() ?? "",
      });
      if (hits.length >= maxResults) break;
    }

    if (hits.length > 0) recordScrapingToolSuccess("searxng");

    return hits;
  } catch (error) {
    log.warn("Directory people search failed", { query, error: String(error) });
    recordScrapingToolFailure("searxng");
    return [];
  }
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function extractNamedContactsFromListingText(
  html: string,
  companyName: string
): ParsedContact[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").slice(0, 8000);
  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();

  const patterns = [
    /\b(?:owner|contact person|contact|manager|president|ceo|founder|director)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/gi,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-–,]\s*(CEO|CTO|CFO|Founder|Co-Founder|President|Director|Owner|Manager)\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1]?.trim();
      const title = match[2]?.trim() ?? "Team Member";
      if (!name || !isPlausiblePersonName(name)) continue;
      if (name.toLowerCase().includes(companyName.toLowerCase().slice(0, 6))) continue;

      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const { firstName, lastName } = splitName(name);
      contacts.push({
        fullName: name,
        firstName,
        lastName,
        title,
        email: null,
        linkedinUrl: null,
        source: "page",
        sourceUrl: null,
        affiliationText: text.slice(0, 400),
        extractionSource: "directory_listing",
      });
    }
  }

  return contacts;
}

async function scrapePeopleFromProfileUrl(
  profileUrl: string,
  companyName: string,
  domain: string
): Promise<ParsedContact[]> {
  const page = await fetchPage(profileUrl, {
    ...FAST_FETCH,
    respectRobots: true,
    minIntervalMs: 600,
  });
  if (!page?.html) return [];

  const fromTeamParser = parseContactsFromHtml(page.html, domain, profileUrl).map(
    (person) => ({
      ...person,
      extractionSource: "directory_listing" as const,
      affiliationText: `${companyName} ${person.title}`.slice(0, 400),
    })
  );

  const fromHeuristics = extractNamedContactsFromListingText(page.html, companyName);

  const businessSite = matchBusinessDirectorySite(profileUrl);
  if (businessSite) {
    const listing = parseBusinessDirectoryProfile(
      page.html,
      profileUrl,
      businessSite.id,
      companyName
    );
    if (listing?.description) {
      fromHeuristics.push(
        ...extractNamedContactsFromListingText(
          `<body>${listing.description}</body>`,
          companyName
        )
      );
    }
  }

  if (matchPublicDatabaseSite(profileUrl)) {
    fromHeuristics.push(...extractNamedContactsFromListingText(page.html, companyName));
  }

  const merged = [...fromTeamParser, ...fromHeuristics];
  const seen = new Set<string>();
  return merged.filter((person) => {
    const key = person.fullName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRelevantProfileHit(hit: SearchHit, companyName: string, domain: string): boolean {
  const haystack = `${hit.title} ${hit.snippet} ${hit.url}`.toLowerCase();
  const name = companyName.toLowerCase();
  if (haystack.includes(name)) return true;

  const root = domain.replace(/^www\./, "").split(".")[0];
  return Boolean(root && root.length >= 3 && haystack.includes(root));
}

/** Find people on Clutch/Hotfrog/Crunchbase/Wellfound when the company website has no team page. */
export async function discoverPeopleFromPublicDirectories(
  companyName: string,
  domain: string,
  jobTitles: string[],
  options?: { broadDecisionMakerSearch?: boolean }
): Promise<ParsedContact[]> {
  if (!getSearxngBaseUrl()) {
    log.info("Directory people search skipped — SEARXNG_URL not configured");
    return [];
  }

  const cleanDomain = domain.replace(/^www\./, "");
  const roleHint = options?.broadDecisionMakerSearch
    ? "CEO Founder CTO Director Owner"
    : jobTitles.slice(0, 2).join(" ") || "CEO Founder";
  const queries: string[] = [];

  for (const siteId of DIRECTORY_PEOPLE_SITES) {
    const site = BUSINESS_DIRECTORY_SITES.find((entry) => entry.id === siteId);
    if (!site) continue;
    queries.push(`site:${site.domains[0]} "${companyName}"`);
    if (queries.length >= MAX_DIRECTORY_QUERIES - 1) break;
  }

  queries.push(`site:crunchbase.com/organization "${companyName}"`);
  const companyClause = cleanDomain
    ? `("${companyName}" OR ${cleanDomain})`
    : `"${companyName}"`;
  queries.push(
    `${companyClause} ${roleHint} (site:wellfound.com OR site:crunchbase.com)`
  );

  const profileUrls = new Set<string>();
  const contacts: ParsedContact[] = [];

  for (const query of queries.slice(0, MAX_DIRECTORY_QUERIES + 1)) {
    const hits = await searchDirectoryWeb(query, 8);

    for (const hit of hits) {
      if (
        !isBusinessDirectoryProfileUrl(hit.url) &&
        !isPublicDatabaseProfileUrl(hit.url)
      ) {
        continue;
      }
      if (!isRelevantProfileHit(hit, companyName, cleanDomain)) continue;
      profileUrls.add(hit.url);
    }
  }

  for (const profileUrl of [...profileUrls].slice(0, MAX_PROFILES)) {
    const parsed = await scrapePeopleFromProfileUrl(profileUrl, companyName, cleanDomain);
    contacts.push(...parsed);
    if (contacts.length >= 6) break;
  }

  if (contacts.length > 0) {
    log.info("Directory listing people discovered", {
      company: companyName,
      domain: cleanDomain,
      profiles: profileUrls.size,
      count: contacts.length,
    });
  }

  return contacts.slice(0, 6);
}
