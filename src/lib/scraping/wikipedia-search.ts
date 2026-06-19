import { createLogger } from "@/lib/logger";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import { isHistoricalOrDefunctName } from "@/lib/scraping/company-search-filter";
import { isNonCommercialTitle } from "@/lib/scraping/org-type-blockers";
import {
  recordScrapingToolMiss,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";
import type { WebSearchResult } from "@/lib/scraping/web-search";

const log = createLogger("scraping.wikipedia");

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "LeadForge/1.0 (company research; contact@righttail.com)";

const SKIP_TITLE_PATTERNS =
  /^(Category:|Template:|File:|Help:|Portal:|Wikipedia:|Comparison of|Index of)/i;

const SKIP_LINK_PATTERNS =
  /^(Category:|Template:|File:|Help:|Portal:|Wikipedia:|List of|Comparison of|Index of)/i;

interface MediaWikiSearchHit {
  title: string;
}

interface MediaWikiSearchResponse {
  query?: {
    search?: MediaWikiSearchHit[];
  };
}

interface MediaWikiLinksResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        links?: Array<{ ns: number; title: string }>;
      }
    >;
  };
}

interface MediaWikiPagePropsResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        missing?: string;
        pageprops?: { wikibase_item?: string };
      }
    >;
  };
}

interface MediaWikiRevisionsResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        revisions?: Array<{ slots?: { main?: { "*": string } } }>;
      }
    >;
  };
}

interface WikidataEntityResponse {
  entities?: Record<
    string,
    {
      claims?: {
        P856?: Array<{
          mainsnak?: {
            datavalue?: { value?: string };
          };
        }>;
      };
    }
  >;
}

export function buildWikipediaSearchQueries(input: {
  industry: string;
  country: string;
  keywords: string[];
}): string[] {
  const industry = input.industry.trim();
  const country = input.country.trim();
  const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);

  const prioritized: string[] = [];

  if (keywords[0] && country) {
    prioritized.push(`${keywords[0]} companies in ${country}`);
  }
  if (industry && country) {
    prioritized.push(`${industry} companies in ${country}`);
    prioritized.push(`List of companies of ${country}`);
    prioritized.push(`List of ${industry.toLowerCase()} companies in ${country}`);
  }
  if (keywords[0] && industry) {
    prioritized.push(
      country
        ? `${keywords[0]} ${industry} companies in ${country}`
        : `${keywords[0]} ${industry} companies`
    );
  } else if (industry && !country) {
    prioritized.push(`${industry} companies`);
  }

  return prioritized.slice(0, 5);
}

function isValidCompanyCandidateTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (SKIP_TITLE_PATTERNS.test(trimmed)) return false;
  if (isHistoricalOrDefunctName(trimmed)) return false;
  if (isNonCommercialTitle(trimmed)) return false;
  if (trimmed.startsWith("List of")) return false;
  return true;
}

function extractWebsiteFromWikitext(wikitext: string): string | null {
  const patterns = [
    /\|\s*website\s*=\s*\{\{URL\|([^}|]+)/i,
    /\|\s*website\s*=\s*\[https?:\/\/([^\s\]|]+)/i,
    /\|\s*website\s*=\s*(https?:\/\/[^\s|}\n]+)/i,
    /\|\s*website\s*=\s*([a-z0-9][a-z0-9.-]+\.[a-z]{2,})/i,
    /\|\s*homepage\s*=\s*(https?:\/\/[^\s|}\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = wikitext.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      if (value && !value.toLowerCase().includes("wikipedia.org")) {
        return value.startsWith("http") ? value : `https://${value}`;
      }
    }
  }

  return null;
}

async function wikipediaGet<T>(params: Record<string, string>): Promise<T | null> {
  const url = new URL(WIKIPEDIA_API);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      log.warn("Wikipedia API HTTP error", { status: response.status });
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    log.warn("Wikipedia API error", { error: String(error) });
    return null;
  }
}

async function wikidataGet<T>(params: Record<string, string>): Promise<T | null> {
  const url = new URL(WIKIDATA_API);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    log.warn("Wikidata API error", { error: String(error) });
    return null;
  }
}

async function searchWikipediaTitles(
  query: string,
  limit = 10
): Promise<MediaWikiSearchHit[]> {
  const body = await wikipediaGet<MediaWikiSearchResponse>({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    format: "json",
  });

  return body?.query?.search ?? [];
}

async function getPageByTitle(title: string): Promise<boolean> {
  const body = await wikipediaGet<MediaWikiPagePropsResponse>({
    action: "query",
    titles: title,
    format: "json",
  });

  if (!body?.query?.pages) return false;
  const page = Object.values(body.query.pages)[0];
  return !page?.missing;
}

async function getListPageCompanyTitles(title: string, limit = 30): Promise<string[]> {
  const body = await wikipediaGet<MediaWikiLinksResponse>({
    action: "query",
    prop: "links",
    titles: title,
    plnamespace: "0",
    pllimit: String(Math.min(limit * 2, 50)),
    format: "json",
  });

  if (!body?.query?.pages) return [];

  const page = Object.values(body.query.pages)[0];
  const links = page?.links ?? [];

  return links
    .map((link) => link.title)
    .filter((linkTitle) => isValidCompanyCandidateTitle(linkTitle))
    .slice(0, limit);
}

async function resolveWebsitesFromWikitext(
  titles: string[]
): Promise<WebSearchResult[]> {
  if (titles.length === 0) return [];

  const body = await wikipediaGet<MediaWikiRevisionsResponse>({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: titles.slice(0, 20).join("|"),
    format: "json",
  });

  if (!body?.query?.pages) return [];

  const results: WebSearchResult[] = [];

  for (const page of Object.values(body.query.pages)) {
    const wikitext = page.revisions?.[0]?.slots?.main?.["*"];
    const title = page.title;
    if (!wikitext || !title) continue;

    const website = extractWebsiteFromWikitext(wikitext);
    if (!website) continue;

    const domain = extractDomainFromUrl(website);
    if (!domain) continue;

    results.push({
      title: title.replace(/\s*\([^)]*\)\s*$/, "").trim() || title,
      url: website.startsWith("http") ? website : `https://${website}`,
      snippet: `Company from Wikipedia (${title}).`,
      domain,
    });
  }

  return results;
}

async function resolveWebsitesFromWikidata(
  titles: string[]
): Promise<WebSearchResult[]> {
  if (titles.length === 0) return [];

  const propsBody = await wikipediaGet<MediaWikiPagePropsResponse>({
    action: "query",
    prop: "pageprops",
    ppprop: "wikibase_item",
    titles: titles.slice(0, 50).join("|"),
    format: "json",
  });

  if (!propsBody?.query?.pages) return [];

  const titleByQid = new Map<string, string>();
  const qids: string[] = [];

  for (const page of Object.values(propsBody.query.pages)) {
    const qid = page.pageprops?.wikibase_item;
    if (!qid || !page.title) continue;
    titleByQid.set(qid, page.title);
    qids.push(qid);
  }

  if (qids.length === 0) return [];

  const wikidataBody = await wikidataGet<WikidataEntityResponse>({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "claims",
    format: "json",
  });

  const results: WebSearchResult[] = [];

  for (const qid of qids) {
    const entity = wikidataBody?.entities?.[qid];
    const website = entity?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (!website || typeof website !== "string") continue;

    const domain = extractDomainFromUrl(website);
    if (!domain) continue;

    const title = titleByQid.get(qid) ?? domain;
    results.push({
      title: title.replace(/\s*\([^)]*\)\s*$/, "").trim() || title,
      url: website.startsWith("http") ? website : `https://${website}`,
      snippet: `Company from Wikidata (${title}).`,
      domain,
    });
  }

  return results;
}

async function resolveWebsitesForTitles(
  titles: string[],
  maxResults = 15
): Promise<WebSearchResult[]> {
  const wikidataResults = await resolveWebsitesFromWikidata(titles);
  const seen = new Set<string>();
  const combined: WebSearchResult[] = [];

  for (const result of wikidataResults) {
    if (!result.domain || seen.has(result.domain)) continue;
    seen.add(result.domain);
    combined.push(result);
    if (combined.length >= maxResults) return combined;
  }

  const resolvedTitles = new Set(
    wikidataResults.map((result) => result.title.toLowerCase())
  );
  const unresolved = titles.filter(
    (title) =>
      !resolvedTitles.has(title.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase())
  );

  const infoboxResults = await resolveWebsitesFromWikitext(
    unresolved.slice(0, Math.max(0, maxResults - combined.length + 5))
  );

  for (const result of infoboxResults) {
    if (!result.domain || seen.has(result.domain)) continue;
    seen.add(result.domain);
    combined.push(result);
    if (combined.length >= maxResults) break;
  }

  return combined;
}

const MAX_CANDIDATE_TITLES = 60;

function isBroadListPage(title: string): boolean {
  return /^List of (companies|largest|biggest|major|public|Fortune|software companies)/i.test(
    title.trim()
  );
}

async function collectCandidateTitles(queries: string[]): Promise<string[]> {
  const candidateTitles = new Set<string>();

  for (const query of queries) {
    if (candidateTitles.size >= MAX_CANDIDATE_TITLES) break;

    if (query.startsWith("List of ") && (await getPageByTitle(query))) {
      if (isBroadListPage(query)) continue;
      const listTitles = await getListPageCompanyTitles(
        query,
        MAX_CANDIDATE_TITLES - candidateTitles.size
      );
      for (const title of listTitles) {
        candidateTitles.add(title);
        if (candidateTitles.size >= MAX_CANDIDATE_TITLES) break;
      }
      continue;
    }

    const hits = await searchWikipediaTitles(query, 6);
    for (const hit of hits) {
      if (candidateTitles.size >= MAX_CANDIDATE_TITLES) break;

      if (hit.title.startsWith("List of")) {
        if (isBroadListPage(hit.title)) continue;
        const listTitles = await getListPageCompanyTitles(
          hit.title,
          MAX_CANDIDATE_TITLES - candidateTitles.size
        );
        for (const title of listTitles) {
          candidateTitles.add(title);
          if (candidateTitles.size >= MAX_CANDIDATE_TITLES) break;
        }
      } else if (isValidCompanyCandidateTitle(hit.title)) {
        candidateTitles.add(hit.title);
      }
    }
  }

  return Array.from(candidateTitles);
}

export async function searchWikipediaCompanies(
  queries: string | string[],
  maxResults = 15
): Promise<WebSearchResult[]> {
  const queryList = Array.isArray(queries) ? queries.slice(0, 5) : [queries];
  const candidateTitles = await collectCandidateTitles(queryList);

  if (candidateTitles.length === 0) {
    log.warn("Wikipedia search returned no candidate titles", { queries: queryList });
    return [];
  }

  const resolved = await resolveWebsitesForTitles(
    candidateTitles.slice(0, MAX_CANDIDATE_TITLES),
    maxResults
  );
  const seen = new Set<string>();
  const unique: WebSearchResult[] = [];

  for (const result of resolved) {
    if (!result.domain || seen.has(result.domain)) continue;
    seen.add(result.domain);
    unique.push(result);
    if (unique.length >= maxResults) break;
  }

  log.info("Wikipedia search completed", {
    queries: queryList,
    candidates: candidateTitles.length,
    count: unique.length,
  });
  if (unique.length > 0) {
    recordScrapingToolSuccess("wikipedia");
  } else {
    recordScrapingToolMiss("wikipedia");
  }
  return unique;
}
