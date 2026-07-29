/**
 * The search runner: owns a job's lifecycle from request to saved results.
 *
 * Replaces the execution half of `scrapers/services/scraper-service.ts`. That
 * module stays in place until this path is verified end-to-end; both write to
 * the same `scraper_jobs` row, so the API routes and UI work either way.
 *
 * Responsibilities:
 *   - create / update the job row
 *   - run the provider pipeline
 *   - persist progress snapshots so a reconnecting client or a poller can see
 *     live state without holding the SSE connection open
 *   - save results
 *   - record execution logs and the final report
 */
import { createLogger } from "@/lib/logger";
import { runPipeline, type PipelineInput, type PipelineResult } from "@/lib/pipeline/run-pipeline";
import { saveResults } from "@/lib/pipeline/save-results";
import type { PipelineProgress } from "@/lib/pipeline/progress";
import { ProviderError } from "@/lib/providers/errors";
import { clearRunProviderState } from "@/lib/providers/execute";
import { getKnownCompanyDedupKeysAdmin } from "@/lib/companies/persist-admin";
import {
  clearScraperAbortController,
  registerScraperAbortController,
} from "@/lib/scrapers/services/abort-registry";
import { updateScraperJob } from "@/lib/scrapers/services/scraper-queries";
import type { CompanyCriteria } from "@/lib/providers/types";

const log = createLogger("pipeline.service");

/**
 * How often a progress snapshot is written to the job row.
 *
 * The tracker emits on every count change — hundreds of times a minute. Writing
 * each one would turn a search into a write-amplification problem against
 * Postgres for data nobody reads at that resolution. In-memory listeners (SSE)
 * still get every event; only the persisted copy is throttled.
 */
const PROGRESS_PERSIST_INTERVAL_MS = 2_000;

export interface ExecutePipelineInput {
  userId: string;
  searchId: string | null;
  jobId: string;
  criteria: CompanyCriteria;
  roleKeys: string[];
  /** Restrict to specific company providers, e.g. ["scraper:ycombinator"]. */
  providerIds?: string[];
  enrichCompanies?: boolean;
  /** Live progress for an attached SSE stream. */
  onProgress?: (progress: PipelineProgress) => void;
}

export interface ExecutePipelineResult {
  jobId: string;
  companiesFound: number;
  companiesSaved: number;
  peopleFound: number;
  contactsFound: number;
  duplicatesRemoved: number;
  degradedProviders: string[];
  status: "completed" | "failed" | "stopped";
}

export async function executePipelineJob(
  input: ExecutePipelineInput
): Promise<ExecutePipelineResult> {
  const controller = registerScraperAbortController(input.jobId);
  const startedAt = new Date().toISOString();

  await updateScraperJob(input.jobId, { status: "running", startedAt }, true);

  let lastPersistedAt = 0;
  // Held in an object rather than a bare `let`: the only writer is the progress
  // callback, which control-flow analysis cannot see, so a plain variable stays
  // narrowed to `null` at every read site.
  const state: { latest: PipelineProgress | null } = { latest: null };

  const persistProgress = async (progress: PipelineProgress, force = false) => {
    const now = Date.now();
    if (!force && now - lastPersistedAt < PROGRESS_PERSIST_INTERVAL_MS) return;
    lastPersistedAt = now;
    try {
      await updateScraperJob(input.jobId, { report: progress as never }, true);
    } catch (error) {
      // Progress is observability, not the product — never fail a run over it.
      log.debug("Progress persist failed", { jobId: input.jobId, error: String(error) });
    }
  };

  const onProgress = (progress: PipelineProgress) => {
    state.latest = progress;
    input.onProgress?.(progress);
    void persistProgress(progress);
  };

  try {
    const knownDedupKeys = await getKnownCompanyDedupKeysAdmin(input.userId);

    const pipelineInput: PipelineInput = {
      jobId: input.jobId,
      userId: input.userId,
      searchId: input.searchId,
      criteria: input.criteria,
      roleKeys: input.roleKeys,
      providerIds: input.providerIds,
      enrichCompanies: input.enrichCompanies,
      // Re-running a search must UPDATE its own rows, so the known-keys guard is
      // only applied when this run is not attached to a search. Passing it for a
      // re-run would filter out every company found last time and save nothing.
      knownDedupKeys: input.searchId ? undefined : knownDedupKeys,
      signal: controller.signal,
      onProgress,
    };

    const result: PipelineResult = await runPipeline(pipelineInput);

    const saved = await saveResultsForRun(input, result, onProgress);

    const counts = state.latest?.counts;
    const finalReport: ExecutePipelineResult = {
      jobId: input.jobId,
      companiesFound: counts?.companiesFound ?? result.companies.length,
      companiesSaved: saved.companiesSaved,
      peopleFound: counts?.peopleFound ?? 0,
      contactsFound: counts?.contactsFound ?? 0,
      duplicatesRemoved: result.duplicatesRemoved,
      degradedProviders: result.degradedProviders,
      status: "completed",
    };

    if (state.latest) await persistProgress(state.latest, true);

    await updateScraperJob(
      input.jobId,
      {
        status: "completed",
        completedAt: new Date().toISOString(),
        errorLog: (state.latest?.errors ?? []).map(
          (entry) => `[${entry.phase}] ${entry.provider ?? "pipeline"}: ${entry.message}`
        ),
      },
      true
    );

    log.info("Pipeline job completed", { ...finalReport });
    return finalReport;
  } catch (error) {
    const aborted = error instanceof ProviderError && error.code === "ABORTED";
    const message = error instanceof Error ? error.message : String(error);

    if (state.latest) await persistProgress(state.latest, true);

    await updateScraperJob(
      input.jobId,
      {
        status: aborted ? "stopped" : "failed",
        completedAt: new Date().toISOString(),
        errorLog: [message],
      },
      true
    );

    log.error("Pipeline job failed", { jobId: input.jobId, aborted, error: message });

    if (aborted) {
      return {
        jobId: input.jobId,
        companiesFound: 0,
        companiesSaved: 0,
        peopleFound: 0,
        contactsFound: 0,
        duplicatesRemoved: 0,
        degradedProviders: [],
        status: "stopped",
      };
    }
    throw error;
  } finally {
    clearScraperAbortController(input.jobId);
    clearRunProviderState(input.jobId);
  }
}

/**
 * Save, reporting through the same progress channel.
 *
 * Split out so a save failure is attributable in the progress errors rather than
 * surfacing as an opaque job failure after all the work succeeded.
 */
async function saveResultsForRun(
  input: ExecutePipelineInput,
  result: PipelineResult,
  onProgress: (progress: PipelineProgress) => void
): Promise<{ companiesSaved: number; contactsSaved: number }> {
  // The tracker inside runPipeline has already finished; build a lightweight one
  // for the save phase so its progress still reaches the same listeners.
  const { ProgressTracker } = await import("@/lib/pipeline/progress");
  const tracker = new ProgressTracker(input.jobId, onProgress);

  try {
    return await saveResults({
      userId: input.userId,
      searchId: input.searchId,
      companies: result.companies,
      tracker,
    });
  } catch (error) {
    tracker.recordError(`Save failed: ${String(error)}`);
    throw error;
  }
}
