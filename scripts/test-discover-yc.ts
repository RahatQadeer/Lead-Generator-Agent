/**
 * Smoke test for YC-focused company discovery (no auth / DB).
 *
 *   npx tsx --env-file=.env.local scripts/test-discover-yc.ts
 */
import { discoverCompanies } from "@/lib/company-discovery/discover";
import { isYcFocusedDiscovery } from "@/lib/company-discovery/yc-scraper-config";
import { toCompanyPublicView } from "@/lib/pipeline/public-views";

async function main() {
  console.log("YC focused:", isYcFocusedDiscovery());

  const params = {
    searchName: "Logistics US",
    industry: "Logistics",
    country: "United States",
    companySizeMin: null as number | null,
    companySizeMax: null as number | null,
    keywords: [] as string[],
    technologies: [] as string[],
    exclusions: {
      domains: [],
      industries: [],
      keywords: [],
      countries: [],
    },
    page: 1,
    perPage: 50,
  };

  const result = await discoverCompanies(params, {
    userId: "smoke-test",
    searchId: "smoke-test",
    onProgress: (e) =>
      console.log(
        `  · ${e.phase ?? ""} ${e.current ?? ""}/${e.total ?? ""} ${e.label ?? ""}`.trim()
      ),
  });

  console.log("\nResult:", {
    companies: result.companies.length,
    provider: result.provider,
    filtered: result.filteredCount,
  });

  for (const company of result.companies.slice(0, 3)) {
    const view = toCompanyPublicView(company, {
      industry: params.industry,
      country: params.country,
      companySizeMin: params.companySizeMin,
      companySizeMax: params.companySizeMax,
      technologies: params.technologies,
      keywords: params.keywords,
    });
    console.log(
      `  • ${view.name} (${view.domain}) — ${view.decisionMakers?.length ?? 0} founders`
    );
  }

  console.log("\n✅ Discovery completed without throwing.");
}

main().catch((err) => {
  console.error("\n❌ Discovery failed:", err);
  process.exit(1);
});
