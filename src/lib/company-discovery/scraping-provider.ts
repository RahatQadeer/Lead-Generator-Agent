import {
  finalizeCompanyDiscovery,
  requireCompanySearchQuery,
} from "@/lib/company-discovery/discover-pipeline";
import type {
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

const log = createLogger("company-discovery.scraping");
const SEARCH_RESULT_MULTIPLIER = 40;

export class ScrapingCompanyDiscoveryProvider implements CompanyDiscoveryProvider {
  readonly name = "scraping";

  async search(params: CompanyDiscoveryParams): Promise<ProviderSearchResult> {
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
    });
  }
}
