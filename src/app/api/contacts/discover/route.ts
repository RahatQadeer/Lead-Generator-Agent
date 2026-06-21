import { NextResponse } from "next/server";
import { getCompaniesBySearchId } from "@/lib/companies/queries";
import {
  getKnownContactDedupKeys,
  upsertDiscoveredContacts,
} from "@/lib/contacts/queries";
import {
  discoverContacts,
  toContactDiscoveryErrorResponse,
} from "@/lib/contact-discovery/discover";
import { ContactDiscoveryError } from "@/lib/contact-discovery/errors";
import { mapSearchToContactDiscoveryParams } from "@/lib/contact-discovery/map-criteria";
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

    const companies = await getCompaniesBySearchId(user.id, searchId);
    if (companies.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_COMPANIES",
            message:
              "No companies found for this search. Discover companies first.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const params = mapSearchToContactDiscoveryParams(
      search,
      companies,
      page,
      perPage
    );
    const knownDedupKeys = await getKnownContactDedupKeys(user.id);
    const result = await discoverContacts(params, { knownDedupKeys });

    await upsertDiscoveredContacts(
      user.id,
      search.id,
      result.provider,
      result.contacts
    );

    return NextResponse.json({
      success: true,
      provider: result.provider,
      contacts: result.contacts,
      pagination: result.pagination,
      meta: {
        companyCount: companies.length,
        jobTitles: search.jobTitles,
        filteredCount: result.filteredCount,
        duplicateCount: result.duplicateCount,
        batchDuplicateCount: result.batchDuplicateCount,
        knownDuplicateCount: result.knownDuplicateCount,
        attempts: result.attempts,
        searchId: search.id,
        searchName: search.name,
      },
    });
  } catch (error) {
    const response = toContactDiscoveryErrorResponse(error);
    const status =
      error instanceof ContactDiscoveryError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
