import { NextResponse } from "next/server";
import {
  detachCompaniesFromSearch,
  getKnownCompanyDedupKeys,
  upsertDiscoveredCompanies,
} from "@/lib/companies/queries";
import {
  discoverCompanies,
  toDiscoveryErrorResponse,
} from "@/lib/company-discovery/discover";
import { CompanyDiscoveryError } from "@/lib/company-discovery/errors";
import { mapSearchToDiscoveryParams } from "@/lib/company-discovery/map-criteria";
import { toCompanyPublicView } from "@/lib/pipeline/public-views";
import { enqueueCompanyDiscovery } from "@/lib/queue/company-discovery-queue";
import { isQueueEnabled } from "@/lib/queue/connection";
import { createClient } from "@/lib/supabase/server";
import { getSearchById } from "@/lib/search/queries";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AUTH_ERROR",
            message: "Authentication required.",
            retryable: false,
          },
        },
        { status: 401 }
      );
    }
    const body = await request.json();

    const searchId = body.searchId as string | undefined;
    const page = Math.max(1, Number(body.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(body.perPage) || 25));
    const asyncMode = Boolean(body.async) && isQueueEnabled();

    if (!searchId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "searchId is required.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const search = await getSearchById(user.id, searchId);
    if (!search) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SEARCH_NOT_FOUND",
            message: "Search not found.",
            retryable: false,
          },
        },
        { status: 404 }
      );
    }

    const params = mapSearchToDiscoveryParams(search, page, perPage);
    const knownDedupKeys = await getKnownCompanyDedupKeys(user.id);

    if (asyncMode) {
      const jobId = await enqueueCompanyDiscovery({
        userId: user.id,
        searchId: search.id,
        params,
        knownDedupKeys: Array.from(knownDedupKeys),
      });

      if (!jobId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "QUEUE_ERROR",
              message: "Failed to enqueue discovery job.",
              retryable: true,
            },
          },
          { status: 503 }
        );
      }

      return NextResponse.json({
        success: true,
        async: true,
        jobId,
        meta: { searchId: search.id, searchName: search.name },
      });
    }

    const result = await discoverCompanies(params, { knownDedupKeys });

    if (page === 1 && result.companies.length > 0) {
      await detachCompaniesFromSearch(user.id, search.id);
    }

    await upsertDiscoveredCompanies(
      user.id,
      search.id,
      result.provider,
      result.companies
    );

    const criteriaFilters = {
      industry: params.industry,
      country: params.country,
      companySizeMin: params.companySizeMin,
      companySizeMax: params.companySizeMax,
      technologies: params.technologies,
      keywords: params.keywords,
    };

    return NextResponse.json({
      success: true,
      provider: result.provider,
      companies: result.companies.map((company) =>
        toCompanyPublicView(company, criteriaFilters)
      ),
      rejected: result.rejected ?? [],
      pagination: result.pagination,
      meta: {
        filteredCount: result.filteredCount,
        excludedCount: result.excludedCount,
        duplicateCount: result.duplicateCount,
        batchDuplicateCount: result.batchDuplicateCount,
        knownDuplicateCount: result.knownDuplicateCount,
        seedCount: result.seedCount,
        enrichedCount: result.enrichedCount,
        relaxedMatch: result.relaxedMatch,
        rejectedCount: result.rejected?.length ?? 0,
        rejected: result.rejected ?? [],
        attempts: result.attempts,
        searchId: search.id,
        searchName: search.name,
      },
    });
  } catch (error) {
    const response = toDiscoveryErrorResponse(error);
    const status = error instanceof CompanyDiscoveryError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
