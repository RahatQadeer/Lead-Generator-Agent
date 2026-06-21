import { createLogger } from "@/lib/logger";
import { runApifyActorSync } from "@/lib/apify/client";
import { getApifyWebsiteCrawlerActorId, isApifyEnabled } from "@/lib/apify/config";
import { parseContactsFromHtml, type ParsedContact } from "@/lib/scraping/parse-html";

const log = createLogger("apify.website-crawler");

interface WebsiteCrawlerItem {
  url?: string;
  text?: string;
  markdown?: string;
  html?: string;
}

/**
 * Scrape a single page with Apify Website Content Crawler (JS-rendered sites).
 * Used when local Cheerio/Playwright find no people on team pages.
 */
export async function scrapeContactsWithApify(
  pageUrl: string,
  domain: string,
  options?: { companyName?: string }
): Promise<ParsedContact[]> {
  if (!isApifyEnabled()) return [];

  const normalizedUrl = pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`;

  try {
    const items = await runApifyActorSync<WebsiteCrawlerItem>({
      actorId: getApifyWebsiteCrawlerActorId(),
      toolId: "apify-website-crawler",
      maxItems: 3,
      timeoutSec: 90,
      input: {
        startUrls: [{ url: normalizedUrl }],
        maxCrawlDepth: 0,
        maxCrawlPages: 1,
        crawlerType: "playwright:firefox",
      },
    });

    for (const item of items) {
      const html = item.html?.trim();
      const text = item.text?.trim() || item.markdown?.trim();
      const sourceUrl = item.url?.trim() || normalizedUrl;

      if (html && html.length > 200) {
        const contacts = parseContactsFromHtml(html, domain, sourceUrl);
        if (contacts.length > 0) {
          log.info("Apify website crawler found contacts", {
            url: sourceUrl,
            company: options?.companyName,
            count: contacts.length,
          });
          return contacts;
        }
      }

      if (text && text.length > 100) {
        const wrapped = `<html><body><pre>${text}</pre></body></html>`;
        const contacts = parseContactsFromHtml(wrapped, domain, sourceUrl);
        if (contacts.length > 0) {
          log.info("Apify website crawler parsed text contacts", {
            url: sourceUrl,
            count: contacts.length,
          });
          return contacts;
        }
      }
    }

    return [];
  } catch (error) {
    log.warn("Apify website crawler failed", {
      url: normalizedUrl,
      error: String(error),
    });
    return [];
  }
}
