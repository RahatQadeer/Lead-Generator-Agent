/**
 * Quick smoke test for Google Places / Maps API.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-google-places.ts
 *   npx tsx --env-file=.env.local scripts/test-google-places.ts "Healthcare" "Pakistan" saas
 */

import {
  isGooglePlacesConfigured,
  searchGooglePlacesCompanies,
} from "@/lib/scraping/google-places-search";

async function main() {
  const industry = process.argv[2] ?? "Technology";
  const country = process.argv[3] ?? "United States";
  const keywords = process.argv.slice(4).filter(Boolean);

  console.log("── Google Places API test ──\n");
  console.log("GOOGLE_PLACES_API_KEY:", process.env.GOOGLE_PLACES_API_KEY ? "set" : "MISSING");
  console.log("GOOGLE_MAPS_DIRECTORY_ENABLED:", process.env.GOOGLE_MAPS_DIRECTORY_ENABLED ?? "(default true)");
  console.log("Configured:", isGooglePlacesConfigured() ? "yes" : "no");
  console.log("Query:", { industry, country, keywords });
  console.log("");

  if (!isGooglePlacesConfigured()) {
    console.error("FAIL — add GOOGLE_PLACES_API_KEY to .env.local and restart the dev server.");
    process.exit(1);
  }

  const started = Date.now();
  const seeds = await searchGooglePlacesCompanies({
    industry,
    country,
    keywords: keywords.length > 0 ? keywords : ["software"],
    maxResults: 5,
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (seeds.length === 0) {
    console.error(`FAIL — API returned 0 companies with websites (${elapsed}s).`);
    console.error("Check server logs for 'Google Places API error' (billing, API not enabled, bad key).");
    process.exit(1);
  }

  console.log(`OK — ${seeds.length} companies found (${elapsed}s)\n`);
  for (const seed of seeds) {
    console.log(`• ${seed.title}`);
    console.log(`  ${seed.domain} | ${seed.city ?? "—"} | ${seed.industryHint ?? "—"}`);
  }
}

main().catch((error) => {
  console.error("FAIL —", error);
  process.exit(1);
});
