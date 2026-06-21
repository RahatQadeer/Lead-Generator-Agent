import { createLogger } from "@/lib/logger";
import { searchApifyGoogleMapsCompanies } from "@/lib/apify/google-maps-search";
import { isApifyEnabled } from "@/lib/apify/config";
import { searchBusinessDirectories } from "@/lib/scraping/business-directory-search";
import { searchPublicDatabases } from "@/lib/scraping/public-database-search";
import type { PublicDatabaseId } from "@/lib/scraping/public-database-sites";
import type { BusinessDirectoryId, BusinessDirectorySocialLinks } from "@/lib/scraping/business-directory-sites";
import { searchGooglePlacesCompanies, isGooglePlacesConfigured } from "@/lib/scraping/google-places-search";
import { searchOverpassCompanies } from "@/lib/scraping/overpass-search";
import { searchOpenCorporatesCompanies } from "@/lib/scraping/opencorporates-search";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolMiss,
  recordScrapingToolSuccess,
  type ScrapingToolId,
} from "@/lib/scraping/tool-health";
import { searchWikidataDirectoryCompanies } from "@/lib/scraping/wikidata-directory-search";
import type { WebSearchResult } from "@/lib/scraping/web-search";

const log = createLogger("scraping.company-directory");

/** A company seed from an official or structured global directory (not a listicle site). */
export interface CompanyDirectorySeed extends WebSearchResult {
  source:
    | "google-places"
    | "overpass"
    | "opencorporates"
    | "wikidata"
    | "business-directory"
    | "public-database"
    | "apify";
  country: string | null;
  city: string | null;
  directoryListingSource?: BusinessDirectoryId;
  publicDatabaseSource?: PublicDatabaseId;
  phone?: string | null;
  socialLinks?: BusinessDirectorySocialLinks;
  completenessScore?: number;
  /** Google Maps category or directory industry label — helps search fit before enrichment. */
  industryHint?: string | null;
}

function isDirectoryEnabled(): boolean {
  const flag = process.env.COMPANY_DIRECTORY_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

type DirectorySourceId = Extract<
  ScrapingToolId,
  | "google-places"
  | "overpass"
  | "opencorporates"
  | "wikidata-directory"
  | "business-directory"
  | "public-database"
  | "apify-google-maps"
>;

async function runDirectorySource(
  tool: DirectorySourceId,
  search: () => Promise<CompanyDirectorySeed[]>
): Promise<CompanyDirectorySeed[]> {
  if (!isScrapingToolAvailable(tool)) {
    return [];
  }

  try {
    const results = await search();
    if (results.length > 0) {
      recordScrapingToolSuccess(tool);
    } else {
      recordScrapingToolMiss(tool);
    }
    return results;
  } catch (error) {
    log.warn("Directory source failed", { tool, error: String(error) });
    recordScrapingToolFailure(tool);
    return [];
  }
}

/**
 * Search free global company directories for structured seeds.
 * Only calls sources that have not been circuit-broken this session.
 */
export async function searchGlobalCompanyDirectories(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  companySizeMin?: number | null;
  companySizeMax?: number | null;
  maxResults?: number;
}): Promise<CompanyDirectorySeed[]> {
  if (!isDirectoryEnabled()) {
    return [];
  }

  const maxResults = input.maxResults ?? 15;
  const googlePlacesWeight = isGooglePlacesConfigured() ? 0.5 : 0;

  const sources: Array<{
    tool: DirectorySourceId;
    weight: number;
    run: (quota: number) => Promise<CompanyDirectorySeed[]>;
  }> = [
    ...(isGooglePlacesConfigured()
      ? [
          {
            tool: "google-places" as const,
            weight: googlePlacesWeight,
            run: (quota: number) =>
              runDirectorySource("google-places", () =>
                searchGooglePlacesCompanies({ ...input, maxResults: quota })
              ),
          },
        ]
      : []),
    {
      tool: "overpass",
      weight: 0.35,
      run: (quota) =>
        runDirectorySource("overpass", () =>
          searchOverpassCompanies({ ...input, maxResults: quota })
        ),
    },
    {
      tool: "wikidata-directory",
      weight: 0.2,
      run: (quota) =>
        runDirectorySource("wikidata-directory", () =>
          searchWikidataDirectoryCompanies({ ...input, maxResults: quota })
        ),
    },
    {
      tool: "opencorporates",
      weight: 0.15,
      run: (quota) =>
        runDirectorySource("opencorporates", () =>
          searchOpenCorporatesCompanies({ ...input, maxResults: quota })
        ),
    },
    {
      tool: "business-directory",
      weight: 0.35,
      run: (quota) =>
        runDirectorySource("business-directory", () =>
          searchBusinessDirectories({ ...input, maxResults: quota })
        ),
    },
    {
      tool: "public-database",
      weight: 0.2,
      run: (quota) =>
        runDirectorySource("public-database", () =>
          searchPublicDatabases({ ...input, maxResults: quota })
        ),
    },
    ...(isApifyEnabled()
      ? [
          {
            tool: "apify-google-maps" as const,
            weight: 0.4,
            run: (quota: number) =>
              runDirectorySource("apify-google-maps", () =>
                searchApifyGoogleMapsCompanies({ ...input, maxResults: quota })
              ),
          },
        ]
      : []),
  ];

  const activeSources = sources.filter((source) => isScrapingToolAvailable(source.tool));

  if (activeSources.length === 0) {
    log.warn("All directory sources disabled — skipping directory seeds");
    return [];
  }

  const totalWeight = activeSources.reduce((sum, source) => sum + source.weight, 0);
  const counts: Record<string, number> = {};

  const batches = await Promise.all(
    activeSources.map(async (source) => {
      const quota = Math.max(1, Math.ceil((source.weight / totalWeight) * maxResults));
      const results = await source.run(quota);
      counts[source.tool] = results.length;
      return results;
    })
  );

  const seen = new Set<string>();
  const merged: CompanyDirectorySeed[] = [];

  const rankedBatches = batches.flat().sort((a, b) => {
    const aScore = a.completenessScore ?? (a.source === "business-directory" ? 50 : 0);
    const bScore = b.completenessScore ?? (b.source === "business-directory" ? 50 : 0);
    return bScore - aScore;
  });

  for (const seed of rankedBatches) {
    const key = seed.domain ?? seed.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(seed);
    if (merged.length >= maxResults) break;
  }

  log.info("Global directory seeds merged", {
    activeSources: activeSources.map((s) => s.tool),
    counts,
    total: merged.length,
  });

  return merged;
}
