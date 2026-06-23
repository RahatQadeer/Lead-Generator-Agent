import { finalizeCompanyDiscovery, requireCompanySearchQuery } from "@/lib/company-discovery/discover-pipeline";
import { CompanyDiscoveryError } from "@/lib/company-discovery/errors";
import type {
  CompanyDiscoveryProvider,
  ProviderSearchResult,
} from "@/lib/company-discovery/types";
import { createLogger } from "@/lib/logger";
import { searchApifyGoogleMapsCompanies } from "@/lib/apify/google-maps-search";
import { isApifyEnabled } from "@/lib/apify/config";
import { searchGlobalCompanyDirectories } from "@/lib/scraping/company-directory-seeds";
import { mergeCompanySeeds } from "@/lib/scraping/merge-company-seeds";
import {
  buildCompanySearchQuery,
  searchWebCompanies,
} from "@/lib/scraping/web-search";
import { parseSearchIntent } from "@/lib/search/search-intent";
import type { CompanyDiscoveryParams } from "@/types/company";

const log = createLogger("company-discovery.apify");
const SEARCH_RESULT_MULTIPLIER = 100;

export class ApifyCompanyDiscoveryProvider implements CompanyDiscoveryProvider {
  readonly name = "apify";

  async search(params: CompanyDiscoveryParams): Promise<ProviderSearchResult> {
    if (!isApifyEnabled()) {
      throw new CompanyDiscoveryError(
        "PROVIDER_NOT_CONFIGURED",
        "Apify is not configured. Set APIFY_API_TOKEN in your environment.",
        { statusCode: 500, retryable: false }
      );
    }

    const query = requireCompanySearchQuery(params, () =>
      buildCompanySearchQuery({
        industry: params.industry,
        country: params.country,
        keywords: params.keywords,
        technologies: params.technologies,
      })
    );

    const maxSeeds = params.perPage * SEARCH_RESULT_MULTIPLIER;

    const [apifySeeds, directorySeeds] = await Promise.all([
      searchApifyGoogleMapsCompanies({
        industry: params.industry,
        country: params.country,
        keywords: params.keywords,
        searchName: params.searchName,
        maxResults: maxSeeds,
      }),
      searchGlobalCompanyDirectories({
        industry: params.industry,
        country: params.country,
        keywords: params.keywords,
        searchName: params.searchName,
        maxResults: Math.ceil(maxSeeds / 4),
      }),
    ]);

    const webBudget = apifySeeds.length >= params.perPage ? Math.ceil(maxSeeds / 3) : maxSeeds;
    const intent = parseSearchIntent({
      searchName: params.searchName,
      industry: params.industry,
      country: params.country,
      keywords: params.keywords,
    });

    const searchResults =
      webBudget > 0
        ? await searchWebCompanies(
            intent.queryVariants[0] ?? query,
            webBudget,
            {
              industry: params.industry,
              country: params.country,
              keywords: params.keywords,
              searchName: params.searchName,
            }
          )
        : [];

    const mergedSeeds = mergeCompanySeeds(
      [...apifySeeds, ...directorySeeds],
      searchResults,
      maxSeeds
    );

    log.info("Apify company seeds merged", {
      apify: apifySeeds.length,
      directory: directorySeeds.length,
      web: searchResults.length,
      merged: mergedSeeds.length,
    });

    return finalizeCompanyDiscovery(params, mergedSeeds, {
      idPrefix: "apify",
      emptyLogMessage: `No companies found from Apify + directories (${query})`,
    });
  }
}
