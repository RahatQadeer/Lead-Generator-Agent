/**
 * Live end-to-end test of the directory scraper engine (the same engine wired
 * into company discovery). Runs the fast API sources — YC, GitHub, Product Hunt —
 * capped at 10 companies each, then prints the companies + any founders found.
 *
 *   npm run test:directory                       # broad run
 *   npm run test:directory -- fintech            # keyword-filtered run
 *
 * Requires internet access.
 */
import { scraperEngine } from "@/lib/scrapers/engine/scraper-engine";
import { getDirectoryScraperSources } from "@/lib/company-discovery/directory-scraper-source";
import type { ScraperFilters } from "@/lib/scrapers/types";

const LIMIT = 10;
const keyword = process.argv.slice(2).filter((a) => !a.startsWith("-")).join(" ").trim();

async function main() {
  const sources = getDirectoryScraperSources();
  const filters: ScraperFilters = keyword ? { keywords: [keyword] } : {};

  console.log(`\n🔎 Directory scrape — sources: ${sources.join(", ")}`);
  console.log(`   limit: ${LIMIT} per source${keyword ? ` · keyword: "${keyword}"` : " · no filter"}\n`);

  const started = Date.now();
  const result = await scraperEngine.run({
    ctx: {
      userId: "smoke-test",
      searchId: null,
      jobId: "directory-smoke",
      options: {
        maxCompanies: LIMIT,
        maxPages: 1,
        enrichFromWebsite: true, // needed to surface founders / decision-makers
        concurrency: 4,
        respectRobots: true,
        minIntervalMs: 800,
      },
      filters,
      signal: new AbortController().signal,
      onProgress: (e) =>
        process.stdout.write(`\r   · ${e.phase} ${e.current ?? ""}/${e.total ?? ""}      `),
    },
    sources,
    options: { maxCompanies: LIMIT, maxPages: 1, enrichFromWebsite: true, concurrency: 4 },
  });

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n\n✅ Done in ${secs}s — ${result.companies.length} companies\n`);

  const bySource = result.report.sources
    .map((s) => `   ${s.source}: found ${s.companiesFound}, kept ${s.companiesSaved}, filtered ${s.filteredCount}, errors ${s.errorCount}`)
    .join("\n");
  console.log("Per source:\n" + bySource + "\n");

  result.profiles.slice(0, LIMIT).forEach((p, i) => {
    const loc = [p.city, p.country].filter(Boolean).join(", ") || "—";
    console.log(`${String(i + 1).padStart(2)}. ${p.name}  [${p.source}]`);
    console.log(`    web: ${p.websiteUrl ?? "—"}  ·  industry: ${p.industry ?? "—"}  ·  ${loc}`);
    console.log(`    team: ${p.teamSize ?? "—"}  ·  funding: ${p.fundingStage ?? "—"}  ·  investors: ${p.investors?.join(", ") || "—"}  ·  linkedin: ${p.socialLinks.linkedin ?? "—"}`);
    if (p.founders.length > 0) {
      console.log(`    👤 founders/leaders:`);
      p.founders.forEach((f) =>
        console.log(`       - ${f.name}${f.title ? ` (${f.title})` : ""}${f.linkedinUrl ? ` · ${f.linkedinUrl}` : ""}`)
      );
    }
  });

  const totalFounders = result.profiles.reduce((n, p) => n + p.founders.length, 0);
  console.log(`\n📊 ${result.companies.length} companies · ${totalFounders} decision-makers found\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Directory scrape failed:", err?.message ?? err);
    process.exit(1);
  });
