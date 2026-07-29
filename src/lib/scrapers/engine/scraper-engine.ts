import { DEFAULT_SCRAPER_OPTIONS } from "@/lib/scrapers/base-scraper";
import { ScraperFactory } from "@/lib/scrapers/scraper-factory";
import type {
  ScraperEngineResult,
  ScraperRunContext,
  ScraperRunOptions,
  ScraperRunReport,
  ScraperSourceId,
  ScraperSourceReport,
  ScrapedCompanyProfile,
} from "@/lib/scrapers/types";
import { dedupeScrapedProfiles } from "@/lib/scrapers/utils/dedupe";
import { getSourceBackers } from "@/lib/scrapers/source-catalog";
import {
  matchesFilters,
  normalizeScraperFilters,
} from "@/lib/scrapers/filters";
import { toDiscoveredCompany } from "@/lib/scrapers/utils/to-discovered-company";
import {
  cleanProfileText,
  enrichProfileFromWebsite,
  mergeProfileWarnings,
} from "@/lib/scrapers/utils/website-enrich";
import { validateScrapedProfile } from "@/lib/scrapers/utils/validate";
import { createLogger } from "@/lib/logger";
import pLimit from "p-limit";

const log = createLogger("scrapers.engine");

export interface RunScraperEngineInput {
  ctx: ScraperRunContext;
  sources: ScraperSourceId[];
  options?: ScraperRunOptions;
  knownDedupKeys?: ReadonlySet<string>;
}

export class ScraperEngine {
  async run(input: RunScraperEngineInput): Promise<ScraperEngineResult> {
    const options: Required<ScraperRunOptions> = {
      ...DEFAULT_SCRAPER_OPTIONS,
      ...input.options,
    };

    const startedAt = new Date().toISOString();
    const sourceReports: ScraperSourceReport[] = [];
    const allProfiles: ScrapedCompanyProfile[] = [];
    const filters = normalizeScraperFilters(input.ctx.filters);

    for (const source of input.sources) {
      if (input.ctx.signal.aborted) break;

      const sourceStartedAt = new Date().toISOString();
      const report: ScraperSourceReport = {
        source,
        startedAt: sourceStartedAt,
        completedAt: null,
        companiesFound: 0,
        companiesSaved: 0,
        filteredCount: 0,
        duplicateCount: 0,
        errorCount: 0,
        failedUrls: [],
        errors: [],
      };

      try {
        const scraper = ScraperFactory.create(source);
        const rawProfiles = await scraper.run(input.ctx, options);
        report.companiesFound = rawProfiles.length;

        // Stamp the source's inherent backer(s) — a VC portfolio or accelerator
        // *is* the investor. Merged (deduped) with anything the scraper found.
        const backers = getSourceBackers(source);
        for (const profile of rawProfiles) {
          profile.investors = Array.from(
            new Set([...backers, ...(profile.investors ?? [])])
          );
        }

        const enrichedProfiles = await this.enrichProfiles(rawProfiles, options, input.ctx);
        const validatedProfiles = enrichedProfiles
          .map((profile) => {
            const cleaned = cleanProfileText(profile);
            const validation = validateScrapedProfile(cleaned);
            if (!validation.valid) {
              report.errors.push(...validation.errors.map((error) => `${cleaned.name}: ${error}`));
              return null;
            }
            return mergeProfileWarnings(cleaned, validation.warnings);
          })
          .filter((profile): profile is ScrapedCompanyProfile => profile !== null);

        const matchedProfiles = filters.isEmpty
          ? validatedProfiles
          : validatedProfiles.filter((profile) => {
              const result = matchesFilters(profile, filters);
              if (!result.match) {
                log.debug("Profile filtered out", {
                  source,
                  company: profile.name,
                  reasons: result.reasons,
                });
              }
              return result.match;
            });
        report.filteredCount = validatedProfiles.length - matchedProfiles.length;

        const { unique, duplicateCount } = dedupeScrapedProfiles(
          matchedProfiles,
          input.knownDedupKeys
        );

        report.duplicateCount = duplicateCount;
        report.companiesSaved = unique.length;
        report.errorCount = report.errors.length;
        allProfiles.push(...unique);
      } catch (error) {
        const message = String(error);
        report.errors.push(message);
        report.errorCount += 1;
        log.error("Source scrape failed", { source, error: message });
      } finally {
        report.completedAt = new Date().toISOString();
        sourceReports.push(report);
      }
    }

    const { unique: finalProfiles, duplicateCount: crossSourceDuplicates } =
      dedupeScrapedProfiles(allProfiles, input.knownDedupKeys);

    const companies = finalProfiles.map(toDiscoveredCompany);
    const report: ScraperRunReport = {
      jobId: input.ctx.jobId,
      sources: sourceReports,
      totalFound: allProfiles.length,
      totalSaved: finalProfiles.length,
      totalFiltered: sourceReports.reduce((sum, item) => sum + item.filteredCount, 0),
      totalDuplicates:
        sourceReports.reduce((sum, item) => sum + item.duplicateCount, 0) +
        crossSourceDuplicates,
      totalErrors: sourceReports.reduce((sum, item) => sum + item.errorCount, 0),
      startedAt,
      completedAt: new Date().toISOString(),
    };

    return {
      companies,
      profiles: finalProfiles,
      report,
    };
  }

  private async enrichProfiles(
    profiles: ScrapedCompanyProfile[],
    options: Required<ScraperRunOptions>,
    ctx: ScraperRunContext
  ): Promise<ScrapedCompanyProfile[]> {
    if (!options.enrichFromWebsite) return profiles;

    const limit = pLimit(options.concurrency);
    return Promise.all(
      profiles.map((profile) =>
        limit(async () => {
          if (ctx.signal.aborted) return profile;
          return enrichProfileFromWebsite(profile, {
            respectRobots: options.respectRobots,
          });
        })
      )
    );
  }
}

export const scraperEngine = new ScraperEngine();
