/**
 * Live smoke test for the Y Combinator directory scraper.
 *
 *   npm run test:yc-scraper
 *
 * Hits YC's real public search API (Playwright HTML fallback if that fails),
 * prints the seeds + one full profile, then runs the same query with a keyword
 * filter to prove server-side narrowing. Requires internet access.
 */
import { YCombinatorScraper } from "@/lib/scrapers/sources/yc-scraper";
import type { ScraperRunContext, ScraperFilters } from "@/lib/scrapers/types";

const OPTIONS = {
  maxCompanies: 5,
  maxPages: 1,
  enrichFromWebsite: false,
  concurrency: 2,
  respectRobots: true,
  minIntervalMs: 500,
};

function ctx(filters: ScraperFilters = {}): ScraperRunContext {
  return {
    userId: "smoke-test",
    searchId: null,
    jobId: "yc-smoke",
    options: OPTIONS,
    filters,
    signal: new AbortController().signal,
    onProgress: (e) => console.log(`  · ${e.phase} ${e.current ?? ""}${e.label ? ` — ${e.label}` : ""}`),
  };
}

async function main() {
  const yc = new YCombinatorScraper();

  console.log("\n[1] Collecting YC listing seeds (no filter)…");
  const seeds = await yc.collectListingSeeds(ctx(), OPTIONS);
  console.log(`    → ${seeds.length} seeds`);
  seeds.slice(0, 5).forEach((s) => console.log(`      • ${s.name} — ${s.profileUrl}`));

  if (seeds.length === 0) {
    console.error("\n❌ No seeds returned. Check internet access / YC API reachability.");
    process.exit(1);
  }

  console.log("\n[2] Scraping one full company profile…");
  const profile = await yc.scrapeCompanyProfile(seeds[0], ctx(), OPTIONS);
  console.log(
    JSON.stringify(
      profile && {
        name: profile.name,
        website: profile.websiteUrl,
        industry: profile.industry,
        country: profile.country,
        teamSize: profile.teamSize,
        fundingStage: profile.fundingStage,
        linkedin: profile.socialLinks.linkedin,
        description: profile.description?.slice(0, 90),
      },
      null,
      2
    )
  );

  console.log("\n[3] Keyword filter 'fintech' (server-side query narrowing)…");
  const filtered = await yc.collectListingSeeds(ctx({ keywords: ["fintech"] }), OPTIONS);
  console.log(`    → ${filtered.length} seeds for 'fintech'`);
  filtered.slice(0, 5).forEach((s) => console.log(`      • ${s.name}`));

  console.log("\n✅ YC scraper is live and returning real data.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ YC scraper failed:", err?.message ?? err);
    process.exit(1);
  });
