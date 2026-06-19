import * as cheerio from "cheerio";
import { createLogger } from "@/lib/logger";
import {
  textMentionsTargetCompany,
  verifyPersonCompanyAffiliation,
  type CompanyAffiliationTarget,
} from "@/lib/scraping/company-affiliation";
import {
  personNameAppearsInText,
  personNamesMatch,
} from "@/lib/scraping/contact-name-match";
import {
  linkedinProfileMatchesPerson,
  sanitizePersonLinkedInUrl,
} from "@/lib/scraping/data-quality";
import { fetchPage } from "@/lib/scraping/http-client";
import { parseLinkedInSearchHit, searchWeb } from "@/lib/scraping/leadership-search";
import { parseLinkedInProfileTitle } from "@/lib/scraping/linkedin-profile-scraper";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";
import { normalizeCompanyNameForSearch } from "@/lib/search/search-name-utils";
import {
  recordScrapingToolFailure,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";
import type { LinkedInSource } from "@/types/lead";

const log = createLogger("scraping.linkedin-profile-search");

const SEARCH_TIMEOUT_MS = 12_000;
const MIN_CONFIDENCE = 45;
const HIGH_CONFIDENCE = 78;

export interface LinkedInProfileSearchInput {
  fullName: string;
  jobTitle: string;
  companyName: string;
  companyDomain?: string | null;
}

export interface LinkedInProfileSearchResult {
  url: string;
  fullName: string;
  headline: string;
  companyMatch: boolean;
  confidenceScore: number;
  source: LinkedInSource;
  searchBackend: "searxng" | "bing" | "duckduckgo";
}

interface SearchHit {
  title: string;
  url: string;
  content: string;
  backend: LinkedInProfileSearchResult["searchBackend"];
}

function quoteToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes(" ") ? `"${trimmed}"` : trimmed;
}

function primaryRoleToken(jobTitle: string): string {
  const cleaned = jobTitle.trim();
  if (!cleaned || /^team member$/i.test(cleaned)) return "";

  const match = cleaned.match(
    /\b(ceo|cto|cfo|coo|cmo|cpo|founder|co[-\s]?founder|president|director|owner|manager|vp|vice president|chief\s+[\w\s]+officer|head of[\w\s]*|partner)\b/i
  );
  return match?.[0] ?? cleaned.split(/\s+/).slice(0, 3).join(" ");
}

/** Google/Bing structured queries: site:linkedin.com/in "Name" Role "Company". */
export function buildLinkedInProfileSearchQueries(
  input: LinkedInProfileSearchInput
): string[] {
  const name = quoteToken(input.fullName.trim());
  const company = quoteToken(normalizeCompanyNameForSearch(input.companyName));
  const role = primaryRoleToken(input.jobTitle);
  const fullRole = quoteToken(input.jobTitle.trim());
  const domain = input.companyDomain?.replace(/^www\./, "").trim();

  const queries = [
    role ? `site:linkedin.com/in ${name} ${role} ${company}` : null,
    role ? `site:linkedin.com/in ${name} ${quoteToken(role)} ${company}` : null,
    fullRole && fullRole !== quoteToken(role)
      ? `site:linkedin.com/in ${name} ${fullRole} ${company}`
      : null,
    `site:linkedin.com/in ${name} ${company}`,
    role ? `site:linkedin.com/in ${name} ${role}` : null,
    `site:linkedin.com/in ${name}`,
    domain ? `site:linkedin.com/in ${name} ${domain}` : null,
    role ? `${name} ${role} ${company} linkedin` : `${name} ${company} linkedin`,
  ].filter(Boolean) as string[];

  return [...new Set(queries)];
}

function titlesRoughlyMatch(expected: string, found: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);

  const expectedTokens = new Set(normalize(expected));
  const foundTokens = normalize(found);
  if (expectedTokens.size === 0 || foundTokens.length === 0) return false;

  const overlap = foundTokens.filter((token) => expectedTokens.has(token)).length;
  return overlap >= 1;
}

function isLinkedInProfileUrl(url: string): boolean {
  return /linkedin\.com\/in\//i.test(url) && !/\/company\//i.test(url) && !/\/school\//i.test(url);
}

async function searchSearxngLinkedIn(query: string, maxResults: number): Promise<SearchHit[]> {
  const baseUrl = getSearxngBaseUrl();
  if (!baseUrl) return [];

  const searchUrl = new URL("/search", baseUrl);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("categories", "general");
  searchUrl.searchParams.set("engines", "google,bing,duckduckgo");

  try {
    const response = await fetch(searchUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeadForge/1.0 (linkedin profile research)",
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

    const hits = (body.results ?? [])
      .filter((item) => item.url && isLinkedInProfileUrl(item.url))
      .slice(0, maxResults)
      .map((item) => ({
        title: item.title?.trim() ?? "",
        url: item.url!.trim(),
        content: item.content?.trim() ?? "",
        backend: "searxng" as const,
      }));

    if (hits.length > 0) recordScrapingToolSuccess("searxng");
    return hits;
  } catch (error) {
    log.warn("SearXNG LinkedIn search failed", { query, error: String(error) });
    recordScrapingToolFailure("searxng");
    return [];
  }
}

async function searchBingLinkedIn(query: string, maxResults: number): Promise<SearchHit[]> {
  const encoded = encodeURIComponent(query);
  const page = await fetchPage(`https://www.bing.com/search?q=${encoded}`, {
    respectRobots: false,
    minIntervalMs: 1500,
    timeoutMs: SEARCH_TIMEOUT_MS,
  });

  if (!page?.html) {
    return [];
  }

  const $ = cheerio.load(page.html);
  const hits: SearchHit[] = [];

  $("#b_results .b_algo, .b_algo").each((_, element) => {
    const title = $(element).find("h2 a, a.tilk").first().text().trim();
    let href = $(element).find("h2 a, a.tilk").first().attr("href") ?? "";
    const content = $(element).find(".b_caption p, p.b_lineclamp2").first().text().trim();

    if (!title || !href) return;
    if (!isLinkedInProfileUrl(href)) return;

    hits.push({
      title,
      url: href,
      content,
      backend: "bing",
    });
  });

  return hits.slice(0, maxResults);
}

async function searchDuckDuckGoLinkedIn(query: string, maxResults: number): Promise<SearchHit[]> {
  const results = await searchWeb(query, maxResults);
  return results
    .filter((item) => item.url && isLinkedInProfileUrl(item.url))
    .map((item) => ({
      title: item.title ?? "",
      url: item.url ?? "",
      content: item.content ?? "",
      backend: "duckduckgo" as const,
    }));
}

async function searchAllBackends(query: string): Promise<SearchHit[]> {
  const searxngHits = await searchSearxngLinkedIn(query, 10);
  if (searxngHits.length > 0) return searxngHits;

  const bingHits = await searchBingLinkedIn(query, 10);
  if (bingHits.length > 0) return bingHits;

  return searchDuckDuckGoLinkedIn(query, 10);
}

function scoreLinkedInCandidate(
  input: LinkedInProfileSearchInput,
  hit: SearchHit
): LinkedInProfileSearchResult | null {
  const url = sanitizePersonLinkedInUrl(hit.url);
  if (!url) return null;

  const hitText = `${hit.title} ${hit.content}`.trim();
  const parsed =
    parseLinkedInProfileTitle(hit.title) ??
    (() => {
      const fromSearch = parseLinkedInSearchHit(hit.title, hit.content);
      return fromSearch
        ? {
            fullName: fromSearch.fullName,
            jobTitle: fromSearch.jobTitle,
            affiliationText: hitText,
          }
        : null;
    })();

  const resolvedName = parsed?.fullName ?? input.fullName;
  const headline = parsed?.jobTitle ?? input.jobTitle;

  if (!personNamesMatch(input.fullName, resolvedName) && !personNameAppearsInText(input.fullName, hitText)) {
    return null;
  }

  let confidenceScore = 0;

  if (personNamesMatch(input.fullName, resolvedName)) confidenceScore += 35;
  else if (personNameAppearsInText(input.fullName, hitText)) confidenceScore += 28;

  if (linkedinProfileMatchesPerson(url, input.fullName, input.companyName)) {
    confidenceScore += 22;
  } else if (personNameAppearsInText(input.fullName, hitText)) {
    confidenceScore += 12;
  }

  if (titlesRoughlyMatch(input.jobTitle, headline)) confidenceScore += 18;
  else if (primaryRoleToken(input.jobTitle) && hitText.toLowerCase().includes(primaryRoleToken(input.jobTitle).toLowerCase())) {
    confidenceScore += 10;
  }

  const target: CompanyAffiliationTarget = {
    name: normalizeCompanyNameForSearch(input.companyName),
    domain: input.companyDomain,
  };
  const affiliation = verifyPersonCompanyAffiliation(
    {
      title: headline,
      bioText: hitText,
      source: "linkedin_search",
    },
    target
  );
  const companyMatch =
    affiliation.matches && textMentionsTargetCompany(hitText, target);

  if (companyMatch) confidenceScore += 25;
  else if (textMentionsTargetCompany(hitText, target)) confidenceScore += 12;

  if (confidenceScore < MIN_CONFIDENCE) return null;

  return {
    url,
    fullName: resolvedName,
    headline,
    companyMatch,
    confidenceScore: Math.min(100, confidenceScore),
    source: "public_profile",
    searchBackend: hit.backend,
  };
}

/**
 * Find a person's LinkedIn profile using structured Google/Bing queries.
 * Input: name + company + role → Output: profile URL, headline, company match, confidence.
 */
export async function searchLinkedInProfile(
  input: LinkedInProfileSearchInput
): Promise<LinkedInProfileSearchResult | null> {
  const queries = buildLinkedInProfileSearchQueries(input);
  const candidates: LinkedInProfileSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    const hits = await searchAllBackends(query);

    for (const hit of hits) {
      const candidate = scoreLinkedInCandidate(input, hit);
      if (!candidate || seenUrls.has(candidate.url)) continue;
      seenUrls.add(candidate.url);
      candidates.push(candidate);
    }

    if (candidates.some((entry) => entry.confidenceScore >= HIGH_CONFIDENCE)) {
      break;
    }
  }

  if (candidates.length === 0) {
    log.info("No LinkedIn profile matched search criteria", {
      name: input.fullName,
      company: input.companyName,
      role: input.jobTitle,
    });
    return null;
  }

  candidates.sort((left, right) => right.confidenceScore - left.confidenceScore);
  const best = candidates[0]!;

  log.info("LinkedIn profile discovered via web search", {
    name: input.fullName,
    company: input.companyName,
    role: input.jobTitle,
    url: best.url,
    headline: best.headline,
    companyMatch: best.companyMatch,
    confidenceScore: best.confidenceScore,
    backend: best.searchBackend,
  });

  return best;
}
