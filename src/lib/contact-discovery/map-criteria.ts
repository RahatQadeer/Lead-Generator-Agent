import type { ContactDiscoveryParams, ContactDiscoveryTargetCompany } from "@/types/contact";
import type { SearchRecord } from "@/types/search";
import type { Database } from "@/types/database";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

export function toContactDiscoveryTargetCompany(
  row: CompanyRow
): ContactDiscoveryTargetCompany {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    providerCompanyId: row.provider_company_id,
    city: row.city,
    state: row.state,
    country: row.country,
  };
}

export function mapSearchToContactDiscoveryParams(
  search: SearchRecord,
  companies: ContactDiscoveryTargetCompany[],
  page = 1,
  perPage = 25
): ContactDiscoveryParams {
  return {
    jobTitles: search.jobTitles,
    companies,
    page,
    perPage,
  };
}
