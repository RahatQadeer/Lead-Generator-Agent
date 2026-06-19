import { Queue, Worker, type Job } from "bullmq";
import { discoverCompanies } from "@/lib/company-discovery/discover";
import { detachCompaniesFromSearchAdmin, persistDiscoveredCompaniesForUser } from "@/lib/companies/persist-admin";
import { hasAdminClient } from "@/lib/supabase/admin";
import { createLogger } from "@/lib/logger";
import { getQueueConnectionOptions, isQueueEnabled } from "@/lib/queue/connection";
import type { CompanyDiscoveryParams } from "@/types/company";

const log = createLogger("queue.company-discovery");
export const COMPANY_DISCOVERY_QUEUE = "company-discovery";

export interface CompanyDiscoveryJobData {
  userId: string;
  searchId: string;
  params: CompanyDiscoveryParams;
  knownDedupKeys: string[];
}

export interface CompanyDiscoveryJobResult {
  provider: string;
  companies: Awaited<ReturnType<typeof discoverCompanies>>["companies"];
  pagination: Awaited<ReturnType<typeof discoverCompanies>>["pagination"];
  meta: {
    filteredCount: number;
    excludedCount: number;
    duplicateCount: number;
    batchDuplicateCount: number;
    knownDuplicateCount: number;
    attempts: number;
  };
}

let queue: Queue | null = null;

export function getCompanyDiscoveryQueue() {
  if (!isQueueEnabled()) return null;

  if (!queue) {
    queue = new Queue(COMPANY_DISCOVERY_QUEUE, {
      connection: getQueueConnectionOptions(),
    });
  }

  return queue;
}

export async function enqueueCompanyDiscovery(
  data: CompanyDiscoveryJobData
): Promise<string | null> {
  const q = getCompanyDiscoveryQueue();
  if (!q) return null;

  const job = await q.add("discover", data as CompanyDiscoveryJobData, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: "exponential", delay: 2000 },
  });

  return job.id ?? null;
}

export async function getCompanyDiscoveryJob(jobId: string) {
  const q = getCompanyDiscoveryQueue();
  if (!q) return null;
  return q.getJob(jobId);
}

export function startCompanyDiscoveryWorker() {
  const worker = new Worker(
    COMPANY_DISCOVERY_QUEUE,
    async (job: Job<CompanyDiscoveryJobData>) => {
      const result = await discoverCompanies(job.data.params, {
        knownDedupKeys: new Set(job.data.knownDedupKeys),
      });

      if (!hasAdminClient()) {
        throw new Error(
          "SUPABASE_SERVICE_ROLE_KEY is required for async company discovery worker."
        );
      }

      if (job.data.params.page === 1 && result.companies.length > 0) {
        await detachCompaniesFromSearchAdmin(job.data.userId, job.data.searchId);
      }

      await persistDiscoveredCompaniesForUser(
        job.data.userId,
        job.data.searchId,
        result.provider,
        result.companies
      );

      return {
        provider: result.provider,
        companies: result.companies,
        pagination: result.pagination,
        meta: {
          filteredCount: result.filteredCount,
          excludedCount: result.excludedCount,
          duplicateCount: result.duplicateCount,
          batchDuplicateCount: result.batchDuplicateCount,
          knownDuplicateCount: result.knownDuplicateCount,
          attempts: result.attempts,
        },
      };
    },
    { connection: getQueueConnectionOptions(), concurrency: 2 }
  );

  worker.on("completed", (job) => {
    log.info("Company discovery job completed", { jobId: job.id });
  });

  worker.on("failed", (job, error) => {
    log.error("Company discovery job failed", {
      jobId: job?.id,
      error: String(error),
    });
  });

  log.info("Company discovery worker started");
  return worker;
}
