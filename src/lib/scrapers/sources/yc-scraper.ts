import axios from "axios";
import * as cheerio from "cheerio";
import { BaseScraper } from "@/lib/scrapers/base-scraper";
import type {
  ScraperListingSeed,
  ScraperRunContext,
  ScraperRunOptions,
  ScrapedCompanyProfile,
} from "@/lib/scrapers/types";
import { normalizeDomain, normalizeTags, normalizeText, normalizeUrl } from "@/lib/scrapers/utils/normalize";
import { normalizeScraperFilters } from "@/lib/scrapers/filters";
import { extractYcFoundersFromHtml } from "@/lib/scrapers/utils/extract-yc-founders";
import type { ScraperFounder } from "@/lib/scrapers/types";
import {
  buildYcCompaniesListingUrl,
  ycIndustriesForSearch,
  ycRegionsForCountry,
} from "@/lib/scrapers/sources/yc-algolia-facets";
import { withRetry } from "@/lib/scrapers/utils/retry";
import { canFetchUrl } from "@/lib/scraping/robots";
import { fetchPageWithPlaywright } from "@/lib/scraping/playwright-fetch";
import { FAST_FETCH, fetchPage } from "@/lib/scraping/http-client";
import { detectFundingStage, type FundingStage } from "@/lib/scraping/funding-stage";

/**
 * YC's public company directory is powered by an Algolia index (the same one the
 * ycombinator.com/companies page queries client-side). The old self-hosted
 * `execute-api` search proxy is gone. These are the public, search-only Algolia
 * credentials embedded in that page; override via env if YC ever rotates them.
 */
const YC_ALGOLIA_APP_ID = process.env.YC_ALGOLIA_APP_ID?.trim() || "45BWZJ1SGC";
const YC_ALGOLIA_API_KEY =
  process.env.YC_ALGOLIA_API_KEY?.trim() ||
  "NzllNTY5MzJiZGM2OTY2ZTQwMDEzOTNhYWZiZGRjODlhYzVkNjBmOGRjNzJiMWM4ZTU0ZDlhYTZjOTJiMjlhMWFuYWx5dGljc1RhZ3M9eWNkYyZyZXN0cmljdEluZGljZXM9WUNDb21wYW55X3Byb2R1Y3Rpb24lMkNZQ0NvbXBhbnlfQnlfTGF1bmNoX0RhdGVfcHJvZHVjdGlvbiZ0YWdGaWx0ZXJzPSU1QiUyMnljZGNfcHVibGljJTIyJTVE";
const YC_ALGOLIA_INDEX = "YCCompany_production";
const YC_ALGOLIA_URL = `https://${YC_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${YC_ALGOLIA_INDEX}/query`;
const YC_BASE = "https://www.ycombinator.com";

/** A hit from the YC Algolia index (public fields only). */
interface YcAlgoliaHit {
  id?: number;
  objectID?: string;
  name: string;
  slug: string;
  website?: string | null;
  one_liner?: string | null;
  long_description?: string | null;
  all_locations?: string | null;
  tags?: string[] | null;
  industries?: string[] | null;
  regions?: string[] | null;
  batch?: string | null;
  team_size?: number | null;
  industry?: string | null;
  subindustry?: string | null;
  stage?: string | null;
  status?: string | null;
  launched_at?: number | null;
}

interface YcAlgoliaResponse {
  hits: YcAlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
}

const ALGOLIA_HEADERS = {
  "X-Algolia-Application-Id": YC_ALGOLIA_APP_ID,
  "X-Algolia-API-Key": YC_ALGOLIA_API_KEY,
  "Content-Type": "application/json",
  Accept: "application/json",
};

function mergeYcFounders(
  existing: ScraperFounder[],
  discovered: ScraperFounder[]
): ScraperFounder[] {
  const byName = new Map<string, ScraperFounder>();
  for (const person of [...existing, ...discovered]) {
    const key = person.name.trim().toLowerCase();
    if (!key) continue;
    const prior = byName.get(key);
    byName.set(key, {
      name: person.name,
      title: prior?.title ?? person.title ?? null,
      linkedinUrl: prior?.linkedinUrl ?? person.linkedinUrl ?? null,
      twitterUrl: prior?.twitterUrl ?? person.twitterUrl ?? null,
      bio: prior?.bio ?? person.bio ?? null,
      avatarUrl: prior?.avatarUrl ?? person.avatarUrl ?? null,
    });
  }
  return [...byName.values()];
}

export class YCombinatorScraper extends BaseScraper {
  readonly sourceId = "ycombinator" as const;
  readonly displayName = "Y Combinator";
  readonly baseUrl = YC_BASE;

  async collectListingSeeds(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]> {
    try {
      const apiSeeds = await this.collectFromPublicApi(ctx, options);
      if (apiSeeds.length > 0) return apiSeeds;
    } catch (error) {
      // A dead/rotated API must not sink the source — fall back to rendering the
      // public listing page instead of aborting the whole scrape.
      this.logWarn("YC Algolia API failed — falling back to Playwright listing", {
        error: String(error),
      });
    }
    return this.collectFromPlaywrightListing(ctx, options);
  }

  private buildQuery(ctx: ScraperRunContext): string {
    const filters = normalizeScraperFilters(ctx.filters);
    const hasIndustryFacet = ycIndustriesForSearch(ctx.filters?.industry).length > 0;
    const hasRegionFacet = ycRegionsForCountry(ctx.filters?.location).length > 0;

    const parts = [...filters.keywords];
    if (!hasIndustryFacet) {
      parts.push(filters.industryPhrase ?? filters.industry.join(" "));
    }
    if (!hasRegionFacet) {
      parts.push(filters.locationPhrase ?? filters.location.join(" "));
    }
    parts.push(...filters.category);

    return parts.filter(Boolean).join(" ").trim();
  }

  private buildFacetFilters(ctx: ScraperRunContext): string[][] {
    const facetFilters: string[][] = [];

    const regions = ycRegionsForCountry(ctx.filters?.location);
    if (regions.length > 0) {
      facetFilters.push(regions.map((region) => `regions:${region}`));
    }

    const industries = ycIndustriesForSearch(ctx.filters?.industry);
    if (industries.length > 0) {
      facetFilters.push(industries.map((industry) => `industries:${industry}`));
    }

    return facetFilters;
  }

  private buildAlgoliaBody(
    ctx: ScraperRunContext,
    page: number,
    hitsPerPage: number,
    query: string
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      query,
      page,
      hitsPerPage,
      tagFilters: ["ycdc_public"],
      attributesToHighlight: [],
    };

    const facetFilters = this.buildFacetFilters(ctx);
    if (facetFilters.length > 0) {
      body.facetFilters = facetFilters;
    }

    return body;
  }

  private async collectFromPublicApi(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]> {
    const seeds: ScraperListingSeed[] = [];
    const hitsPerPage = 100;
    const maxPages = options.maxPages;
    const query = this.buildQuery(ctx);

    for (let page = 0; page < maxPages; page += 1) {
      this.throwIfAborted(ctx.signal);
      this.reportProgress(ctx, "Querying Y Combinator directory…", {
        current: page + 1,
        total: maxPages,
      });

      const response = await withRetry(
        () =>
          axios.post<YcAlgoliaResponse>(
            YC_ALGOLIA_URL,
            this.buildAlgoliaBody(ctx, page, hitsPerPage, query),
            { timeout: 15_000, headers: ALGOLIA_HEADERS }
          ),
        { label: "yc-algolia-listing", signal: ctx.signal }
      );

      const hits = response.data.hits ?? [];
      if (hits.length === 0) break;

      for (const hit of hits) {
        if (!hit.slug) continue;
        seeds.push({
          sourceCompanyId: String(hit.id ?? hit.objectID ?? hit.slug),
          profileUrl: `${YC_BASE}/companies/${hit.slug}`,
          name: hit.name,
        });
        if (seeds.length >= options.maxCompanies) return seeds;
      }

      if (page + 1 >= (response.data.nbPages ?? page + 1)) break;
    }

    return seeds;
  }

  private async collectFromPlaywrightListing(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]> {
    const listingUrl = buildYcCompaniesListingUrl({
      industry: ctx.filters?.industry,
      country: ctx.filters?.location,
    });
    if (options.respectRobots) {
      const allowed = await canFetchUrl(listingUrl);
      if (!allowed) {
        this.logWarn("YC listing blocked by robots.txt");
        return [];
      }
    }

    const rendered = await fetchPageWithPlaywright(listingUrl, {
      timeoutMs: 20_000,
      respectRobots: options.respectRobots,
      minIntervalMs: options.minIntervalMs,
    });

    if (!rendered?.html) return [];

    const $ = cheerio.load(rendered.html);
    const seeds: ScraperListingSeed[] = [];
    const seen = new Set<string>();

    $("a[href*='/companies/']").each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      const slug = href.split("/companies/")[1]?.split(/[?#]/)[0];
      if (!slug || slug === "companies") return;
      if (seen.has(slug)) return;
      seen.add(slug);
      seeds.push({
        sourceCompanyId: slug,
        profileUrl: `${YC_BASE}/companies/${slug}`,
        name: normalizeText($(element).text()),
      });
    });

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

    const apiProfile = await this.fetchApiProfile(seed);
    const pageProfile = apiProfile ? null : await this.fetchHtmlProfile(seed, options);

    const merged = apiProfile ?? pageProfile;
    if (!merged) return null;

    const founders =
      pageProfile?.founders.length
        ? pageProfile.founders
        : await this.fetchFoundersFromYcPage(seed.profileUrl, options);

    return {
      ...merged,
      founders: mergeYcFounders(merged.founders, founders),
      sourceUrl: seed.profileUrl,
      sourceCompanyId: seed.sourceCompanyId,
      scrapedAt: new Date().toISOString(),
    };
  }

  private async fetchFoundersFromYcPage(
    profileUrl: string,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperFounder[]> {
    let html: string | null = null;
    const http = await fetchPage(profileUrl, FAST_FETCH);
    html = http?.html ?? null;

    if (!html || html.length < 500) {
      const rendered = await fetchPageWithPlaywright(profileUrl, {
        timeoutMs: 15_000,
        respectRobots: options.respectRobots,
        minIntervalMs: options.minIntervalMs,
      });
      html = rendered?.html ?? null;
    }

    return html ? extractYcFoundersFromHtml(html) : [];
  }

  private async fetchApiProfile(
    seed: ScraperListingSeed
  ): Promise<Omit<ScrapedCompanyProfile, "scrapedAt"> | null> {
    try {
      const slug = seed.profileUrl.split("/companies/")[1];
      const response = await axios.post<YcAlgoliaResponse>(
        YC_ALGOLIA_URL,
        {
          query: seed.name ?? slug ?? "",
          hitsPerPage: 10,
          tagFilters: ["ycdc_public"],
          attributesToHighlight: [],
        },
        { timeout: 12_000, headers: ALGOLIA_HEADERS }
      );

      const hits = response.data.hits ?? [];
      const hit =
        hits.find((item) => item.slug === slug) ??
        hits.find((item) => normalizeText(item.name) === normalizeText(seed.name ?? "")) ??
        hits[0];

      if (!hit) return null;
      return this.mapAlgoliaHit(hit, seed.profileUrl);
    } catch {
      return null;
    }
  }

  /** "San Francisco, CA, USA" → { city, state, country }. Best-effort. */
  private parseLocation(all: string | null | undefined): {
    city: string | null;
    state: string | null;
    country: string | null;
  } {
    const first = all?.split(";")[0]?.trim();
    if (!first) return { city: null, state: null, country: null };
    const parts = first.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return { city: null, state: null, country: null };
    if (parts.length === 1) return { city: null, state: null, country: parts[0] };
    if (parts.length === 2) return { city: parts[0], state: null, country: parts[1] };
    return { city: parts[0], state: parts[1], country: parts[parts.length - 1] };
  }

  private resolveFundingStage(hit: YcAlgoliaHit): FundingStage | null {
    const status = hit.status?.toLowerCase() ?? "";
    if (status.includes("public")) return "public";
    if (status.includes("acquired")) return "acquired";

    const stage = hit.stage?.toLowerCase() ?? "";
    if (stage.includes("seed")) return "seed";

    return detectFundingStage(
      [hit.batch, hit.stage, hit.long_description].filter(Boolean).join(" ")
    );
  }

  private resolveYcCountry(
    hit: YcAlgoliaHit,
    parsedCountry: string | null
  ): string | null {
    if (parsedCountry && !/^remote$/i.test(parsedCountry.trim())) {
      return parsedCountry;
    }

    const regions = hit.regions ?? [];
    if (regions.includes("Canada")) return "Canada";
    if (regions.some((region) => /united states of america/i.test(region))) {
      return "United States";
    }
    if (regions.some((region) => /united kingdom/i.test(region))) {
      return "United Kingdom";
    }

    return parsedCountry ?? regions.find((region) => !/remote/i.test(region)) ?? null;
  }

  private mapAlgoliaHit(
    hit: YcAlgoliaHit,
    profileUrl: string
  ): Omit<ScrapedCompanyProfile, "scrapedAt"> {
    const websiteUrl = normalizeUrl(hit.website);
    const description =
      normalizeText(hit.long_description) ?? normalizeText(hit.one_liner);
    const tags = normalizeTags([
      ...(hit.tags ?? []),
      ...(hit.industries ?? []),
      ...(hit.regions ?? []),
    ]);
    const { city, state, country: parsedCountry } = this.parseLocation(hit.all_locations);
    const country = this.resolveYcCountry(hit, parsedCountry);
    const launchDate = hit.launched_at
      ? new Date(hit.launched_at * 1000).toISOString()
      : null;

    return {
      source: "ycombinator",
      sourceUrl: profileUrl,
      sourceCompanyId: String(hit.id ?? hit.objectID ?? hit.slug),
      name: hit.name,
      websiteUrl,
      domain: normalizeDomain(websiteUrl),
      description,
      industry: normalizeText(hit.industry ?? hit.subindustry),
      category: normalizeText(hit.subindustry ?? hit.industry),
      tags,
      country: country ?? hit.regions?.[0] ?? null,
      city,
      state,
      founders: [],
      publicEmail: null,
      publicPhone: null,
      contactPageUrl: null,
      careersPageUrl: null,
      // The Algolia index carries no social links; website enrichment recovers
      // LinkedIn/etc. from the company's own site downstream.
      socialLinks: {},
      fundingStage: this.resolveFundingStage(hit),
      teamSize: hit.team_size ?? null,
      launchDate,
      websiteExtras: {},
      errors: [],
    };
  }

  private async fetchHtmlProfile(
    seed: ScraperListingSeed,
    options: Required<ScraperRunOptions>
  ): Promise<Omit<ScrapedCompanyProfile, "scrapedAt"> | null> {
    let html: string | null = null;
    const http = await fetchPage(seed.profileUrl, FAST_FETCH);
    html = http?.html ?? null;

    if (!html || html.length < 500) {
      const rendered = await fetchPageWithPlaywright(seed.profileUrl, {
        timeoutMs: 15_000,
        respectRobots: options.respectRobots,
        minIntervalMs: options.minIntervalMs,
      });
      html = rendered?.html ?? null;
    }

    if (!html) return null;

    const $ = cheerio.load(html);
    const name =
      normalizeText($("h1").first().text()) ??
      normalizeText(seed.name) ??
      seed.sourceCompanyId;
    const description =
      normalizeText($("meta[name='description']").attr("content")) ??
      normalizeText($("p").first().text());
    const websiteUrl = normalizeUrl(
      $("a[href^='http']")
        .filter((_, el) => /website/i.test($(el).text()))
        .first()
        .attr("href") ?? $("a[href^='http']").first().attr("href")
    );

    const tags = normalizeTags(
      $("[class*='tag'], [class*='pill']")
        .map((_, el) => $(el).text())
        .get()
    );

    const founders = extractYcFoundersFromHtml(html);

    return {
      source: "ycombinator",
      sourceUrl: seed.profileUrl,
      sourceCompanyId: seed.sourceCompanyId,
      name,
      websiteUrl,
      domain: normalizeDomain(websiteUrl),
      description,
      industry: tags[0] ?? null,
      category: tags[0] ?? null,
      tags,
      country: null,
      city: null,
      state: null,
      founders,
      publicEmail: null,
      publicPhone: null,
      contactPageUrl: null,
      careersPageUrl: null,
      socialLinks: {},
      fundingStage: detectFundingStage(description ?? ""),
      teamSize: null,
      launchDate: null,
      websiteExtras: {},
      errors: [],
    };
  }
}
