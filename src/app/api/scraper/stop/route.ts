import { NextResponse } from "next/server";
import { stopScraperRun } from "@/lib/scrapers/services/scraper-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const jobId = body.jobId as string | undefined;

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: "jobId is required." },
      { status: 400 }
    );
  }

  try {
    const result = await stopScraperRun(user.id, jobId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 404 });
  }
}
