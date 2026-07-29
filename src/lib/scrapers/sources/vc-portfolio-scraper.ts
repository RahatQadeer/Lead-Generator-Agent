import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";
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

/** Hosts that are never a portfolio company's own website. */
const NON_COMPANY_HOSTS =
  /(facebook|twitter|x|linkedin|instagram|youtube|github|crunchbase|angel|wellfound|medium|t\.co|bit\.ly|google|apple|play\.google|youtu\.be|vimeo|spotify)\./i;

export interface VcPortfolioConfig {
  sourceId: ScraperSourceId;
  displayName: string;
  baseUrl: string;
  /** Firm / program that backs every company listed here (the investor). */
  firm: string;
  /** Portfolio listing pages, relative to baseUrl (e.g. ["/portfolio/"]). */
  portfolioPaths: string[];
  /** Default industry/category label for this firm's companies. */
  category?: string;
  /** Portfolio grids are almost always JS-rendered → Playwright by default. */
  renderListing?: boolean;
  /**
   * Optional: when the firm links to internal profile pages instead of external
   * company sites, match those hrefs (e.g. /companies/{slug}).
   */
  profileLinkPattern?: RegExp;
}

interface PortfolioEntry {
  id: string;
  name: string;
  websiteUrl: string | null;
  profileUrl: string;
}

/**
 * Scrapes a venture firm's / accelerator's public portfolio page — a grid of
 * funded companies. Each entry yields the company name + its official website
 * (external link), and the firm is stamped as the investor. Description,
 * industry, founders, and HQ are filled downstream by website enrichment.
 *
 * Collects only public listing data and honors robots.txt via the shared
 * fetchers. Sources gated by {@link ../source-policy} stay off until opted in.
 */
export abstract class VcPortfolioScraper extends BaseScraper {
  readonly sourceId: ScraperSourceId;
  readonly displayName: string;
  readonly baseUrl: string;
  protected readonly config: VcPortfolioConfig;

  /** Run-scoped cache so a profile is built without a second network round-trip. */
  private readonly entries = new Map<string, PortfolioEntry>();

  constructor(config: VcPortfolioConfig) {
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
    const seenKey = new Set<string>();

    for (const path of this.config.portfolioPaths) {
      if (seeds.length >= options.maxCompanies) break;
      this.throwIfAborted(ctx.signal);

      const listingUrl = new URL(path, this.config.baseUrl).toString();
      this.reportProgress(ctx, `Collecting ${this.displayName} portfolio…`, {
        current: seeds.length,
        total: options.maxCompanies,
      });

      const html = await this.fetchHtml(
        listingUrl,
        options,
        this.config.renderListing ?? true
      );
      if (!html) continue;

      const $ = cheerio.load(html);
      const found = this.config.profileLinkPattern
        ? this.extractInternalEntries($, listingUrl)
        : this.extractExternalEntries($);

      for (const entry of found) {
        const key = entry.websiteUrl
          ? normalizeDomain(entry.websiteUrl) ?? entry.name.toLowerCase()
          : entry.name.toLowerCase();
        if (seenKey.has(key)) continue;
        seenKey.add(key);

        this.entries.set(entry.id, entry);
        seeds.push({
          sourceCompanyId: entry.id,
          profileUrl: entry.profileUrl,
          name: entry.name,
        });
        if (seeds.length >= options.maxCompanies) break;
      }
    }

    return seeds.slice(0, options.maxCompanies);
  }

  async scrapeCompanyProfile(
    seed: ScraperListingSeed,
    _ctx: ScraperRunContext,
    _options: Required<ScraperRunOptions>
  ): Promise<ScrapedCompanyProfile | null> {
    const entry = this.entries.get(seed.sourceCompanyId);
    if (!entry) return null;

    const websiteUrl = entry.websiteUrl;
    return {
      source: this.sourceId,
      sourceUrl: seed.profileUrl,
      sourceCompanyId: seed.sourceCompanyId,
      name: entry.name,
      websiteUrl,
      domain: normalizeDomain(websiteUrl),
      description: null,
      industry: this.config.category ?? null,
      category: this.config.category ?? "Venture-backed startup",
      tags: normalizeTags([this.sourceId, "venture-backed"]),
      country: null,
      city: null,
      state: null,
      founders: [],
      publicEmail: null,
      publicPhone: null,
      contactPageUrl: null,
      careersPageUrl: null,
      socialLinks: {},
      fundingStage: detectFundingStage(entry.name),
      // The firm backing this portfolio is a public, known investor.
      investors: [this.config.firm],
      teamSize: null,
      launchDate: null,
      websiteExtras: {},
      scrapedAt: new Date().toISOString(),
      errors: [],
    };
  }

  /** Cards that link directly to companies' own websites (the common case). */
  protected extractExternalEntries($: CheerioAPI): PortfolioEntry[] {
    const firmHost = safeHost(this.config.baseUrl);
    const out: PortfolioEntry[] = [];

    $("a[href^='http']").each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr("href") ?? "";
      const host = safeHost(href);
      if (!host) return;
      // Skip the firm's own site and its subdomains (nav/footer/jobs/crypto links),
      // which are never portfolio companies.
      if (firmHost && (host === firmHost || host.endsWith(`.${firmHost}`))) return;
      if (NON_COMPANY_HOSTS.test(`${host}.`)) return;

      const name = this.entryName(anchor, host);
      if (!name) return;

      const website = normalizeUrl(href);
      out.push({
        id: normalizeDomain(website) ?? host,
        name,
        websiteUrl: website,
        profileUrl: website ?? this.config.baseUrl,
      });
    });

    return out;
  }

  /** Cards that link to the firm's own internal profile pages. */
  protected extractInternalEntries($: CheerioAPI, listingUrl: string): PortfolioEntry[] {
    const pattern = this.config.profileLinkPattern!;
    const out: PortfolioEntry[] = [];

    $("a[href]").each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr("href") ?? "";
      if (!pattern.test(href)) return;
      let absolute: string;
      try {
        absolute = new URL(href, listingUrl).toString().split(/[?#]/)[0];
      } catch {
        return;
      }
      const name = this.entryName(anchor, null);
      if (!name) return;
      out.push({
        id: absolute.replace(/\/$/, "").split("/").pop() ?? absolute,
        name,
        websiteUrl: null,
        profileUrl: absolute,
      });
    });

    return out;
  }

  /** Best-effort company name from a card: text, heading, alt, or aria-label. */
  private entryName(anchor: Cheerio<Element>, hostFallback: string | null): string | null {
    const candidates = [
      normalizeText(anchor.attr("aria-label")),
      normalizeText(anchor.find("h1,h2,h3,h4,h5,figcaption").first().text()),
      normalizeText(anchor.find("img").first().attr("alt")),
      normalizeText(anchor.text()),
    ];
    const name = candidates.find((c) => c && c.length >= 2 && c.length <= 60);
    if (name) return name.replace(/\s+/g, " ");
    // Fall back to the domain's second-level label (e.g. "stripe.com" → "Stripe").
    if (hostFallback) {
      const label = hostFallback.split(".")[0];
      if (label && label.length >= 2) return label.charAt(0).toUpperCase() + label.slice(1);
    }
    return null;
  }

  protected async fetchHtml(
    url: string,
    options: Required<ScraperRunOptions>,
    render: boolean
  ): Promise<string | null> {
    if (options.respectRobots) {
      const allowed = await canFetchUrl(url);
      if (!allowed) {
        this.logWarn("Portfolio page blocked by robots.txt", { url });
        return null;
      }
    }
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
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
