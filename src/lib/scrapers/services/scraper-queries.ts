import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";
import type {
  ScraperFilters,
  ScraperJobStatus,
  ScraperRunOptions,
  ScraperRunReport,
  ScraperSourceId,
} from "@/lib/scrapers/types";

export interface ScraperJobRecord {
  id: string;
  userId: string;
  searchId: string | null;
  sources: ScraperSourceId[];
  status: ScraperJobStatus;
  options: ScraperRunOptions;
  report: ScraperRunReport | null;
  errorLog: string[];
  bullmqJobId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): ScraperJobRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    searchId: row.search_id ? String(row.search_id) : null,
    sources: (row.sources as ScraperSourceId[]) ?? [],
    status: row.status as ScraperJobStatus,
    options: (row.options as ScraperRunOptions) ?? {},
    report: (row.report as ScraperRunReport | null) ?? null,
    errorLog: (row.error_log as string[]) ?? [],
    bullmqJobId: row.bullmq_job_id ? String(row.bullmq_job_id) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function createScraperJob(input: {
  userId: string;
  searchId: string | null;
  sources: ScraperSourceId[];
  options: ScraperRunOptions;
  filters?: ScraperFilters;
  bullmqJobId?: string | null;
}): Promise<ScraperJobRecord> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Filters are persisted alongside options (no dedicated column needed) so a
  // job record fully describes the search that produced it.
  const optionsPayload = {
    ...input.options,
    filters: input.filters ?? {},
  };

  const { data, error } = await supabase
    .from("scraper_jobs")
    .insert({
      user_id: input.userId,
      search_id: input.searchId,
      sources: input.sources,
      status: "pending",
      options: optionsPayload as unknown as Json,
      bullmq_job_id: input.bullmqJobId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create scraper job");
  }

  return mapRow(data);
}

export async function updateScraperJob(
  jobId: string,
  patch: Partial<{
    status: ScraperJobStatus;
    report: ScraperRunReport | null;
    errorLog: string[];
    startedAt: string | null;
    completedAt: string | null;
    bullmqJobId: string | null;
  }>,
  useAdmin = false
): Promise<void> {
  const supabase = useAdmin ? createAdminClient() : await createClient();
  const updatePayload: Database["public"]["Tables"]["scraper_jobs"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (patch.status) updatePayload.status = patch.status;
  if (patch.report !== undefined) updatePayload.report = patch.report as Json;
  if (patch.errorLog) updatePayload.error_log = patch.errorLog as Json;
  if (patch.startedAt !== undefined) updatePayload.started_at = patch.startedAt;
  if (patch.completedAt !== undefined) updatePayload.completed_at = patch.completedAt;
  if (patch.bullmqJobId !== undefined) updatePayload.bullmq_job_id = patch.bullmqJobId;

  const { error } = await supabase
    .from("scraper_jobs")
    .update(updatePayload as Database["public"]["Tables"]["scraper_jobs"]["Update"])
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to update scraper job: ${error.message}`);
  }
}

export async function getScraperJobById(
  userId: string,
  jobId: string
): Promise<ScraperJobRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scraper_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

export async function listScraperJobHistory(
  userId: string,
  limit = 20
): Promise<ScraperJobRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scraper_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(mapRow);
}

export async function getScraperJobByIdAdmin(jobId: string): Promise<ScraperJobRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("scraper_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}
