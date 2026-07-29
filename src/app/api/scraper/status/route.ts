import { NextResponse } from "next/server";
import { getScraperStatus } from "@/lib/scrapers/services/scraper-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: "jobId query parameter is required." },
      { status: 400 }
    );
  }

  const job = await getScraperStatus(user.id, jobId);
  if (!job) {
    return NextResponse.json({ success: false, error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, job });
}
