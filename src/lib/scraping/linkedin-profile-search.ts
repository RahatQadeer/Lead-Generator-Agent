import * as cheerio from "cheerio";
import { createLogger } from "@/lib/logger";
import {
  textMentionsTargetCompany,
  verifyPersonCompanyAffiliation,
  linkedInTextNamesOtherEmployer,
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
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";
import type { LinkedInSource } from "@/types/lead";

const log = createLogger("scraping.linkedin-profile-search");

const SEARCH_TIMEOUT_MS = 12_000;
const MIN_CONFIDENCE = 45;
const MIN_CONFIDENCE_WITHOUT_COMPANY = 30;
const FIRST_RESULT_MIN_CONFIDENCE = 28;
const FIRST_RESULT_MIN_CONFIDENCE_WITHOUT_COMPANY = 22;

/** Whether any backend can run LinkedIn profile web search (Google via SearXNG, Bing, or DuckDuckGo). */
export function isLinkedInWebSearchAvailable(): boolean {
  if (getSearxngBaseUrl() && isScrapingToolAvailable("searxng")) return true;
  return isScrapingToolAvailable("duckduckgo");
}

export interface LinkedInProfileSearchInput {
  fullName: string;
  jobTitle: string;
  companyName: string;
  companyDomain?: string | null;
  /**
   * When true (default), reject profiles that do not mention the target company.
   * Set false only for website-verified contacts where name match is enough.
   */
  requireCompanyMatch?: boolean;
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

const ROLE_KEYWORD_STOP = new Set([
  "and",
  "the",
  "of",
  "at",
  "for",
  "with",
  "our",
  "your",
]);

/** Role keywords for manual Google search (e.g. "software engineer full stack developer"). */
export function meaningfulRoleKeywords(jobTitle: string): string {
  const cleaned = jobTitle.trim();
  if (!cleaned || /^team member$/i.test(cleaned)) return "";

  const words = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !ROLE_KEYWORD_STOP.has(word));

  return words.slice(0, 6).join(" ");
}

function roleTextForNaturalSearch(jobTitle: string): string {
  const cleaned = jobTitle.trim();
  if (!cleaned || /^team member$/i.test(cleaned)) return "";

  const executiveMatch = cleaned.match(
    /\b(ceo|cto|cfo|coo|cmo|cpo|founder|co[-\s]?founder|president|director|owner|manager|vp|vice president|chief\s+[\w\s]+officer|head of[\w\s]*|partner)\b/i
  );
  if (executiveMatch?.[0]) return executiveMatch[0];

  return meaningfulRoleKeywords(cleaned);
}

/** Manual Google search: "First Last role keywords linkedin" without company name. */
export function buildNameAndRoleLinkedInQuery(
  fullName: string,
  jobTitle: string
): string | null {
  const name = fullName.trim();
  const rolePart = roleTextForNaturalSearch(jobTitle);
  if (!name || !rolePart) return null;
  return `${name} ${rolePart} linkedin`;
}

/** Natural Google search: name + role + company + linkedin (no site: filter). */
export function buildNaturalLinkedInSearchQuery(
  input: LinkedInProfileSearchInput
): string {
  const name = input.fullName.trim();
  const company = normalizeCompanyNameForSearch(input.companyName);
  const role = input.jobTitle.trim();

  if (role && !/^team member$/i.test(role)) {
    return `${name} ${role} ${company} linkedin`;
  }

  return `${name} ${company} linkedin`;
}

/** Primary Google query: "Name" Role "Company" site:linkedin.com/in */
export function buildPrimaryLinkedInGoogleQuery(
  input: LinkedInProfileSearchInput
): string {
  const name = quoteToken(input.fullName.trim());
  const company = quoteToken(normalizeCompanyNameForSearch(input.companyName));
  const role = primaryRoleToken(input.jobTitle);

  if (role) {
    return `site:linkedin.com/in ${name} ${quoteToken(role)} ${company}`;
  }

  return `site:linkedin.com/in ${name} ${company}`;
}

/** Google/Bing structured queries — natural search first, then site:linkedin.com/in variants. */
export function buildLinkedInProfileSearchQueries(
  input: LinkedInProfileSearchInput
): string[] {
  const name = quoteToken(input.fullName.trim());
  const plainName = input.fullName.trim();
  const company = quoteToken(normalizeCompanyNameForSearch(input.companyName));
  const role = primaryRoleToken(input.jobTitle);
  const fullRole = quoteToken(input.jobTitle.trim());
  const roleKeywords = meaningfulRoleKeywords(input.jobTitle);
  const domain = input.companyDomain?.replace(/^www\./, "").trim();
  const natural = buildNaturalLinkedInSearchQuery(input);
  const primary = buildPrimaryLinkedInGoogleQuery(input);
  const nameAndRole = buildNameAndRoleLinkedInQuery(plainName, input.jobTitle);

  const queries = [
    nameAndRole,
    roleKeywords && roleKeywords !== role ? `${plainName} ${roleKeywords} linkedin` : null,
    fullRole && !/^team member$/i.test(input.jobTitle.trim())
      ? `${plainName} ${input.jobTitle.trim()} linkedin`
      : null,
    fullRole && !/^team member$/i.test(input.jobTitle.trim())
      ? `site:linkedin.com/in ${plainName} ${input.jobTitle.trim()}`
      : null,
    natural,
    primary,
    role ? `${name} ${quoteToken(role)} ${company} linkedin` : null,
    role ? `site:linkedin.com/in ${name} ${role} ${company}` : null,
    fullRole && fullRole !== quoteToken(role)
      ? `site:linkedin.com/in ${name} ${fullRole} ${company}`
      : null,
    `site:linkedin.com/in ${name} ${company}`,
    role ? `site:linkedin.com/in ${name} ${role}` : null,
    nameAndRole ? `site:linkedin.com/in ${plainName} ${roleKeywords}` : null,
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

function linkedInSlugFromUrl(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return (match?.[1] ?? "").toLowerCase().replace(/\/$/, "");
}

function nameAppearsInLinkedInHit(
  input: LinkedInProfileSearchInput,
  hit: Pick<SearchHit, "title" | "url" | "content">
): boolean {
  const hitText = `${hit.title} ${hit.content}`.trim();
  if (personNameAppearsInText(input.fullName, hitText)) return true;

  const url = sanitizePersonLinkedInUrl(hit.url);
  if (!url) return false;
  if (linkedinProfileMatchesPerson(url, input.fullName, input.companyName)) return true;

  const slug = linkedInSlugFromUrl(url);
  if (!slug) return false;

  const parts = input.fullName
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length > 1);
  if (parts.length === 0) return false;
  if (parts.length === 1) return slug.includes(parts[0]);

  return slug.includes(parts[0]) && slug.includes(parts[parts.length - 1]);
}

async function searchSearxngMixed(
  query: string,
  maxResults: number,
  engines?: string
): Promise<SearchHit[]> {
  const baseUrl = getSearxngBaseUrl();
  if (!baseUrl) return [];

  const searchUrl = new URL("/search", baseUrl);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("categories", "general");
  if (engines) searchUrl.searchParams.set("engines", engines);

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

    const hits: SearchHit[] = [];
    for (const item of body.results ?? []) {
      if (!item.url || !item.title) continue;
      hits.push({
        title: item.title.trim(),
        url: item.url.trim(),
        content: item.content?.trim() ?? "",
        backend: "searxng",
      });
      if (hits.length >= maxResults) break;
    }

    if (hits.length > 0) recordScrapingToolSuccess("searxng");
    return hits;
  } catch (error) {
    log.warn("SearXNG mixed search failed", { query, error: String(error) });
    recordScrapingToolFailure("searxng");
    return [];
  }
}

/** Walk Google/SearXNG results in order and keep linkedin.com/in links. */
export function extractLinkedInHitsFromMixedResults(
  results: Array<Pick<SearchHit, "title" | "url" | "content" | "backend">>
): SearchHit[] {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  for (const item of results) {
    let url = item.url?.trim() ?? "";
    if (!url) continue;

    if (!isLinkedInProfileUrl(url)) {
      const linkedInMatch = `${item.title} ${item.content}`.match(
        /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/in\/[^\s"'<>]+/i
      );
      url = linkedInMatch?.[0] ?? "";
    }

    if (!url || !isLinkedInProfileUrl(url)) continue;

    const normalized = sanitizePersonLinkedInUrl(url);
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    hits.push({
      title: item.title?.trim() ?? "",
      url: normalized,
      content: item.content?.trim() ?? "",
      backend: item.backend ?? "searxng",
    });
  }

  return hits;
}

async function searchGoogleLinkedIn(query: string, maxResults: number): Promise<SearchHit[]> {
  const baseUrl = getSearxngBaseUrl();
  if (!baseUrl) return [];

  const searchUrl = new URL("/search", baseUrl);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("categories", "general");
  searchUrl.searchParams.set("engines", "google");

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
    log.warn("Google LinkedIn search failed", { query, error: String(error) });
    recordScrapingToolFailure("searxng");
    return [];
  }
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

async function searchDuckDuckGoMixed(query: string, maxResults: number): Promise<SearchHit[]> {
  const results = await searchWeb(query, maxResults);
  return results.map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    content: item.content ?? "",
    backend: "duckduckgo" as const,
  }));
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
  const useMixedSearch = !/\bsite:/i.test(query);

  if (useMixedSearch && getSearxngBaseUrl()) {
    const googleMixed = extractLinkedInHitsFromMixedResults(
      await searchSearxngMixed(query, 20, "google")
    );
    if (googleMixed.length > 0) return googleMixed;

    const searxngMixed = extractLinkedInHitsFromMixedResults(
      await searchSearxngMixed(query, 20)
    );
    if (searxngMixed.length > 0) return searxngMixed;
  }

  if (useMixedSearch && isScrapingToolAvailable("duckduckgo")) {
    const ddgMixed = extractLinkedInHitsFromMixedResults(
      await searchDuckDuckGoMixed(query, 15)
    );
    if (ddgMixed.length > 0) return ddgMixed;
  }

  if (getSearxngBaseUrl()) {
    const googleHits = await searchGoogleLinkedIn(query, 10);
    if (googleHits.length > 0) return googleHits;

    const searxngHits = await searchSearxngLinkedIn(query, 10);
    if (searxngHits.length > 0) return searxngHits;
  }

  const bingHits = await searchBingLinkedIn(query, 10);
  if (bingHits.length > 0) return bingHits;

  if (isScrapingToolAvailable("duckduckgo")) {
    return searchDuckDuckGoLinkedIn(query, 10);
  }

  return [];
}

/** Exact match: name + company appear in the Google result snippet/title. */
export function isExactLinkedInSearchHit(
  input: LinkedInProfileSearchInput,
  hit: Pick<SearchHit, "title" | "url" | "content">
): boolean {
  const hitText = `${hit.title} ${hit.content}`.trim();
  const target: CompanyAffiliationTarget = {
    name: normalizeCompanyNameForSearch(input.companyName),
    domain: input.companyDomain,
  };

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
  if (
    !personNamesMatch(input.fullName, resolvedName) &&
    !personNameAppearsInText(input.fullName, hitText)
  ) {
    return false;
  }

  if (!textMentionsTargetCompany(hitText, target)) return false;

  return Boolean(sanitizePersonLinkedInUrl(hit.url));
}

function buildLinkedInSearchResult(
  input: LinkedInProfileSearchInput,
  hit: SearchHit,
  options: { exactMatch: boolean; minConfidence: number; allowNameOnlyMatch?: boolean }
): LinkedInProfileSearchResult | null {
  const scored = scoreLinkedInCandidate(input, hit);
  if (scored) {
    return {
      ...scored,
      confidenceScore: options.exactMatch
        ? Math.max(scored.confidenceScore, 90)
        : scored.confidenceScore,
    };
  }

  const url = sanitizePersonLinkedInUrl(hit.url);
  if (!url) return null;

  const hitText = `${hit.title} ${hit.content}`.trim();
  if (!nameAppearsInLinkedInHit(input, hit)) {
    return null;
  }

  const target: CompanyAffiliationTarget = {
    name: normalizeCompanyNameForSearch(input.companyName),
    domain: input.companyDomain,
  };

  if (linkedInTextNamesOtherEmployer(hitText, target)) {
    return null;
  }

  const companyMatch = textMentionsTargetCompany(hitText, target);
  const requireCompany = input.requireCompanyMatch !== false;

  if (requireCompany && !companyMatch) {
    return null;
  }

  if (
    options.allowNameOnlyMatch &&
    !requireCompany &&
    !linkedinProfileMatchesPerson(url, input.fullName, input.companyName) &&
    !personNameAppearsInText(input.fullName, hitText)
  ) {
    return null;
  }

  const parsed = parseLinkedInSearchHit(hit.title, hit.content);
  return {
    url,
    fullName: parsed?.fullName ?? input.fullName,
    headline: parsed?.jobTitle ?? input.jobTitle,
    companyMatch,
    confidenceScore: options.exactMatch ? 92 : options.minConfidence,
    source: "public_profile",
    searchBackend: hit.backend,
  };
}

/**
 * Pick the best LinkedIn URL from ordered Google results:
 * 1) exact name + company (+ role) match, else 2) first valid profile link.
 */
export function pickLinkedInFromOrderedHits(
  input: LinkedInProfileSearchInput,
  hits: SearchHit[]
): LinkedInProfileSearchResult | null {
  for (const hit of hits) {
    if (!isExactLinkedInSearchHit(input, hit)) continue;
    const exact = buildLinkedInSearchResult(input, hit, {
      exactMatch: true,
      minConfidence: 90,
    });
    if (exact) return exact;
  }

  const requireCompany = input.requireCompanyMatch !== false;
  const fallbackMinConfidence = requireCompany
    ? FIRST_RESULT_MIN_CONFIDENCE
    : FIRST_RESULT_MIN_CONFIDENCE_WITHOUT_COMPANY;

  for (const hit of hits) {
    const first = buildLinkedInSearchResult(input, hit, {
      exactMatch: false,
      minConfidence: fallbackMinConfidence,
    });
    if (first) return first;
  }

  if (!requireCompany) {
    for (const hit of hits) {
      const nameMatch = buildLinkedInSearchResult(input, hit, {
        exactMatch: false,
        minConfidence: FIRST_RESULT_MIN_CONFIDENCE_WITHOUT_COMPANY,
        allowNameOnlyMatch: true,
      });
      if (nameMatch) return nameMatch;
    }
  }

  return null;
}

function scoreLinkedInCandidate(
  input: LinkedInProfileSearchInput,
  hit: SearchHit
): LinkedInProfileSearchResult | null {
  const url = sanitizePersonLinkedInUrl(hit.url);
  if (!url) return null;

  const hitText = `${hit.title} ${hit.content}`.trim();
  const target: CompanyAffiliationTarget = {
    name: normalizeCompanyNameForSearch(input.companyName),
    domain: input.companyDomain,
  };

  if (linkedInTextNamesOtherEmployer(hitText, target)) {
    return null;
  }

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

  const requireCompany = input.requireCompanyMatch !== false;
  const minConfidence = requireCompany ? MIN_CONFIDENCE : MIN_CONFIDENCE_WITHOUT_COMPANY;

  if (confidenceScore < minConfidence) {
    if (
      !requireCompany &&
      linkedinProfileMatchesPerson(url, input.fullName, input.companyName) &&
      (personNamesMatch(input.fullName, resolvedName) ||
        personNameAppearsInText(input.fullName, hitText))
    ) {
      confidenceScore = Math.max(confidenceScore, minConfidence);
    } else {
      return null;
    }
  }

  if (requireCompany && !companyMatch) return null;

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
 * Find a person's LinkedIn profile via Google search (name + role + company).
 * Returns an exact-match profile when possible, otherwise the first valid result.
 */
export async function searchLinkedInProfile(
  input: LinkedInProfileSearchInput
): Promise<LinkedInProfileSearchResult | null> {
  if (!isLinkedInWebSearchAvailable()) {
    log.info("LinkedIn web search skipped — no search backend available", {
      name: input.fullName,
      company: input.companyName,
    });
    return null;
  }

  const queries = buildLinkedInProfileSearchQueries(input);

  for (const query of queries) {
    const hits = await searchAllBackends(query);
    const picked = pickLinkedInFromOrderedHits(input, hits);

    if (picked) {
      log.info("LinkedIn profile discovered via web search", {
        name: input.fullName,
        company: input.companyName,
        role: input.jobTitle,
        url: picked.url,
        headline: picked.headline,
        companyMatch: picked.companyMatch,
        confidenceScore: picked.confidenceScore,
        backend: picked.searchBackend,
        query,
      });
      return picked;
    }
  }

  log.info("No LinkedIn profile matched search criteria", {
    name: input.fullName,
    company: input.companyName,
    role: input.jobTitle,
  });

  return null;
}
