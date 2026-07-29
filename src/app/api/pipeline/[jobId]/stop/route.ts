/**
 * POST /api/pipeline/[jobId]/stop
 *
 * Aborts a running pipeline. The abort registry is process-local, so this only
 * reaches a run executing in THIS process — an inline (SSE) run. A queued run
 * executing in the worker is stopped by the worker observing the job row, which
 * is why the status is written even when no local controller is found.
 */
import { NextResponse } from "next/server";
import { stopScraperJob } from "@/lib/scrapers/services/abort-registry";
import {
  getScraperJobById,
  updateScraperJob,
} from "@/lib/scrapers/services/scraper-queries";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
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

    // Ownership check before aborting — the registry is keyed by job id alone.
    const job = await getScraperJobById(user.id, jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: { message: "Job not found." } },
        { status: 404 }
      );
    }

    const abortedLocally = stopScraperJob(jobId);

    await updateScraperJob(
      jobId,
      { status: "stopped", completedAt: new Date().toISOString() },
      true
    );

    return NextResponse.json({ success: true, abortedLocally });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    );
  }
}
