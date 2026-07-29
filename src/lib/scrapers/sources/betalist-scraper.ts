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

const BETALIST_BASE = "https://betalist.com";

/**
 * Scrapes newly launched startups from BetaList. The site is server-rendered
 * (Rails), so listing + profile pages are read as static HTML with Cheerio and
 * only escalate to Playwright when the static fetch is blocked/empty. The
 * official website is resolved from the public `/startups/{slug}/visit`
 * redirect. Collects public info only.
 */
export class BetaListScraper extends BaseScraper {
  readonly sourceId = "betalist" as const;
  readonly displayName = "BetaList";
  readonly baseUrl = BETALIST_BASE;

  async collectListingSeeds(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]> {
    const seeds: ScraperListingSeed[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= options.maxPages; page += 1) {
      this.throwIfAborted(ctx.signal);
      const listingUrl = page === 1 ? `${BETALIST_BASE}/` : `${BETALIST_BASE}/?page=${page}`;
      this.reportProgress(ctx, "Collecting BetaList startups…", {
        current: seeds.length,
        total: options.maxCompanies,
      });

      const html = await this.fetchHtml(listingUrl, options);
      if (!html) break;

      const before = seeds.length;
      const $ = cheerio.load(html);
      $("a[href^='/startups/']").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        const slug = href.replace(/^\/startups\//, "").split(/[/?#]/)[0];
        if (!slug || seen.has(slug)) return;
        seen.add(slug);
        seeds.push({
          sourceCompanyId: slug,
          profileUrl: `${BETALIST_BASE}/startups/${slug}`,
          name: normalizeText($(el).text()) || slug,
        });
      });

      if (seeds.length === before) break; // no new startups → stop paginating
      if (seeds.length >= options.maxCompanies) break;
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

    const html = await this.fetchHtml(seed.profileUrl, options);
    if (!html) return null;

    const $ = cheerio.load(html);
    const name =
      normalizeText($("h1").first().text()) ??
      normalizeText(seed.name) ??
      seed.sourceCompanyId;
    const description = normalizeText(
      $("meta[property='og:description']").attr("content") ??
        $("meta[name='description']").attr("content")
    );
    const tags = normalizeTags(
      $("a[href^='/topics/'], a[href^='/markets/']")
        .map((_, el) => $(el).text())
        .get()
    );
    const websiteUrl = await this.resolveVisitUrl(seed.sourceCompanyId, options);

    return {
      source: this.sourceId,
      sourceUrl: seed.profileUrl,
      sourceCompanyId: seed.sourceCompanyId,
      name,
      websiteUrl,
      domain: normalizeDomain(websiteUrl),
      description,
      industry: tags[0] ?? null,
      category: tags[0] ?? "Startup",
      tags: normalizeTags([...tags, "betalist"]),
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

  /** Static fetch first, Playwright fallback when empty/blocked. */
  private async fetchHtml(
    url: string,
    options: Required<ScraperRunOptions>
  ): Promise<string | null> {
    const http = await fetchPage(url, {
      ...FAST_FETCH,
      respectRobots: options.respectRobots,
      minIntervalMs: options.minIntervalMs,
    });
    if (http?.html && http.html.length > 500) return http.html;

    const rendered = await fetchPageWithPlaywright(url, {
      timeoutMs: 15_000,
      respectRobots: options.respectRobots,
      minIntervalMs: options.minIntervalMs,
    });
    return rendered?.html ?? null;
  }

  /** Follow the single-hop /visit redirect to the startup's official site. */
  private async resolveVisitUrl(
    slug: string,
    options: Required<ScraperRunOptions>
  ): Promise<string | null> {
    const visitUrl = `${BETALIST_BASE}/startups/${slug}/visit`;
    if (options.respectRobots) {
      const allowed = await canFetchUrl(visitUrl);
      if (!allowed) return null;
    }
    try {
      const response = await fetch(visitUrl, {
        method: "HEAD",
        redirect: "manual",
        headers: { "User-Agent": "LeadForgeBot/1.0 (+https://righttail.com)" },
        signal: AbortSignal.timeout(10_000),
      });
      const location = response.headers.get("location");
      if (!location) return null;
      const target = new URL(location, BETALIST_BASE);
      if (/betalist\.com$/i.test(target.hostname)) return null;
      // Drop tracking query (e.g. ?ref=betalist) — keep the canonical site URL.
      return normalizeUrl(`${target.origin}${target.pathname}`);
    } catch {
      return null;
    }
  }
}
