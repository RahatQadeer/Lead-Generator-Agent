import { NextResponse } from "next/server";
import {
  csvRowsToDiscoveredData,
  parseCsvLeads,
} from "@/lib/import/parse-csv";
import {
  getKnownCompanyDedupKeys,
  upsertDiscoveredCompanies,
} from "@/lib/companies/queries";
import {
  getKnownContactDedupKeys,
  upsertDiscoveredContacts,
} from "@/lib/contacts/queries";
import { applyDedup as applyCompanyDedup } from "@/lib/company-discovery/apply-dedup";
import { applyDedup as applyContactDedup } from "@/lib/contact-discovery/apply-dedup";
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

    const formData = await request.formData();
    const searchId = formData.get("searchId");
    const file = formData.get("file");

    if (typeof searchId !== "string" || !searchId) {
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

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "CSV file is required.",
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

    const csvText = await file.text();
    const { rows, errors: parseErrors } = parseCsvLeads(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseErrors[0] ?? "No valid rows found in CSV.",
            retryable: false,
          },
          meta: { parseErrors },
        },
        { status: 400 }
      );
    }

    const { companies: rawCompanies, contacts: rawContacts } =
      csvRowsToDiscoveredData(rows);

    const [knownCompanyKeys, knownContactKeys] = await Promise.all([
      getKnownCompanyDedupKeys(user.id),
      getKnownContactDedupKeys(user.id),
    ]);

    const {
      companies,
      duplicateCount: companyDuplicateCount,
      knownDuplicateCount: companyKnownDuplicateCount,
    } = applyCompanyDedup(rawCompanies, knownCompanyKeys);

    const {
      contacts,
      duplicateCount: contactDuplicateCount,
      knownDuplicateCount: contactKnownDuplicateCount,
    } = applyContactDedup(rawContacts, knownContactKeys);

    await upsertDiscoveredCompanies(user.id, search.id, "csv", companies);
    await upsertDiscoveredContacts(user.id, search.id, "csv", contacts);

    return NextResponse.json({
      success: true,
      provider: "csv",
      meta: {
        searchId: search.id,
        importedRows: rows.length,
        companiesImported: companies.length,
        contactsImported: contacts.length,
        companyDuplicatesSkipped: companyDuplicateCount,
        contactDuplicatesSkipped: contactDuplicateCount,
        parseWarnings: parseErrors,
      },
    });
  } catch (error) {
    console.error("CSV import failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "IMPORT_FAILED",
          message: "Failed to import CSV leads.",
          retryable: false,
        },
      },
      { status: 500 }
    );
  }
}
