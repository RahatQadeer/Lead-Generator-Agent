import { describe, expect, it } from "vitest";
import { BaseScraper } from "@/lib/scrapers/base-scraper";
import { DEFAULT_SCRAPER_OPTIONS } from "@/lib/scrapers/base-scraper";
import { fromSeedScraper } from "@/lib/discovery/adapters/from-seed-scraper";
import type { ScrapeRunContext } from "@/lib/discovery/types";
import type {
  ScrapedCompanyProfile,
  ScraperListingSeed,
  ScraperSourceId,
} from "@/lib/scrapers/types";

function profile(name: string): ScrapedCompanyProfile {
  return {
    source: "ycombinator",
    sourceUrl: `https://example.com/${name}`,
    sourceCompanyId: name,
    name,
    websiteUrl: `https://${name}.com`,
    domain: `${name}.com`,
    description: null,
    industry: null,
    category: null,
    tags: [],
    country: null,
    city: null,
    state: null,
    founders: [],
    publicEmail: null,
    publicPhone: null,
    contactPageUrl: null,
    careersPageUrl: null,
    socialLinks: {},
    fundingStage: null,
    teamSize: null,
    launchDate: null,
    websiteExtras: {},
    scrapedAt: "2026-01-01T00:00:00.000Z",
    errors: [],
  };
}

/** A seed scraper whose profile fetches can be made to fail or hang. */
class FakeScraper extends BaseScraper {
  readonly sourceId = "ycombinator" as ScraperSourceId;
  readonly displayName = "Fake";
  readonly baseUrl = "https://example.com";

  constructor(
    private readonly seedCount: number,
    private readonly failOn: ReadonlySet<string> = new Set(),
    private readonly delays: Record<string, number> = {}
  ) {
    super();
  }

  collectListingSeeds(): Promise<ScraperListingSeed[]> {
    return Promise.resolve(
      Array.from({ length: this.seedCount }, (_, i) => ({
        sourceCompanyId: `c${i}`,
        profileUrl: `https://example.com/c${i}`,
        name: `c${i}`,
      }))
    );
  }

  async scrapeCompanyProfile(
    seed: ScraperListingSeed
  ): Promise<ScrapedCompanyProfile | null> {
    const delay = this.delays[seed.sourceCompanyId];
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (this.failOn.has(seed.sourceCompanyId)) {
      throw new Error(`boom ${seed.sourceCompanyId}`);
    }
    return profile(seed.sourceCompanyId);
  }
}

function ctx(overrides: Partial<ScrapeRunContext> = {}): ScrapeRunContext {
  return {
    jobId: "job-1",
    filters: {},
    limit: 0,
    options: { ...DEFAULT_SCRAPER_OPTIONS },
    signal: new AbortController().signal,
    ...overrides,
  };
}

async function collect(
  iterable: AsyncIterable<ScrapedCompanyProfile>
): Promise<string[]> {
  const out: string[] = [];
  for await (const p of iterable) out.push(p.name);
  return out;
}

describe("seed scraper → CompanyScraper adapter", () => {
  it("streams every company a source yields", async () => {
    const scraper = fromSeedScraper(() => new FakeScraper(5));
    const names = await collect(scraper.scrape(ctx()));
    expect(names.sort()).toEqual(["c0", "c1", "c2", "c3", "c4"]);
  });

  it("carries the source identity and catalog metadata", () => {
    const scraper = fromSeedScraper(() => new FakeScraper(1));
    expect(scraper.id).toBe("ycombinator");
    expect(scraper.kind).toBe("accelerator");
    expect(scraper.backers).toContain("Y Combinator");
  });

  it("counts the limit in COMPANIES, not seeds, when profiles fail", async () => {
    // 6 seeds, the first 3 fail. A seed-based limit of 3 would yield 0 companies;
    // a company-based limit must still produce 3.
    const scraper = fromSeedScraper(
      () => new FakeScraper(6, new Set(["c0", "c1", "c2"]))
    );
    const names = await collect(scraper.scrape(ctx({ limit: 3 })));
    expect(names).toHaveLength(3);
    expect(names).not.toContain("c0");
  });

  it("isolates a failing profile instead of aborting the source", async () => {
    const scraper = fromSeedScraper(() => new FakeScraper(4, new Set(["c1"])));
    const names = await collect(scraper.scrape(ctx()));
    expect(names.sort()).toEqual(["c0", "c2", "c3"]);
  });

  it("stops promptly when the run is aborted", async () => {
    const controller = new AbortController();
    const scraper = fromSeedScraper(() => new FakeScraper(50));
    const seen: string[] = [];

    for await (const p of scraper.scrape(ctx({ signal: controller.signal }))) {
      seen.push(p.name);
      if (seen.length === 2) controller.abort();
    }

    expect(seen.length).toBeLessThan(50);
  });

  it("yields in completion order so one slow page cannot stall the rest", async () => {
    // c0 is slow; with a fixed-batch strategy nothing would emit until it lands.
    const scraper = fromSeedScraper(
      () => new FakeScraper(3, new Set(), { c0: 40 })
    );
    const names = await collect(
      scraper.scrape(ctx({ options: { ...DEFAULT_SCRAPER_OPTIONS, concurrency: 3 } }))
    );
    expect(names[names.length - 1]).toBe("c0");
    expect(names).toHaveLength(3);
  });

  it("constructs a fresh scraper per run so state cannot leak between jobs", async () => {
    let built = 0;
    const scraper = fromSeedScraper(() => {
      built += 1;
      return new FakeScraper(1);
    });

    await collect(scraper.scrape(ctx()));
    await collect(scraper.scrape(ctx()));

    // one probe at registration + one per run
    expect(built).toBe(3);
  });
});
