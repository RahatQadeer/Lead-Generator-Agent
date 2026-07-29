import * as cheerio from "cheerio";
import { BaseScraper } from "@/lib/scrapers/base-scraper";
import type {
  ScraperListingSeed,
  ScraperRunContext,
  ScraperRunOptions,
  ScrapedCompanyProfile,
} from "@/lib/scrapers/types";
import {
  normalizeDomain,
  normalizeTags,
  normalizeText,
  normalizeUrl,
} from "@/lib/scrapers/utils/normalize";
import { canFetchUrl } from "@/lib/scraping/robots";
import { FAST_FETCH, fetchPage } from "@/lib/scraping/http-client";
import { fetchPageWithPlaywright } from "@/lib/scraping/playwright-fetch";
import { detectFundingStage } from "@/lib/scraping/funding-stage";

const SAASHUB_BASE = "https://www.saashub.com";
const SAASHUB_LISTINGS = ["/startups", "/featured-products"];

/** First-path segments that are site sections, not product slugs. */
const NON_PRODUCT_SEGMENTS = new Set([
  "startups", "featured-products", "categories", "experts", "community",
  "newsletter", "register", "login", "submit", "compare", "alternatives",
  "funding", "eu", "tech-radar", "status-pages", "product-graveyard",
  "google-graveyard", "about", "pricing", "contact", "blog", "api",
  "sitemap", "privacy", "terms", "all", "best", "replace",
]);

/**
 * Scrapes software startups from SaaSHub. Listing pages are Alpine.js-tabbed, so
 * they are rendered with Playwright; individual product pages are parsed as
 * static HTML. The official website comes from the product's "Visit official
 * website" hero link. Directory data is intentionally sparse (name + website) —
 * the engine's website-enrichment step backfills description/industry/location.
 */
export class SaaSHubScraper extends BaseScraper {
  readonly sourceId = "saashub" as const;
  readonly displayName = "SaaSHub";
  readonly baseUrl = SAASHUB_BASE;

  private isProductSlug(slug: string): boolean {
    if (!slug || slug.includes("/")) return false;
    if (!/^[a-z0-9][a-z0-9-]{1,}$/.test(slug)) return false;
    const head = slug.split("-")[0];
    if (NON_PRODUCT_SEGMENTS.has(slug) || NON_PRODUCT_SEGMENTS.has(head)) return false;
    if (slug.endsWith("-alternatives") || slug.endsWith("-software") || slug.endsWith("-status")) {
      return false;
    }
    return true;
  }

  async collectListingSeeds(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]> {
    const seeds: ScraperListingSeed[] = [];
    const seen = new Set<string>();

    for (const path of SAASHUB_LISTINGS) {
      if (seeds.length >= options.maxCompanies) break;
      this.throwIfAborted(ctx.signal);
      const listingUrl = `${SAASHUB_BASE}${path}`;
      this.reportProgress(ctx, "Collecting SaaSHub startups…", {
        current: seeds.length,
        total: options.maxCompanies,
      });

      const rendered = await fetchPageWithPlaywright(listingUrl, {
        timeoutMs: 25_000,
        respectRobots: options.respectRobots,
        minIntervalMs: options.minIntervalMs,
      });
      if (!rendered?.html) continue;

      const $ = cheerio.load(rendered.html);
      const candidates = new Set<string>();

      // Product cards expose data-service-slug; anchors are the fallback.
      $("[data-service-slug]").each((_, el) => {
        const slug = $(el).attr("data-service-slug")?.trim();
        if (slug) candidates.add(slug);
      });
      $("a[href^='/']").each((_, el) => {
        const slug = ($(el).attr("href") ?? "").replace(/^\//, "").split(/[?#]/)[0];
        if (slug) candidates.add(slug);
      });

      for (const slug of candidates) {
        if (!this.isProductSlug(slug) || seen.has(slug)) continue;
        seen.add(slug);
        seeds.push({
          sourceCompanyId: slug,
          profileUrl: `${SAASHUB_BASE}/${slug}`,
          name: null,
        });
        if (seeds.length >= options.maxCompanies) break;
      }
    }

    return seeds.slice(0, options.maxCompanies);
  }

  async scrapeCompanyProfile(
    seed: ScraperListingSeed,
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScrapedCompanyProfile | null> {
    this.throwIfAborted(ctx.signal);

    if (options.respectRobots) {
      const allowed = await canFetchUrl(seed.profileUrl);
      if (!allowed) return null;
    }

    const http = await fetchPage(seed.profileUrl, {
      ...FAST_FETCH,
      respectRobots: options.respectRobots,
      minIntervalMs: options.minIntervalMs,
    });
    const html = http?.html ?? null;
    if (!html) return null;

    const $ = cheerio.load(html);

    // Name: "<Name> reviews. Is <Name> good? - SaaSHub" → strip suffix.
    const rawTitle = normalizeText($("title").first().text()) ?? "";
    const name =
      normalizeText(rawTitle.split(/ reviews\.| - SaaSHub/i)[0]) ||
      normalizeText(seed.name) ||
      seed.sourceCompanyId;

    const description = normalizeText(
      $("meta[property='og:description']").attr("content") ??
        $("meta[name='description']").attr("content")
    );

    // Official website: the hero "Visit official website" link.
    const visitHref =
      $("a")
        .filter((_, el) => /visit official website/i.test($(el).text()))
        .first()
        .attr("href") ?? null;
    const websiteUrl = this.cleanExternalUrl(visitHref);

    const tags = normalizeTags(
      $("a[href^='/best-'], a[href*='-software']")
        .map((_, el) => normalizeText($(el).text()) ?? "")
        .get()
        .filter((t) => t && t.length < 40)
        .slice(0, 6)
    );

    return {
      source: this.sourceId,
      sourceUrl: seed.profileUrl,
      sourceCompanyId: seed.sourceCompanyId,
      name,
      websiteUrl,
      domain: normalizeDomain(websiteUrl),
      description,
      industry: tags[0] ?? null,
      category: tags[0] ?? "Software / SaaS",
      tags: normalizeTags([...tags, "saashub"]),
      country: null,
      city: null,
      state: null,
      founders: [],
      publicEmail: null,
      publicPhone: null,
      contactPageUrl: null,
      careersPageUrl: null,
      socialLinks: {},
      fundingStage: detectFundingStage(description ?? ""),
      teamSize: null,
      launchDate: null,
      websiteExtras: {},
      scrapedAt: new Date().toISOString(),
      errors: [],
    };
  }

  /** Keep only the canonical site URL, dropping SaaSHub tracking query params. */
  private cleanExternalUrl(href: string | null): string | null {
    if (!href || !/^https?:\/\//i.test(href)) return null;
    try {
      const url = new URL(href);
      if (/saashub\.com$/i.test(url.hostname)) return null;
      return normalizeUrl(`${url.origin}${url.pathname}`);
    } catch {
      return null;
    }
  }
}
