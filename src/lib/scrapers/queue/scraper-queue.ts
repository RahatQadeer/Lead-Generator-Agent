import { Queue, Worker, type Job } from "bullmq";
import { executeScraperJob } from "@/lib/scrapers/services/scraper-service";
import type { ScraperFilters, ScraperRunOptions, ScraperSourceId } from "@/lib/scrapers/types";
import { createLogger } from "@/lib/logger";
import { getQueueConnectionOptions, isQueueEnabled } from "@/lib/queue/connection";

const log = createLogger("queue.scraper");

export const SCRAPER_QUEUE = "directory-scraper";

export interface ScraperJobData {
  userId: string;
  searchId: string | null;
  scraperJobId: string;
  sources: ScraperSourceId[];
  options: ScraperRunOptions;
  filters?: ScraperFilters;
}

let queue: Queue | null = null;

export function getScraperQueue() {
  if (!isQueueEnabled()) return null;

  if (!queue) {
    queue = new Queue(SCRAPER_QUEUE, {
      connection: getQueueConnectionOptions(),
    });
  }

  return queue;
}

export async function enqueueScraperJob(
  data: ScraperJobData
): Promise<string | null> {
  const q = getScraperQueue();
  if (!q) return null;

  const job = await q.add("scrape", data, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: "exponential", delay: 3_000 },
  });

  return job.id ?? null;
}

export async function getScraperQueueJob(jobId: string) {
  const q = getScraperQueue();
  if (!q) return null;
  return q.getJob(jobId);
}

export function startScraperWorker() {
  const worker = new Worker(
    SCRAPER_QUEUE,
    async (job: Job<ScraperJobData>) => {
      await executeScraperJob({
        userId: job.data.userId,
        searchId: job.data.searchId,
        scraperJobId: job.data.scraperJobId,
        sources: job.data.sources,
        options: job.data.options,
        filters: job.data.filters,
      });
      return { ok: true };
    },
    { connection: getQueueConnectionOptions(), concurrency: 1 }
  );

  worker.on("completed", (job) => {
    log.info("Scraper queue job completed", { jobId: job.id });
  });

  worker.on("failed", (job, error) => {
    log.error("Scraper queue job failed", {
      jobId: job?.id,
      error: String(error),
    });
  });

  log.info("Directory scraper worker started");
  return worker;
}
