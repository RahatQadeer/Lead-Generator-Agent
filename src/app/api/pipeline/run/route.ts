/**
 * POST /api/pipeline/run
 *
 * Starts a provider-pipeline run. Two modes on the same endpoint:
 *
 *   Accept: text/event-stream  → runs inline and streams PipelineProgress
 *                                snapshots as they happen
 *   otherwise                  → enqueues (or runs inline when no queue is
 *                                configured) and returns the job id to poll
 *
 * The streaming mode exists because a search takes minutes and the builder needs
 * live phase/provider/company feedback; the polling mode exists because a
 * browser tab closing must not abandon the run.
 */
import { NextResponse } from "next/server";
import { createScraperJob } from "@/lib/scrapers/services/scraper-queries";
import { executePipelineJob } from "@/lib/pipeline/pipeline-service";
import { bootstrapProviders } from "@/lib/providers";
import { createSseResponse, wantsEventStream } from "@/lib/sse/stream";
import { createClient } from "@/lib/supabase/server";
import { getSearchById } from "@/lib/search/queries";
import { parsePipelineRunRequest } from "@/lib/pipeline/parse-run-request";

export const runtime = "nodejs";
/** A full run is minutes of work; the default serverless budget is far short. */
export const maxDuration = 800;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: "Authentication required." } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  const parsed = parsePipelineRunRequest(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: { message: parsed.error } },
      { status: 400 }
    );
  }
  const input = parsed.value;

  if (input.searchId) {
    const search = await getSearchById(user.id, input.searchId);
    if (!search) {
      return NextResponse.json(
        { success: false, error: { message: "Search not found." } },
        { status: 404 }
      );
    }
  }

  bootstrapProviders();

  // The job row is created up front in both modes so the client always has an
  // id to poll or stop, even if the run dies immediately.
  const job = await createScraperJob({
    userId: user.id,
    searchId: input.searchId,
    // The legacy column expects source ids; store the company providers so the
    // history view stays meaningful for pipeline runs too.
    sources: input.providerIds as never,
    options: { maxCompanies: input.criteria.limit ?? 0 },
    filters: {},
  });

  if (wantsEventStream(request)) {
    return createSseResponse(async (emit) => {
      emit("progress", { jobId: job.id, phase: "starting", percent: 0 });

      const result = await executePipelineJob({
        userId: user.id,
        searchId: input.searchId,
        jobId: job.id,
        criteria: input.criteria,
        roleKeys: input.roleKeys,
        providerIds: input.providerIds.length ? input.providerIds : undefined,
        enrichCompanies: input.enrichCompanies,
        onProgress: (progress) => emit("progress", progress),
      });

      emit("done", { success: true, ...result });
    });
  }

  // Non-streaming: run inline. A queue-backed path is wired separately in the
  // worker; this keeps the endpoint usable when Redis is not configured.
  const result = await executePipelineJob({
    userId: user.id,
    searchId: input.searchId,
    jobId: job.id,
    criteria: input.criteria,
    roleKeys: input.roleKeys,
    providerIds: input.providerIds.length ? input.providerIds : undefined,
    enrichCompanies: input.enrichCompanies,
  });

  return NextResponse.json({ success: true, ...result });
}
