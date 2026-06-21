import { createLogger } from "@/lib/logger";
import { scrapeContactsWithApify } from "@/lib/apify/website-crawler";
import { extractContactsWithAi } from "@/lib/scraping/ai-page-extraction";
import {
  FAST_FETCH,
  fetchPage,
  type FetchPageOptions,
  type FetchPageResult,
} from "@/lib/scraping/http-client";
import { shouldTryPlaywrightFallback } from "@/lib/scraping/js-detection";
import { fetchPageWithPlaywright } from "@/lib/scraping/playwright-fetch";
import {
  parseCompanyMetadata,
  parseContactsFromHtml,
  type ParsedCompanyMetadata,
  type ParsedContact,
} from "@/lib/scraping/parse-html";

const log = createLogger("scraping.scrape-page");

export type ScrapeSource = "http" | "playwright" | "ai" | "apify";

export interface ScrapeContactsContext {
  companyName?: string;
  /** Skip OpenRouter AI fallback (faster Step 2 people discovery). */
  skipAi?: boolean;
  /** Use Apify Website Content Crawler when local scraping finds nobody. */
  useApify?: boolean;
}

export interface ScrapePageResult {
  url: string;
  html: string;
  source: ScrapeSource;
}

async function fetchWithPlaywrightFallback(
  url: string,
  httpResult: FetchPageResult | null,
  hasUsefulData: boolean,
  options: FetchPageOptions
): Promise<ScrapePageResult | null> {
  if (!shouldTryPlaywrightFallback(httpResult?.html ?? null, hasUsefulData)) {
    if (!httpResult) return null;
    return { url: httpResult.url, html: httpResult.html, source: "http" };
  }

  log.info("Cheerio found no data — trying Playwright fallback", { url });

  const rendered = await fetchPageWithPlaywright(url, options);
  if (!rendered) {
    if (!httpResult) return null;
    return { url: httpResult.url, html: httpResult.html, source: "http" };
  }

  return { url: rendered.url, html: rendered.html, source: "playwright" };
}

/** Fetch a page: fast HTTP first, Playwright when Cheerio would see an empty SPA shell. */
export async function scrapePageHtml(
  url: string,
  options: FetchPageOptions = FAST_FETCH
): Promise<ScrapePageResult | null> {
  const httpResult = await fetchPage(url, options);
  const hasContent = Boolean(httpResult?.html && httpResult.html.length > 200);

  return fetchWithPlaywrightFallback(url, httpResult, hasContent, options);
}

/** Scrape contacts from a URL using Cheerio, with Playwright + AI fallbacks for JS sites. */
export async function scrapeContactsFromUrl(
  url: string,
  domain: string,
  options: FetchPageOptions = FAST_FETCH,
  context?: ScrapeContactsContext
): Promise<{ contacts: ParsedContact[]; source: ScrapeSource | null }> {
  const httpResult = await fetchPage(url, options);
  if (!httpResult) {
    return { contacts: [], source: null };
  }

  let contacts = parseContactsFromHtml(httpResult.html, domain, httpResult.url);

  if (contacts.length > 0) {
    return { contacts, source: "http" };
  }

  const tryPlaywright = shouldTryPlaywrightFallback(httpResult.html, false);

  if (tryPlaywright) {
    const rendered = await fetchPageWithPlaywright(url, options);
    if (rendered) {
      contacts = parseContactsFromHtml(rendered.html, domain, rendered.url);
      if (contacts.length > 0) {
        return { contacts, source: "playwright" };
      }

      if (!context?.skipAi) {
        const aiContacts = await extractContactsWithAi(rendered.html, {
          companyName: context?.companyName ?? domain,
          domain,
          sourceUrl: rendered.url,
        });
        if (aiContacts.length > 0) {
          return { contacts: aiContacts, source: "ai" };
        }
      }
    }
  } else if (!context?.skipAi && httpResult.html.length > 400) {
    const aiContacts = await extractContactsWithAi(httpResult.html, {
      companyName: context?.companyName ?? domain,
      domain,
      sourceUrl: httpResult.url,
    });
    if (aiContacts.length > 0) {
      return { contacts: aiContacts, source: "ai" };
    }
  }

  if (context?.useApify) {
    const apifyContacts = await scrapeContactsWithApify(url, domain, {
      companyName: context.companyName,
    });
    if (apifyContacts.length > 0) {
      return { contacts: apifyContacts, source: "apify" };
    }
  }

  return { contacts: [], source: "http" };
}

/** Scrape company metadata (name, description, emails, phones, LinkedIn) from a URL. */
export async function scrapeCompanyMetadataFromUrl(
  url: string,
  domain: string,
  options: FetchPageOptions = {}
): Promise<{ metadata: ParsedCompanyMetadata | null; source: ScrapeSource | null }> {
  const httpResult = await fetchPage(url, options);
  let metadata = httpResult
    ? parseCompanyMetadata(httpResult.html, domain)
    : null;

  const hasUsefulData = Boolean(
    metadata &&
      (metadata.description ||
        metadata.emails.length > 0 ||
        metadata.socialLinks.linkedin ||
        metadata.title)
  );

  const page = await fetchWithPlaywrightFallback(
    url,
    httpResult,
    hasUsefulData,
    options
  );

  if (!page) return { metadata, source: httpResult ? "http" : null };

  metadata = parseCompanyMetadata(page.html, domain);
  return { metadata, source: page.source };
}
