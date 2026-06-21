import * as cheerio from "cheerio";
import { createLogger } from "@/lib/logger";
import { isPlausiblePersonName, sanitizePersonLinkedInUrl } from "@/lib/scraping/data-quality";
import { fetchPage } from "@/lib/scraping/http-client";
import type { ParsedContact } from "@/lib/scraping/parse-html";
import { fetchPageWithPlaywright } from "@/lib/scraping/playwright-fetch";
import { getDecisionMakerSearchRoles } from "@/lib/contact-discovery/apply-title-filter";
import { normalizeCompanyNameForSearch } from "@/lib/search/search-name-utils";
import {
  textMentionsTargetCompany,
  verifyPersonCompanyAffiliation,
  type CompanyAffiliationTarget,
} from "@/lib/scraping/company-affiliation";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";
import { parseLinkedInSearchHit } from "@/lib/scraping/leadership-search";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";

const log = createLogger("scraping.linkedin-profile");

const PROFILE_FETCH_TIMEOUT_MS = 15_000;
const MAX_PROFILES_PER_COMPANY = 8;
const MAX_LINKEDIN_SEARCH_QUERIES = 8;

interface SearchHit {
  title: string;
  url: string;
  content: string;
}

export interface LinkedInProfileMetadata {
  fullName: string;
  jobTitle: string;
  affiliationText: string;
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Parse LinkedIn public page / search title: "Name - Title - Company | LinkedIn". */
export function parseLinkedInProfileTitle(rawTitle: string): LinkedInProfileMetadata | null {
  const withoutSuffix = rawTitle.replace(/\s*[|\-–]\s*LinkedIn.*$/i, "").trim();
  if (!withoutSuffix) return null;

  const parts = withoutSuffix.split(/\s*[-–|]\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const fullName = parts[0].replace(/\s*profile$/i, "").trim();
  if (!isPlausiblePersonName(fullName)) return null;

  const jobTitle =
    parts.find(
      (part, index) =>
        index > 0 &&
        part.length > 2 &&
        !/linkedin/i.test(part) &&
        /\b(ceo|cto|cfo|coo|founder|president|director|owner|manager|vp|vice|chief|head|partner|officer|engineering|executive)\b/i.test(
          part
        )
    ) ??
    parts.find((part, index) => index > 0 && part.length > 2 && !/linkedin/i.test(part)) ??
    "Team Member";

  return {
    fullName,
    jobTitle,
    affiliationText: withoutSuffix,
  };
}

export function parseLinkedInProfileFromHtml(html: string): LinkedInProfileMetadata | null {
  const $ = cheerio.load(html);

  const ogTitle = $("meta[property='og:title']").attr("content")?.trim();
  if (ogTitle) {
    const parsed = parseLinkedInProfileTitle(ogTitle);
    if (parsed) {
      const ogDesc = $("meta[property='og:description']").attr("content")?.trim() ?? "";
      return {
        ...parsed,
        affiliationText: [parsed.affiliationText, ogDesc].filter(Boolean).join(" ").slice(0, 500),
      };
    }
  }

  const pageTitle = $("title").first().text().trim();
  if (pageTitle) {
    const parsed = parseLinkedInProfileTitle(pageTitle);
    if (parsed) return parsed;
  }

  for (const element of $("script[type='application/ld+json']").toArray()) {
    try {
      const raw = $(element).html();
      if (!raw) continue;
      const data = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        if (!/Person/i.test(String(record["@type"] ?? ""))) continue;
        const fullName = String(record.name ?? "").trim();
        if (!fullName || !isPlausiblePersonName(fullName)) continue;
        const jobTitle = String(record.jobTitle ?? record.description ?? "Team Member").trim();
        return {
          fullName,
          jobTitle,
          affiliationText: `${fullName} ${jobTitle}`.slice(0, 500),
        };
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  const topCardName =
    $("h1.top-card-layout__title, h1.text-heading-xlarge, h1.inline.t-24").first().text().trim() ||
    $("[class*='top-card'] h1").first().text().trim();
  const topCardTitle =
    $("div.text-body-medium, div.top-card-layout__headline, [class*='headline']").first().text().trim();

  if (topCardName && isPlausiblePersonName(topCardName) && topCardTitle) {
    return {
      fullName: topCardName,
      jobTitle: topCardTitle,
      affiliationText: `${topCardName} ${topCardTitle}`.slice(0, 500),
    };
  }

  return null;
}

function isLinkedInAuthWall(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("authwall") ||
    lower.includes("join linkedin") ||
    lower.includes("sign in to linkedin") ||
    lower.includes("checkpoint/challenge")
  );
}

/** Fetch a public LinkedIn /in/ profile (HTTP, then Playwright). */
export async function fetchLinkedInProfileHtml(url: string): Promise<string | null> {
  const normalized = sanitizePersonLinkedInUrl(url);
  if (!normalized) return null;

  const http = await fetchPage(normalized, {
    respectRobots: false,
    minIntervalMs: 1200,
    timeoutMs: PROFILE_FETCH_TIMEOUT_MS,
  });

  if (http?.html && http.html.length > 800 && !isLinkedInAuthWall(http.html)) {
    return http.html;
  }

  if (!isScrapingToolAvailable("playwright")) return http?.html ?? null;

  const rendered = await fetchPageWithPlaywright(normalized, {
    respectRobots: false,
    minIntervalMs: 1500,
    timeoutMs: PROFILE_FETCH_TIMEOUT_MS,
  });

  if (rendered?.html && !isLinkedInAuthWall(rendered.html)) {
    return rendered.html;
  }

  return null;
}

export async function scrapeLinkedInPublicProfile(
  profileUrl: string
): Promise<LinkedInProfileMetadata | null> {
  const html = await fetchLinkedInProfileHtml(profileUrl);
  if (!html) return null;

  const parsed = parseLinkedInProfileFromHtml(html);
  if (parsed) {
    log.info("LinkedIn profile scraped", {
      url: profileUrl,
      name: parsed.fullName,
      title: parsed.jobTitle,
    });
  }
  return parsed;
}

async function searchLinkedInProfiles(query: string, maxResults: number): Promise<SearchHit[]> {
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
        "User-Agent": "LeadForge/1.0 (linkedin people research)",
      },
      signal: AbortSignal.timeout(PROFILE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      recordScrapingToolFailure("searxng");
      return [];
    }

    const body = (await response.json()) as { results?: SearchHit[] };
    return (body.results ?? [])
      .filter((item) => item.url && /\/in\//i.test(item.url))
      .slice(0, maxResults)
      .map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        content: item.content ?? "",
      }));
  } catch (error) {
    log.warn("LinkedIn profile search failed", { query, error: String(error) });
    recordScrapingToolFailure("searxng");
    return [];
  }
}

function profileFromSearchHit(hit: SearchHit): LinkedInProfileMetadata | null {
  const fromTitle = parseLinkedInSearchHit(hit.title, hit.content);
  if (!fromTitle) return null;
  return {
    fullName: fromTitle.fullName,
    jobTitle: fromTitle.jobTitle,
    affiliationText: `${hit.title} ${hit.content}`.slice(0, 500),
  };
}

function toParsedContact(
  metadata: LinkedInProfileMetadata,
  profileUrl: string
): ParsedContact {
  const { firstName, lastName } = splitName(metadata.fullName);
  const linkedinUrl = sanitizePersonLinkedInUrl(profileUrl);

  return {
    fullName: metadata.fullName,
    firstName,
    lastName,
    title: metadata.jobTitle,
    email: null,
    linkedinUrl,
    source: "page",
    sourceUrl: linkedinUrl ?? profileUrl,
    affiliationText: metadata.affiliationText,
    extractionSource: "linkedin_search",
  };
}

function passesAffiliation(
  metadata: LinkedInProfileMetadata,
  target: CompanyAffiliationTarget
): boolean {
  const affiliation = verifyPersonCompanyAffiliation(
    {
      title: metadata.jobTitle,
      bioText: metadata.affiliationText,
      source: "linkedin_search",
    },
    target
  );

  if (!affiliation.matches) return false;
  return textMentionsTargetCompany(metadata.affiliationText, target);
}

/**
 * Find decision-makers by searching LinkedIn profiles and scraping each /in/ page
 * for name, title, and current company affiliation.
 */
export async function discoverDecisionMakersViaLinkedIn(
  companyName: string,
  jobTitles: string[],
  domain?: string | null,
  options?: {
    broadDecisionMakerSearch?: boolean;
    scrapeProfiles?: boolean;
    maxProfiles?: number;
  }
): Promise<ParsedContact[]> {
  const searchName = normalizeCompanyNameForSearch(companyName);
  const target: CompanyAffiliationTarget = { name: searchName, domain };
  let roles = options?.broadDecisionMakerSearch
    ? [...getDecisionMakerSearchRoles()]
    : jobTitles.map((title) => title.trim()).filter(Boolean).slice(0, 4);

  if (roles.length === 0) {
    roles = ["CEO", "Founder", "Director"];
  }

  const maxProfiles = options?.maxProfiles ?? MAX_PROFILES_PER_COMPANY;
  const scrapeProfiles = options?.scrapeProfiles !== false;
  const profileUrls = new Map<string, SearchHit>();
  let queriesRun = 0;

  const roleQueries = roles.slice(0, 6);
  for (const role of roleQueries) {
    if (profileUrls.size >= maxProfiles || queriesRun >= MAX_LINKEDIN_SEARCH_QUERIES) break;

    const queries = [
      `site:linkedin.com/in ${role} "${searchName}"`,
      domain ? `site:linkedin.com/in ${role} ${domain.replace(/^www\./, "")}` : null,
      `"${searchName}" ${role} site:linkedin.com/in`,
    ].filter(Boolean) as string[];

    for (const query of queries) {
      if (profileUrls.size >= maxProfiles || queriesRun >= MAX_LINKEDIN_SEARCH_QUERIES) break;
      queriesRun += 1;

      const hits = await searchLinkedInProfiles(query, 8);
      for (const hit of hits) {
        const url = sanitizePersonLinkedInUrl(hit.url);
        if (!url || profileUrls.has(url)) continue;
        profileUrls.set(url, hit);
      }
    }
  }

  if (profileUrls.size === 0 && domain) {
    const companyPageQuery = `"${searchName}" (CEO OR founder OR president OR director) site:linkedin.com/in`;
    const hits = await searchLinkedInProfiles(companyPageQuery, 10);
    for (const hit of hits) {
      const url = sanitizePersonLinkedInUrl(hit.url);
      if (!url || profileUrls.has(url)) continue;
      profileUrls.set(url, hit);
      if (profileUrls.size >= maxProfiles) break;
    }
  }

  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();

  for (const [profileUrl, hit] of profileUrls) {
    if (contacts.length >= maxProfiles) break;

    let metadata: LinkedInProfileMetadata | null = null;

    if (scrapeProfiles) {
      metadata = await scrapeLinkedInPublicProfile(profileUrl);
    }

    if (!metadata) {
      metadata = profileFromSearchHit(hit);
    }

    if (metadata && !passesAffiliation(metadata, target)) {
      metadata = {
        ...metadata,
        affiliationText: `${metadata.affiliationText} ${hit.title} ${hit.content}`.slice(0, 500),
      };
    }

    if (!metadata || !passesAffiliation(metadata, target)) {
      log.info("Rejected LinkedIn profile — affiliation mismatch", {
        company: companyName,
        url: profileUrl,
        name: metadata?.fullName,
      });
      continue;
    }

    const key = `${metadata.fullName.toLowerCase()}|${metadata.jobTitle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    contacts.push(toParsedContact(metadata, profileUrl));
  }

  if (contacts.length > 0) {
    log.info("LinkedIn decision-makers discovered", {
      company: companyName,
      searched: profileUrls.size,
      matched: contacts.length,
    });
  }

  return contacts;
}
