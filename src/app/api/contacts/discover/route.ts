import { NextResponse } from "next/server";
import { getCompaniesBySearchId } from "@/lib/companies/queries";
import {
  detachContactsFromSearch,
  getKnownContactDedupKeys,
  upsertDiscoveredContacts,
} from "@/lib/contacts/queries";
import {
  discoverContacts,
  toContactDiscoveryErrorResponse,
} from "@/lib/contact-discovery/discover";
import { ContactDiscoveryError } from "@/lib/contact-discovery/errors";
import { mapSearchToContactDiscoveryParams } from "@/lib/contact-discovery/map-criteria";
import { toPersonPublicView } from "@/lib/pipeline/public-views";
import { createClient } from "@/lib/supabase/server";
import { getSearchById } from "@/lib/search/queries";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";

function isMissingSchemaError(message: string): boolean {
  return (
    /column .* does not exist/i.test(message) ||
    /could not find the/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function formatContactSaveError(errorMessage?: string): string {
  if (!errorMessage) {
    return "People were found but could not be saved. Run Find people again.";
  }

  if (isMissingSchemaError(errorMessage)) {
    return "People were found but the database is missing required migrations (025–027). Run them in Supabase, then try again.";
  }

  if (/foreign key/i.test(errorMessage)) {
    return "People were found but could not be linked to companies. Run Find companies again, then retry Find people.";
  }

  return `People were found but could not be saved: ${errorMessage}`;
}

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
    const companyIds = Array.isArray(body.companyIds)
      ? (body.companyIds as string[]).filter(Boolean)
      : undefined;
    const clearExisting = Boolean(body.clearExisting);

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

    let companies = await getCompaniesBySearchId(user.id, searchId);
    if (companyIds?.length) {
      const idSet = new Set(companyIds);
      companies = companies.filter((company) => idSet.has(company.id));
      if (companies.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "NO_COMPANIES",
              message: "No matching companies found for this search.",
              retryable: false,
            },
          },
          { status: 400 }
        );
      }
    }
    const companiesWithoutDomain = companies.filter((company) => !company.domain?.trim())
      .length;
    if (companies.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_COMPANIES",
            message:
              "No companies found for this search yet.",
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

    const isIncrementalSearch = Boolean(companyIds?.length);
    const shouldDetachExisting =
      result.contacts.length > 0 &&
      ((!isIncrementalSearch && page === 1) ||
        (isIncrementalSearch && clearExisting));

    if (shouldDetachExisting) {
      await detachContactsFromSearch(user.id, search.id);
    }

    const saveResult = await upsertDiscoveredContacts(
      user.id,
      search.id,
      result.provider,
      result.contacts
    );

    if (result.contacts.length > 0 && saveResult.savedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SAVE_FAILED",
            message: formatContactSaveError(saveResult.errorMessage),
            retryable: true,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      contacts: result.contacts.map(toPersonPublicView),
      pagination: result.pagination,
      meta: {
        companyCount: companies.length,
        jobTitles: search.jobTitles,
        scrapedCount: result.scrapedCount,
        parsedCount: result.parsedCount,
        filteredCount: result.filteredCount,
        rejectedCount: result.rejectedCount,
        duplicateCount: result.duplicateCount,
        batchDuplicateCount: result.batchDuplicateCount,
        knownDuplicateCount: result.knownDuplicateCount,
        savedCount: saveResult.savedCount,
        attempts: result.attempts,
        relaxedMatch: result.relaxedMatch,
        companiesWithoutDomain,
        companiesWithContacts: result.companiesWithContacts,
        searxngConfigured: Boolean(getSearxngBaseUrl()),
        searchId: search.id,
        searchName: search.name,
      },
    });
  } catch (error) {
    const response = toContactDiscoveryErrorResponse(error);
    const status =
      error instanceof ContactDiscoveryError ? error.statusCode : 500;
    console.error("Contact discovery failed:", error);
    return NextResponse.json(response, { status });
  }
}
