import { NextResponse } from "next/server";
import { getCompanyDiscoveryJob } from "@/lib/queue/company-discovery-queue";
import { isQueueEnabled } from "@/lib/queue/connection";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isQueueEnabled()) {
    return NextResponse.json(
      { success: false, error: "Queue is not enabled. Set REDIS_URL." },
      { status: 503 }
    );
  }

  const job = await getCompanyDiscoveryJob(id);
  if (!job) {
    return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
  }

  if (job.data.userId !== user.id) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const state = await job.getState();
  const result = job.returnvalue ?? null;
  const failedReason = job.failedReason ?? null;

  return NextResponse.json({
    success: true,
    job: {
      id: job.id,
      state,
      failedReason,
      result,
    },
  });
}
