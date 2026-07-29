import { getKnownCompanyDedupKeysAdmin, persistDiscoveredCompaniesForUser } from "@/lib/companies/persist-admin";
import { scraperEngine } from "@/lib/scrapers/engine/scraper-engine";
import {
  clearScraperAbortController,
  registerScraperAbortController,
  stopScraperJob,
} from "@/lib/scrapers/services/abort-registry";
import {
  createScraperJob,
  getScraperJobById,
  listScraperJobHistory,
  updateScraperJob,
} from "@/lib/scrapers/services/scraper-queries";
import { ScraperFactory } from "@/lib/scrapers/scraper-factory";
import type {
  ScraperFilters,
  ScraperRunOptions,
  ScraperSourceId,
} from "@/lib/scrapers/types";
import {
  buildDirectoryProfile,
  providerNameForSource,
  toDiscoveredCompany,
} from "@/lib/scrapers/utils/to-discovered-company";
import { createLogger } from "@/lib/logger";
import { enqueueScraperJob } from "@/lib/scrapers/queue/scraper-queue";
import { isQueueEnabled } from "@/lib/queue/connection";
import { getCompanyDedupKey } from "@/lib/company-discovery/apply-dedup";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistStartupProfiles } from "@/lib/supabase/startup-db";
import type { Json } from "@/types/database";
import type { DiscoveredCompany } from "@/types/company";

const log = createLogger("scrapers.service");

export interface StartScraperInput {
  userId: string;
  searchId: string | null;
  sources: string[];
  options?: ScraperRunOptions;
  filters?: ScraperFilters;
  async?: boolean;
}

export async function startScraperRun(input: StartScraperInput) {
  const sources = input.sources.filter((source): source is ScraperSourceId =>
    ScraperFactory.isValidSource(source)
  );

  if (sources.length === 0) {
    throw new Error("At least one valid scraper source is required.");
  }

  const job = await createScraperJob({
    userId: input.userId,
    searchId: input.searchId,
    sources,
    options: input.options ?? {},
    filters: input.filters ?? {},
  });

  if (input.async && isQueueEnabled()) {
    const bullmqJobId = await enqueueScraperJob({
      userId: input.userId,
      searchId: input.searchId,
      scraperJobId: job.id,
      sources,
      options: input.options ?? {},
      filters: input.filters ?? {},
    });

    if (bullmqJobId) {
      await updateScraperJob(job.id, { bullmqJobId });
    }

    return { jobId: job.id, async: true, bullmqJobId };
  }

  await executeScraperJob({
    userId: input.userId,
    searchId: input.searchId,
    scraperJobId: job.id,
    sources,
    options: input.options ?? {},
    filters: input.filters ?? {},
  });

  const completed = await getScraperJobById(input.userId, job.id);
  return { jobId: job.id, async: false, job: completed };
}

export async function executeScraperJob(input: {
  userId: string;
  searchId: string | null;
  scraperJobId: string;
  sources: ScraperSourceId[];
  options: ScraperRunOptions;
  filters?: ScraperFilters;
}): Promise<void> {
  const controller = registerScraperAbortController(input.scraperJobId);
  const startedAt = new Date().toISOString();

  await updateScraperJob(
    input.scraperJobId,
    { status: "running", startedAt },
    true
  );

  try {
    const knownDedupKeys = await getKnownCompanyDedupKeysAdmin(input.userId);
    const result = await scraperEngine.run({
      ctx: {
        userId: input.userId,
        searchId: input.searchId,
        jobId: input.scraperJobId,
        options: {
          maxCompanies: input.options.maxCompanies ?? 100,
          maxPages: input.options.maxPages ?? 10,
          enrichFromWebsite: input.options.enrichFromWebsite ?? true,
          concurrency: input.options.concurrency ?? 3,
          respectRobots: input.options.respectRobots ?? true,
          minIntervalMs: input.options.minIntervalMs ?? 1_200,
        },
        filters: input.filters ?? {},
        signal: controller.signal,
      },
      sources: input.sources,
      options: input.options,
      knownDedupKeys,
    });

    // Global startup catalog: shared reference data, so this runs for every job
    // — including jobs with no searchId, whose results would otherwise be
    // discarded. Never throws; catalog ingestion must not fail the user's job.
    await persistStartupProfiles(result.profiles);

    if (input.searchId && result.companies.length > 0) {
      await persistDirectoryCompanies(
        input.userId,
        input.searchId,
        result.profiles,
        result.companies
      );
    }

    await updateScraperJob(
      input.scraperJobId,
      {
        status: controller.signal.aborted ? "stopped" : "completed",
        report: result.report,
        completedAt: new Date().toISOString(),
      },
      true
    );

    log.info("Scraper job completed", {
      jobId: input.scraperJobId,
      saved: result.report.totalSaved,
      duplicates: result.report.totalDuplicates,
    });
  } catch (error) {
    const message = String(error);
    await updateScraperJob(
      input.scraperJobId,
      {
        status: controller.signal.aborted ? "stopped" : "failed",
        errorLog: [message],
        completedAt: new Date().toISOString(),
      },
      true
    );
    log.error("Scraper job failed", { jobId: input.scraperJobId, error: message });
    throw error;
  } finally {
    clearScraperAbortController(input.scraperJobId);
  }
}

async function persistDirectoryCompanies(
  userId: string,
  searchId: string,
  profiles: Awaited<ReturnType<typeof scraperEngine.run>>["profiles"],
  companies: DiscoveredCompany[]
): Promise<void> {
  const supabase = createAdminClient();
  const profileByKey = new Map(
    profiles.map((profile) => {
      const company = toDiscoveredCompany(profile);
      const key = getCompanyDedupKey(company);
      return [key, profile] as const;
    })
  );

  for (const company of companies) {
    const key = getCompanyDedupKey(company);
    const profile = key ? profileByKey.get(key) : null;
    const provider = profile ? providerNameForSource(profile.source) : "directory";
    const directoryProfile = profile ? buildDirectoryProfile(profile) : null;

    await persistDiscoveredCompaniesForUser(userId, searchId, provider, [company]);

    if (directoryProfile && key) {
      await supabase
        .from("companies")
        .update({
          directory_profile: directoryProfile as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("dedup_key", key);
    }
  }
}

export async function getScraperStatus(userId: string, jobId: string) {
  return getScraperJobById(userId, jobId);
}

export async function getScraperHistory(userId: string, limit?: number) {
  return listScraperJobHistory(userId, limit);
}

export async function stopScraperRun(userId: string, jobId: string) {
  const job = await getScraperJobById(userId, jobId);
  if (!job) {
    throw new Error("Scraper job not found.");
  }

  if (job.status !== "running" && job.status !== "pending") {
    return { stopped: false, reason: "Job is not active." };
  }

  const stopped = stopScraperJob(jobId);
  await updateScraperJob(jobId, {
    status: "stopped",
    completedAt: new Date().toISOString(),
  });

  return { stopped, reason: stopped ? "Stop signal sent." : "No active controller." };
}
