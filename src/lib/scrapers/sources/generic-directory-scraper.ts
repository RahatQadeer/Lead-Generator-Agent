import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { BaseScraper } from "@/lib/scrapers/base-scraper";
import type {
  ScraperListingSeed,
  ScraperRunContext,
  ScraperRunOptions,
  ScraperSourceId,
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

/** Hostnames that are never a company's own official website. */
const NON_WEBSITE_HOSTS =
  /(facebook|twitter|x|linkedin|instagram|youtube|github|crunchbase|angel|wellfound|producthunt|similarweb|ahrefs|moz|reddit|medium|t\.co|bit\.ly|google|apple|play\.google)\./i;

export interface GenericScraperConfig {
  sourceId: ScraperSourceId;
  displayName: string;
  baseUrl: string;
  /** Listing pages to visit, relative to baseUrl (e.g. ["/companies"]). */
  listingPaths: string[];
  /** Matches href values that point at a company/profile page. */
  profileLinkPattern: RegExp;
  /** Default category label when the page exposes no clearer signal. */
  category: string;
  /** Listing pages are JS-rendered → use Playwright instead of static fetch. */
  renderListing?: boolean;
  /** Profile pages are JS-rendered → use Playwright instead of static fetch. */
  renderProfile?: boolean;
}

/**
 * Configurable directory scraper for sources that expose standard public
 * company profile pages (Open Graph / semantic HTML). One source == one thin
 * subclass supplying a {@link GenericScraperConfig}; no engine changes needed.
 *
 * Collects only public fields (name, description, official website, socials,
 * tags) and always honors robots.txt via the shared fetchers. Sources gated by
 * {@link ../source-policy} stay disabled until explicitly opted in.
 */
export abstract class GenericDirectoryScraper extends BaseScraper {
  readonly sourceId: ScraperSourceId;
  readonly displayName: string;
  readonly baseUrl: string;
  protected readonly config: GenericScraperConfig;

  constructor(config: GenericScraperConfig) {
    super();
    this.config = config;
    this.sourceId = config.sourceId;
    this.displayName = config.displayName;
    this.baseUrl = config.baseUrl;
  }

  async collectListingSeeds(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]> {
    const seeds: ScraperListingSeed[] = [];
    const seen = new Set<string>();

    for (const path of this.config.listingPaths) {
      if (seeds.length >= options.maxCompanies) break;
      this.throwIfAborted(ctx.signal);

      const listingUrl = new URL(path, this.config.baseUrl).toString();
      this.reportProgress(ctx, `Collecting ${this.displayName} listings…`, {
        current: seeds.length,
        total: options.maxCompanies,
      });

      const html = await this.fetchHtml(listingUrl, options, this.config.renderListing ?? true);
      if (!html) continue;

      const $ = cheerio.load(html);
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        if (!this.config.profileLinkPattern.test(href)) return;
        let absolute: string;
        try {
          absolute = new URL(href, this.config.baseUrl).toString().split(/[?#]/)[0];
        } catch {
          return;
        }
        if (seen.has(absolute)) return;
        seen.add(absolute);
        seeds.push({
          sourceCompanyId: absolute.replace(/\/$/, "").split("/").pop() ?? absolute,
          profileUrl: absolute,
          name: normalizeText($(el).text()),
        });
      });

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

    const html = await this.fetchHtml(
      seed.profileUrl,
      options,
      this.config.renderProfile ?? false
    );
    if (!html) return null;

    const $ = cheerio.load(html);
    const name =
      normalizeText($("meta[property='og:title']").attr("content")) ??
      normalizeText($("h1").first().text()) ??
      normalizeText(seed.name) ??
      seed.sourceCompanyId;
    const description = normalizeText(
      $("meta[property='og:description']").attr("content") ??
        $("meta[name='description']").attr("content")
    );
    const websiteUrl = this.extractWebsite($, seed.profileUrl);
    const socialLinks = this.extractSocials($);
    const tags = this.extractTags($);

    return {
      source: this.sourceId,
      sourceUrl: seed.profileUrl,
      sourceCompanyId: seed.sourceCompanyId,
      name,
      websiteUrl,
      domain: normalizeDomain(websiteUrl),
      description,
      industry: tags[0] ?? null,
      category: tags[0] ?? this.config.category,
      tags: normalizeTags([...tags, this.sourceId]),
      country: null,
      city: null,
      state: null,
      founders: [],
      publicEmail: null,
      publicPhone: null,
      contactPageUrl: null,
      careersPageUrl: null,
      socialLinks,
      fundingStage: detectFundingStage(description ?? ""),
      teamSize: null,
      launchDate: null,
      websiteExtras: {},
      scrapedAt: new Date().toISOString(),
      errors: [],
    };
  }

  /** Static fetch first, Playwright when required or when static is empty. */
  protected async fetchHtml(
    url: string,
    options: Required<ScraperRunOptions>,
    render: boolean
  ): Promise<string | null> {
    if (!render) {
      const http = await fetchPage(url, {
        ...FAST_FETCH,
        respectRobots: options.respectRobots,
        minIntervalMs: options.minIntervalMs,
      });
      if (http?.html && http.html.length > 500) return http.html;
    }
    const rendered = await fetchPageWithPlaywright(url, {
      timeoutMs: 25_000,
      respectRobots: options.respectRobots,
      minIntervalMs: options.minIntervalMs,
    });
    return rendered?.html ?? null;
  }

  /** Prefer an explicit "visit website" link, else the first external non-social link. */
  protected extractWebsite($: CheerioAPI, profileUrl: string): string | null {
    const profileHost = safeHost(profileUrl);

    const labelled = $("a[href^='http']")
      .filter((_, el) => /visit|website|official|homepage/i.test($(el).text()))
      .map((_, el) => $(el).attr("href") ?? "")
      .get();
    for (const href of labelled) {
      const clean = this.cleanExternal(href, profileHost);
      if (clean) return clean;
    }

    const external = $("a[href^='http']")
      .map((_, el) => $(el).attr("href") ?? "")
      .get();
    for (const href of external) {
      const clean = this.cleanExternal(href, profileHost);
      if (clean) return clean;
    }
    return null;
  }

  protected cleanExternal(href: string, profileHost: string | null): string | null {
    const host = safeHost(href);
    if (!host) return null;
    if (profileHost && host === profileHost) return null;
    if (NON_WEBSITE_HOSTS.test(`${host}.`)) return null;
    try {
      const url = new URL(href);
      return normalizeUrl(`${url.origin}${url.pathname}`);
    } catch {
      return null;
    }
  }

  protected extractSocials($: CheerioAPI) {
    const find = (pattern: RegExp) =>
      normalizeUrl(
        $("a[href]")
          .map((_, el) => $(el).attr("href") ?? "")
          .get()
          .find((href) => pattern.test(href)) ?? null
      );
    return {
      linkedin: find(/linkedin\.com\/(company|in)\//i),
      twitter: find(/(twitter|x)\.com\//i),
      facebook: find(/facebook\.com\//i),
      github: find(/github\.com\//i),
    };
  }

  protected extractTags($: CheerioAPI): string[] {
    return normalizeTags(
      $("[class*='tag'], [class*='category'], [class*='pill'], [class*='industry']")
        .map((_, el) => normalizeText($(el).text()) ?? "")
        .get()
        .filter((t) => t && t.length < 40)
        .slice(0, 8)
    );
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
