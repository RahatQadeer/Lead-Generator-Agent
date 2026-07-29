/**
 * GET /api/pipeline/[jobId]
 *
 * Current state of a run. The progress snapshot lives in `scraper_jobs.report`,
 * written by the pipeline runner, so a client that lost its SSE connection — or
 * never opened one — can poll and get the same shape the stream emits.
 */
import { NextResponse } from "next/server";
import { getScraperJobById } from "@/lib/scrapers/services/scraper-queries";
import { createClient } from "@/lib/supabase/server";
import type { PipelineProgress } from "@/lib/pipeline/progress";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
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

    const { jobId } = await context.params;
    const job = await getScraperJobById(user.id, jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: { message: "Job not found." } },
        { status: 404 }
      );
    }

    // `report` holds a PipelineProgress snapshot for pipeline runs. Legacy runs
    // stored a different shape there, so only surface it when it looks right —
    // a stale legacy report would otherwise render as a broken progress bar.
    const report = job.report as Partial<PipelineProgress> | null;
    const progress =
      report && typeof report.percent === "number" && typeof report.phase === "string"
        ? (report as PipelineProgress)
        : null;

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        searchId: job.searchId,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorLog: job.errorLog ?? [],
      },
      progress,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    );
  }
}
