import {
  finalizeCompanyDiscovery,
  requireCompanySearchQuery,
} from "@/lib/company-discovery/discover-pipeline";
import type {
  CompanyDiscoveryContext,
  CompanyDiscoveryProvider,
  ProviderSearchResult,
} from "@/lib/company-discovery/types";
import { createLogger } from "@/lib/logger";
import { searchGlobalCompanyDirectories } from "@/lib/scraping/company-directory-seeds";
import { mergeCompanySeeds } from "@/lib/scraping/merge-company-seeds";
import {
  buildCompanySearchQuery,
  searchWebCompanies,
} from "@/lib/scraping/web-search";
import type { CompanyDiscoveryParams } from "@/types/company";
import { isYcFocusedDiscovery } from "@/lib/company-discovery/yc-scraper-config";

const log = createLogger("company-discovery.scraping");
const SEARCH_RESULT_MULTIPLIER = 100;

export class ScrapingCompanyDiscoveryProvider implements CompanyDiscoveryProvider {
  readonly name = "scraping";

  async search(
    params: CompanyDiscoveryParams,
    ctx?: CompanyDiscoveryContext
  ): Promise<ProviderSearchResult> {
    if (isYcFocusedDiscovery()) {
      ctx?.onProgress?.({ phase: "Using Y Combinator as primary source…" });
      return {
        companies: [],
        pagination: {
          page: params.page,
          perPage: params.perPage,
          totalEntries: 0,
          totalPages: 1,
          hasMore: false,
        },
        stats: {
          seedCount: 0,
          enrichedCount: 0,
          filteredCount: 0,
        },
      };
    }

    const query = requireCompanySearchQuery(params, () =>
      buildCompanySearchQuery({
        industry: params.industry,
        country: params.country,
        keywords: params.keywords,
        technologies: params.technologies,
        companySizeMin: params.companySizeMin,
        companySizeMax: params.companySizeMax,
      })
    );

    ctx?.onProgress?.({ phase: "Searching directories and web…" });

    const maxSeeds = params.perPage * SEARCH_RESULT_MULTIPLIER;

    const [directorySeeds, searchResults] = await Promise.all([
      searchGlobalCompanyDirectories({
        industry: params.industry,
        country: params.country,
        keywords: params.keywords,
        searchName: params.searchName,
        companySizeMin: params.companySizeMin,
        companySizeMax: params.companySizeMax,
        maxResults: maxSeeds,
      }),
      searchWebCompanies(query, maxSeeds, {
        industry: params.industry,
        country: params.country,
        keywords: params.keywords,
        searchName: params.searchName,
        companySizeMin: params.companySizeMin,
        companySizeMax: params.companySizeMax,
      }),
    ]);

    const mergedSeeds = mergeCompanySeeds(directorySeeds, searchResults, maxSeeds);

    if (directorySeeds.length > 0) {
      log.info("Directory seeds merged with web search", {
        directory: directorySeeds.length,
        web: searchResults.length,
        merged: mergedSeeds.length,
      });
    }

    return finalizeCompanyDiscovery(params, mergedSeeds, {
      emptyLogMessage: `No companies found from web search (${query})`,
      onProgress: ctx?.onProgress,
    });
  }
}
