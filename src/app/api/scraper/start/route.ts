import { NextResponse } from "next/server";
import { startScraperRun } from "@/lib/scrapers/services/scraper-service";
import { ScraperFactory } from "@/lib/scrapers/scraper-factory";
import { parseScraperFilters } from "@/lib/scrapers/parse-filters";
import { createClient } from "@/lib/supabase/server";
import { getSearchById } from "@/lib/search/queries";
import { isQueueEnabled } from "@/lib/queue/connection";

export async function POST(request: Request) {
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

    const body = await request.json();
    const searchId = (body.searchId as string | undefined) ?? null;
    const sources = Array.isArray(body.sources) ? (body.sources as string[]) : [];
    const asyncMode = Boolean(body.async) && isQueueEnabled();

    if (sources.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "sources is required.",
            availableSources: ScraperFactory.listSources(),
          },
        },
        { status: 400 }
      );
    }

    if (searchId) {
      const search = await getSearchById(user.id, searchId);
      if (!search) {
        return NextResponse.json(
          { success: false, error: { message: "Search not found." } },
          { status: 404 }
        );
      }
    }

    const result = await startScraperRun({
      userId: user.id,
      searchId,
      sources,
      options: {
        maxCompanies: Number(body.maxCompanies) || 100,
        maxPages: Number(body.maxPages) || 10,
        enrichFromWebsite: body.enrichFromWebsite !== false,
        concurrency: Number(body.concurrency) || 3,
        respectRobots: body.respectRobots !== false,
        minIntervalMs: Number(body.minIntervalMs) || 1_200,
      },
      filters: parseScraperFilters(body.filters),
      async: asyncMode,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    );
  }
}
