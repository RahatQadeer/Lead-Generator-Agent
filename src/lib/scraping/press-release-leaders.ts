import * as cheerio from "cheerio";
import { createLogger } from "@/lib/logger";
import { isPlausiblePersonName } from "@/lib/scraping/data-quality";
import { FAST_FETCH, fetchPage } from "@/lib/scraping/http-client";
import { normalizeWebsiteUrl } from "@/lib/scraping/extract-domain";
import type { ParsedContact } from "@/lib/scraping/parse-html";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";
import {
  recordScrapingToolFailure,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";

const log = createLogger("scraping.press-release-leaders");

const EXECUTIVE_TITLE_PATTERN =
  /\b(ceo|cto|cfo|coo|cmo|cpo|founder|co[-\s]?founder|president|director|owner|manager|vp|vice president|chief|head of|officer|executive)\b/i;

const PRESS_PATH_PATTERN =
  /\/(awards|news|press|media|blog|events|speakers|announcements|insights|stories)\//i;

const PRESS_LINK_PATTERN =
  /(awards|news|press|executive|leadership|channel chief|vice president|president|ceo|officer|director|speakers|management team)/i;

const MAX_PRESS_PAGES = 5;
const SEARCH_TIMEOUT_MS = 12_000;

function decodeEntities(text: string): string {
  return text
    .replace(/&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function looksLikeExecutiveTitle(title: string): boolean {
  return EXECUTIVE_TITLE_PATTERN.test(title);
}

function parseNameTitleLine(line: string): { fullName: string; title: string } | null {
  const cleaned = decodeEntities(line).replace(/:\s*$/, "").trim();
  const match = cleaned.match(
    /^([A-Z][A-Za-z.'\u2019-]+(?:\s+[A-Z]\.?[A-Za-z.'\u2019-]+){0,4})\s*,\s*(.+)$/
  );
  if (!match) return null;

  const fullName = decodeEntities(match[1].trim());
  const title = decodeEntities(match[2].trim());
  if (!isPlausiblePersonName(fullName)) return null;
  if (!looksLikeExecutiveTitle(title)) return null;

  return { fullName, title };
}

export function isLeadershipPressUrl(url: string): boolean {
  try {
    const path = new URL(url.startsWith("http") ? url : `https://${url}`).pathname.toLowerCase();
    return PRESS_PATH_PATTERN.test(`${path}/`);
  } catch {
    return false;
  }
}

/**
 * Extract decision-makers from press releases, awards pages, and speaker bios.
 * Handles patterns like "<b>Jane Doe, Vice President</b>:" and "said John Smith, CEO".
 */
export function parseLeadershipFromPressHtml(
  html: string,
  sourceUrl?: string
): ParsedContact[] {
  const $ = cheerio.load(html);
  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();

  function addContact(fullName: string, title: string, affiliationText: string) {
    const normalizedName = fullName.replace(/\u2019/g, "'");
    const key = normalizedName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const { firstName, lastName } = splitName(normalizedName);
    contacts.push({
      fullName: normalizedName,
      firstName,
      lastName,
      title,
      email: null,
      linkedinUrl: null,
      source: "page",
      sourceUrl: sourceUrl ?? null,
      affiliationText: affiliationText.slice(0, 500),
      extractionSource: "website_team",
    });
  }

  $("p b, p strong, li b, li strong, a b, a strong, h3 b, h3 strong, h4 b, h4 strong").each(
    (_, element) => {
      const parsed = parseNameTitleLine($(element).text());
      if (!parsed) return;
      const context = $(element).closest("p, li, div").text().slice(0, 400);
      addContact(parsed.fullName, parsed.title, context);
    }
  );

  $("p, li").each((_, element) => {
    const text = decodeEntities($(element).text());
    for (const match of text.matchAll(
      /\bsaid\s+([A-Z][A-Za-z.'\u2019-]+(?:\s+[A-Z]\.?[A-Za-z.'\u2019-]+){0,4}),\s*([^".]+?)(?:\.|\s+"|$)/gi
    )) {
      const fullName = match[1]?.trim();
      let title = match[2]?.trim() ?? "";
      title = title.replace(/\s+(said|noted|added)$/i, "").trim();
      if (!fullName || !title || !isPlausiblePersonName(fullName)) continue;
      if (!looksLikeExecutiveTitle(title)) continue;
      addContact(fullName, title, text);
    }
  });

  const bodyText = decodeEntities($("body").text()).slice(0, 12_000);
  for (const match of bodyText.matchAll(
    /\b([A-Z][a-z]+(?:\s+[A-Z]\.?[a-z]+){1,3}),\s*(Vice President[^.:]{0,60}|President[^.:]{0,40}|Chief [A-Za-z ]{3,40} Officer|CEO|CTO|CFO|COO|Sales Director|Managing Director|Director of [A-Za-z ]{2,40})\b/g
  )) {
    const fullName = match[1]?.trim();
    const title = match[2]?.trim();
    if (!fullName || !title || !isPlausiblePersonName(fullName)) continue;
    addContact(fullName, title, bodyText);
  }

  return contacts;
}

async function searchPressPages(domain: string, companyName: string): Promise<string[]> {
  const baseUrl = getSearxngBaseUrl();
  if (!baseUrl) return [];

  const cleanDomain = domain.replace(/^www\./, "");
  const queries = [
    `site:${cleanDomain} ("vice president" OR executives OR leadership OR CEO OR "channel chiefs")`,
    `site:${cleanDomain} awards executives`,
    `"${companyName}" site:${cleanDomain} (president OR director OR founder)`,
  ];

  const urls = new Set<string>();

  for (const query of queries) {
    const searchUrl = new URL("/search", baseUrl);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("categories", "general");

    try {
      const response = await fetch(searchUrl.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "LeadForge/1.0 (press leadership research)",
        },
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        recordScrapingToolFailure("searxng");
        continue;
      }

      const body = (await response.json()) as {
        results?: Array<{ url?: string; title?: string; content?: string }>;
      };

      for (const item of body.results ?? []) {
        const rawUrl = item.url?.trim();
        if (!rawUrl) continue;
        let host = "";
        try {
          host = new URL(rawUrl).hostname.replace(/^www\./, "");
        } catch {
          continue;
        }
        if (host !== cleanDomain && !host.endsWith(`.${cleanDomain}`)) continue;
        if (!PRESS_PATH_PATTERN.test(rawUrl) && !PRESS_LINK_PATTERN.test(`${item.title ?? ""} ${item.content ?? ""}`)) {
          continue;
        }
        urls.add(rawUrl.split("#")[0] ?? rawUrl);
      }

      if (urls.size > 0) recordScrapingToolSuccess("searxng");
    } catch (error) {
      log.warn("Press page search failed", { query, error: String(error) });
      recordScrapingToolFailure("searxng");
    }
  }

  return [...urls].slice(0, MAX_PRESS_PAGES);
}

async function discoverPressLinksFromHomepage(domain: string): Promise<string[]> {
  const origin = normalizeWebsiteUrl(domain);
  const page = await fetchPage(origin, FAST_FETCH);
  if (!page?.html) return [];

  const $ = cheerio.load(page.html);
  const urls = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;

    try {
      const resolved = new URL(href, origin);
      if (resolved.hostname.replace(/^www\./, "") !== new URL(origin).hostname.replace(/^www\./, "")) {
        return;
      }
      const combined = `${resolved.pathname} ${$(element).text()}`.toLowerCase();
      if (!PRESS_PATH_PATTERN.test(`${resolved.pathname}/`)) return;
      if (!PRESS_LINK_PATTERN.test(combined)) return;
      urls.add(resolved.toString().split("#")[0] ?? resolved.toString());
    } catch {
      // ignore bad href
    }
  });

  return [...urls].slice(0, MAX_PRESS_PAGES);
}

/** Find executives named on company press releases, awards, and event speaker pages. */
export async function discoverLeadershipFromPressPages(
  companyName: string,
  domain: string
): Promise<ParsedContact[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "");
  const [fromSearch, fromHomepage] = await Promise.all([
    searchPressPages(cleanDomain, companyName),
    discoverPressLinksFromHomepage(cleanDomain),
  ]);

  const pageUrls = [...new Set([...fromSearch, ...fromHomepage])].slice(0, MAX_PRESS_PAGES);
  if (pageUrls.length === 0) return [];

  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();

  for (const pageUrl of pageUrls) {
    const page = await fetchPage(pageUrl, {
      ...FAST_FETCH,
      respectRobots: true,
      minIntervalMs: 600,
    });
    if (!page?.html) continue;

    for (const person of parseLeadershipFromPressHtml(page.html, pageUrl)) {
      const key = person.fullName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      contacts.push(person);
    }
  }

  if (contacts.length > 0) {
    log.info("Press release leadership discovered", {
      company: companyName,
      domain: cleanDomain,
      pages: pageUrls.length,
      count: contacts.length,
    });
  }

  return contacts;
}
