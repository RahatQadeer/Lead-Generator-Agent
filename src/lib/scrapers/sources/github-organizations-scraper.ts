import axios, { type AxiosRequestConfig } from "axios";
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
import { withRetry } from "@/lib/scrapers/utils/retry";
import { normalizeScraperFilters } from "@/lib/scrapers/filters";
import { isValidEmail } from "@/lib/scrapers/utils/validate";
import { canFetchUrl } from "@/lib/scraping/robots";
import { fetchPageWithPlaywright } from "@/lib/scraping/playwright-fetch";
import { detectFundingStage } from "@/lib/scraping/funding-stage";

const GITHUB_API = "https://api.github.com";
const GITHUB_BASE = "https://github.com";

/**
 * Qualifier-only search queries used to surface active organizations when the
 * caller does not provide their own. Each is a public GitHub search filter and
 * respects the Search API's requirement of at least one qualifier/term.
 */
const DEFAULT_ORG_QUERIES = [
  "type:org repos:>20",
  "type:org followers:>100",
  "type:org created:>2020-01-01 repos:>5",
];

interface GithubSearchUser {
  login: string;
  id: number;
  html_url: string;
  type: string;
}

interface GithubSearchResponse {
  total_count: number;
  items: GithubSearchUser[];
}

interface GithubOrg {
  login: string;
  id: number;
  name?: string | null;
  company?: string | null;
  blog?: string | null;
  location?: string | null;
  email?: string | null;
  twitter_username?: string | null;
  description?: string | null;
  html_url: string;
  public_repos?: number | null;
  followers?: number | null;
  created_at?: string | null;
}

/**
 * Scrapes public GitHub organization profiles via the official REST API
 * (api-first), falling back to rendering the public org page when the API is
 * unavailable (e.g. anonymous rate limit exhausted). Only reads data GitHub
 * exposes publicly — no authenticated-only or private fields.
 */
export class GithubOrganizationsScraper extends BaseScraper {
  readonly sourceId = "github-organizations" as const;
  readonly displayName = "GitHub Organizations";
  readonly baseUrl = GITHUB_BASE;

  /** Optional PAT raises the anon 60 req/hr limit to 5,000 req/hr. */
  private authHeaders(): Record<string, string> {
    const token = process.env.GITHUB_TOKEN?.trim();
    return {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "LeadForgeBot/1.0 (+https://righttail.com)",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Translate search filters into GitHub user-search qualifiers. Keywords/
   * industry/category become free-text terms and `location:` narrows by place;
   * every query keeps `type:org`. Falls back to {@link DEFAULT_ORG_QUERIES} when
   * no relevant filter is supplied.
   */
  private buildQueries(ctx: ScraperRunContext): string[] {
    const filters = normalizeScraperFilters(ctx.filters);
    const terms = [...filters.keywords, ...filters.industry, ...filters.category];
    const locationQualifier =
      ctx.filters.location && ctx.filters.location.trim()
        ? ` location:"${ctx.filters.location.trim().replace(/"/g, "")}"`
        : "";

    if (terms.length === 0 && !locationQualifier) {
      return DEFAULT_ORG_QUERIES;
    }

    const termQuery = terms.join(" ").trim();
    return [`${termQuery} type:org${locationQualifier}`.trim()];
  }

  async collectListingSeeds(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]> {
    const seeds: ScraperListingSeed[] = [];
    const seen = new Set<string>();
    const perPage = 100;

    for (const query of this.buildQueries(ctx)) {
      if (seeds.length >= options.maxCompanies) break;

      for (let page = 1; page <= options.maxPages; page += 1) {
        this.throwIfAborted(ctx.signal);
        this.reportProgress(ctx, "Querying GitHub organizations…", {
          current: seeds.length,
          total: options.maxCompanies,
          label: query,
        });

        const response = await withRetry(
          () =>
            axios.get<GithubSearchResponse>(`${GITHUB_API}/search/users`, {
              params: { q: query, sort: "followers", order: "desc", per_page: perPage, page },
              headers: this.authHeaders(),
              timeout: 15_000,
            } satisfies AxiosRequestConfig),
          { label: "github-search", signal: ctx.signal, attempts: 3 }
        ).catch((error) => {
          this.logWarn("GitHub search request failed", { query, page, error: String(error) });
          return null;
        });

        const items = response?.data.items ?? [];
        if (items.length === 0) break;

        for (const item of items) {
          if (item.type !== "Organization") continue;
          if (seen.has(item.login)) continue;
          seen.add(item.login);
          seeds.push({
            sourceCompanyId: String(item.id ?? item.login),
            profileUrl: `${GITHUB_BASE}/${item.login}`,
            name: item.login,
          });
          if (seeds.length >= options.maxCompanies) break;
        }

        if (items.length < perPage) break;
        if (seeds.length >= options.maxCompanies) break;
      }
    }

    return seeds;
  }

  async scrapeCompanyProfile(
    seed: ScraperListingSeed,
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScrapedCompanyProfile | null> {
    this.throwIfAborted(ctx.signal);

    const login = seed.profileUrl.split("/").filter(Boolean).pop();
    if (!login) return null;

    const apiProfile = await this.fetchApiProfile(login, seed);
    const merged = apiProfile ?? (await this.fetchHtmlProfile(login, seed, options));
    if (!merged) return null;

    return {
      ...merged,
      sourceUrl: seed.profileUrl,
      sourceCompanyId: seed.sourceCompanyId,
      scrapedAt: new Date().toISOString(),
    };
  }

  private async fetchApiProfile(
    login: string,
    seed: ScraperListingSeed
  ): Promise<Omit<ScrapedCompanyProfile, "scrapedAt"> | null> {
    try {
      const response = await axios.get<GithubOrg>(`${GITHUB_API}/orgs/${login}`, {
        headers: this.authHeaders(),
        timeout: 12_000,
      });
      return this.mapOrg(response.data, seed);
    } catch {
      return null;
    }
  }

  private mapOrg(
    org: GithubOrg,
    seed: ScraperListingSeed
  ): Omit<ScrapedCompanyProfile, "scrapedAt"> {
    const websiteUrl = normalizeUrl(org.blog);
    const twitter = org.twitter_username
      ? normalizeUrl(`https://twitter.com/${org.twitter_username.replace(/^@/, "")}`)
      : null;
    const email =
      org.email && isValidEmail(org.email) ? org.email.toLowerCase() : null;
    const description = normalizeText(org.description);

    return {
      source: this.sourceId,
      sourceUrl: seed.profileUrl,
      sourceCompanyId: String(org.id ?? org.login),
      name: normalizeText(org.name) ?? org.login,
      websiteUrl,
      domain: normalizeDomain(websiteUrl),
      description,
      industry: null,
      category: "Open Source / Technology",
      tags: normalizeTags(["github", "open-source"]),
      country: null,
      city: normalizeText(org.location),
      state: null,
      founders: [],
      publicEmail: email,
      publicPhone: null,
      contactPageUrl: null,
      careersPageUrl: null,
      socialLinks: {
        github: normalizeUrl(org.html_url),
        twitter,
      },
      fundingStage: detectFundingStage(description ?? ""),
      teamSize: null,
      launchDate: org.created_at ?? null,
      websiteExtras: {},
      errors: [],
    };
  }

  /** Fallback: render the public org page when the REST API is unavailable. */
  private async fetchHtmlProfile(
    login: string,
    seed: ScraperListingSeed,
    options: Required<ScraperRunOptions>
  ): Promise<Omit<ScrapedCompanyProfile, "scrapedAt"> | null> {
    if (options.respectRobots) {
      const allowed = await canFetchUrl(seed.profileUrl);
      if (!allowed) return null;
    }

    const rendered = await fetchPageWithPlaywright(seed.profileUrl, {
      timeoutMs: 15_000,
      respectRobots: options.respectRobots,
      minIntervalMs: options.minIntervalMs,
    });
    if (!rendered?.html) return null;

    const $ = cheerio.load(rendered.html);
    const name =
      normalizeText($("h1.h2, .org-name, [itemprop='name']").first().text()) ??
      normalizeText(seed.name) ??
      login;
    const description = normalizeText(
      $("meta[name='description']").attr("content") ??
        $("[itemprop='description'], .org-profile-bio").first().text()
    );
    const websiteUrl = normalizeUrl(
      $("a[href^='http']")
        .filter((_, el) => !/github\.com|twitter\.com|x\.com/i.test($(el).attr("href") ?? ""))
        .first()
        .attr("href")
    );

    return {
      source: this.sourceId,
      sourceUrl: seed.profileUrl,
      sourceCompanyId: seed.sourceCompanyId,
      name,
      websiteUrl,
      domain: normalizeDomain(websiteUrl),
      description,
      industry: null,
      category: "Open Source / Technology",
      tags: normalizeTags(["github", "open-source"]),
      country: null,
      city: null,
      state: null,
      founders: [],
      publicEmail: null,
      publicPhone: null,
      contactPageUrl: null,
      careersPageUrl: null,
      socialLinks: { github: seed.profileUrl },
      fundingStage: detectFundingStage(description ?? ""),
      teamSize: null,
      launchDate: null,
      websiteExtras: {},
      errors: [],
    };
  }
}
