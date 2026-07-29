import { NextResponse } from "next/server";
import { getScraperHistory } from "@/lib/scrapers/services/scraper-service";
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
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));

  const jobs = await getScraperHistory(user.id, limit);
  return NextResponse.json({ success: true, jobs });
}
