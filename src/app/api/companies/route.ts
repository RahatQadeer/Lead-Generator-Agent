import { NextResponse } from "next/server";
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
  const searchId = searchParams.get("searchId");
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 100));

  let query = supabase
    .from("companies")
    .select(
      "id, name, domain, industry, description, country, city, website_url, linkedin_url, provider, directory_profile, scraped_at, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (searchId) {
    query = query.eq("search_id", searchId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, companies: data ?? [] });
}
