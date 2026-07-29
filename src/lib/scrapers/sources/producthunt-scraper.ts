import axios from "axios";
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
import { detectFundingStage } from "@/lib/scraping/funding-stage";

const PH_BASE = "https://www.producthunt.com";
const PH_FEED = "https://www.producthunt.com/feed";
const PH_GRAPHQL = "https://api.producthunt.com/v2/api/graphql";

/** Data captured per post, from either the GraphQL API or the Atom feed. */
interface PostRecord {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  postUrl: string;
  topics: string[];
}

interface PhGraphqlResponse {
  data?: {
    posts?: {
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
      edges: Array<{
        node: {
          id: string;
          name: string;
          slug: string;
          tagline?: string | null;
          description?: string | null;
          url?: string | null;
          website?: string | null;
          topics?: { edges: Array<{ node: { name: string } }> };
        };
      }>;
    };
  };
}

/**
 * Scrapes newly launched products/companies from Product Hunt.
 *
 * Product Hunt's website is Cloudflare-gated, so this scraper uses only its
 * sanctioned public interfaces: the official GraphQL API when a
 * `PRODUCTHUNT_TOKEN` is configured (richest data, incl. official website),
 * otherwise the public Atom feed at /feed (name + tagline, website unavailable).
 */
export class ProductHuntScraper extends BaseScraper {
  readonly sourceId = "producthunt" as const;
  readonly displayName = "Product Hunt";
  readonly baseUrl = PH_BASE;

  /** Run-scoped cache so profiles are mapped without a second network round-trip. */
  private readonly records = new Map<string, PostRecord>();

  async collectListingSeeds(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]> {
    const token = process.env.PRODUCTHUNT_TOKEN?.trim();
    const records = token
      ? await this.collectFromGraphql(token, ctx, options)
      : await this.collectFromFeed(ctx, options);

    const seeds: ScraperListingSeed[] = [];
    for (const record of records) {
      this.records.set(record.id, record);
      seeds.push({
        sourceCompanyId: record.id,
        profileUrl: record.postUrl,
        name: record.name,
      });
      if (seeds.length >= options.maxCompanies) break;
    }
    return seeds;
  }

  private async collectFromGraphql(
    token: string,
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<PostRecord[]> {
    const records: PostRecord[] = [];
    let after: string | null = null;

    for (let page = 0; page < options.maxPages; page += 1) {
      this.throwIfAborted(ctx.signal);
      this.reportProgress(ctx, "Querying Product Hunt API…", {
        current: records.length,
        total: options.maxCompanies,
      });

      const query = `query($after: String) {
        posts(first: 50, order: RANKING, after: $after) {
          pageInfo { endCursor hasNextPage }
          edges { node { id name slug tagline description url website
            topics { edges { node { name } } } } }
        }
      }`;

      const response = await withRetry(
        () =>
          axios.post<PhGraphqlResponse>(
            PH_GRAPHQL,
            { query, variables: { after } },
            {
              timeout: 15_000,
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          ),
        { label: "producthunt-graphql", signal: ctx.signal }
      ).catch((error) => {
        this.logWarn("Product Hunt GraphQL request failed", { error: String(error) });
        return null;
      });

      const posts = response?.data.data?.posts;
      if (!posts || posts.edges.length === 0) break;

      for (const edge of posts.edges) {
        const node = edge.node;
        records.push({
          id: node.id,
          name: node.name,
          slug: node.slug,
          tagline: normalizeText(node.tagline),
          description: normalizeText(node.description ?? node.tagline),
          website: normalizeUrl(node.website),
          postUrl: normalizeUrl(node.url) ?? `${PH_BASE}/products/${node.slug}`,
          topics: normalizeTags(node.topics?.edges.map((t) => t.node.name) ?? []),
        });
        if (records.length >= options.maxCompanies) return records;
      }

      if (!posts.pageInfo.hasNextPage) break;
      after = posts.pageInfo.endCursor;
    }

    return records;
  }

  private async collectFromFeed(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<PostRecord[]> {
    this.reportProgress(ctx, "Reading Product Hunt feed…");
    this.logInfo("PRODUCTHUNT_TOKEN not set — using public Atom feed (no website data)");

    const response = await withRetry(
      () =>
        axios.get<string>(PH_FEED, {
          timeout: 15_000,
          responseType: "text",
          headers: { "User-Agent": "LeadForgeBot/1.0 (+https://righttail.com)", Accept: "application/atom+xml" },
        }),
      { label: "producthunt-feed", signal: ctx.signal }
    ).catch((error) => {
      this.logWarn("Product Hunt feed request failed", { error: String(error) });
      return null;
    });

    if (!response?.data) return [];

    const $ = cheerio.load(response.data, { xmlMode: true });
    const records: PostRecord[] = [];

    $("entry").each((_, entry) => {
      const node = $(entry);
      const idRaw = node.find("id").first().text();
      const id = idRaw.split("Post/")[1]?.trim() || idRaw.trim();
      const name = normalizeText(node.find("title").first().text());
      const postUrl =
        node.find("link[rel='alternate']").attr("href") ??
        node.find("link").first().attr("href") ??
        PH_BASE;
      const slug = postUrl.split("/products/")[1]?.split(/[?#]/)[0] ?? "";
      const contentHtml = node.find("content").first().text();
      const description = normalizeText(cheerio.load(contentHtml)("p").first().text());

      if (!id || !name) return;
      records.push({
        id,
        name,
        slug,
        tagline: description,
        description,
        website: null,
        postUrl: normalizeUrl(postUrl) ?? PH_BASE,
        topics: [],
      });
    });

    return records.slice(0, options.maxCompanies);
  }

  async scrapeCompanyProfile(
    seed: ScraperListingSeed,
    ctx: ScraperRunContext,
    _options: Required<ScraperRunOptions>
  ): Promise<ScrapedCompanyProfile | null> {
    this.throwIfAborted(ctx.signal);

    const record = this.records.get(seed.sourceCompanyId);
    if (!record) return null;

    const websiteUrl = record.website;
    return {
      source: this.sourceId,
      sourceUrl: seed.profileUrl,
      sourceCompanyId: seed.sourceCompanyId,
      name: record.name,
      websiteUrl,
      domain: normalizeDomain(websiteUrl),
      description: record.description ?? record.tagline,
      industry: record.topics[0] ?? null,
      category: record.topics[0] ?? "Product / Startup",
      tags: normalizeTags([...record.topics, "producthunt"]),
      country: null,
      city: null,
      state: null,
      founders: [],
      publicEmail: null,
      publicPhone: null,
      contactPageUrl: null,
      careersPageUrl: null,
      socialLinks: {},
      fundingStage: detectFundingStage(record.description ?? ""),
      teamSize: null,
      launchDate: null,
      websiteExtras: {},
      scrapedAt: new Date().toISOString(),
      errors: [],
    };
  }
}
