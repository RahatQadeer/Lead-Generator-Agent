import { NextResponse } from "next/server";
import {
  getKnownCompanyDedupKeys,
  upsertDiscoveredCompanies,
} from "@/lib/companies/queries";
import {
  discoverCompanies,
  toDiscoveryErrorResponse,
} from "@/lib/company-discovery/discover";
import { CompanyDiscoveryError } from "@/lib/company-discovery/errors";
import { mapSearchToDiscoveryParams } from "@/lib/company-discovery/map-criteria";
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
    const result = await discoverCompanies(params, { knownDedupKeys });

    await upsertDiscoveredCompanies(
      user.id,
      search.id,
      result.provider,
      result.companies
    );

    return NextResponse.json({
      success: true,
      provider: result.provider,
      companies: result.companies,
      pagination: result.pagination,
      meta: {
        filteredCount: result.filteredCount,
        excludedCount: result.excludedCount,
        duplicateCount: result.duplicateCount,
        batchDuplicateCount: result.batchDuplicateCount,
        knownDuplicateCount: result.knownDuplicateCount,
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
