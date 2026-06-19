import {
  applyTitleFilter,
  limitContactsPerCompany,
  matchesJobTitle,
  MAX_CONTACTS_PER_COMPANY,
} from "@/lib/contact-discovery/apply-title-filter";
import { ContactDiscoveryError } from "@/lib/contact-discovery/errors";
import type {
  ContactDiscoveryProvider,
  ProviderContactSearchResult,
} from "@/lib/contact-discovery/types";
import { createLogger } from "@/lib/logger";
import {
  searchPeopleDataLabsPeople,
  type PdlPersonRecord,
} from "@/lib/people-data-labs/client";
import { isPeopleDataLabsConfigured } from "@/lib/people-data-labs/config";
import { mapPool } from "@/lib/scraping/parallel-pool";
import { sanitizePersonLinkedInUrl } from "@/lib/scraping/data-quality";
import { inferDepartment, rankContactsByRelevance } from "@/lib/scraping/relevance";
import type {
  ContactDiscoveryParams,
  ContactDiscoveryTargetCompany,
  DiscoveredContact,
} from "@/types/contact";

const log = createLogger("contact-discovery.pdl");
const MAX_COMPANIES_PER_RUN = 15;
const PDL_SEARCH_CONCURRENCY = 3;
const PDL_RESULTS_PER_COMPANY = 12;

function titleCaseName(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function mapPdlPerson(
  person: PdlPersonRecord,
  company: ContactDiscoveryTargetCompany,
  index: number
): DiscoveredContact | null {
  const rawName =
    person.full_name?.trim() ||
    [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  if (!rawName) return null;

  const nameParts = rawName.split(/\s+/).filter(Boolean);
  const firstName = person.first_name?.trim() || nameParts[0] || "Unknown";
  const lastName =
    person.last_name?.trim() ||
    (nameParts.length > 1 ? nameParts.slice(1).join(" ") : null);
  const fullName = titleCaseName(rawName);
  const title = person.job_title?.trim() || "Unknown";
  const linkedinUrl = sanitizePersonLinkedInUrl(
    person.linkedin_url?.startsWith("http")
      ? person.linkedin_url
      : person.linkedin_url
        ? `https://${person.linkedin_url.replace(/^\/+/, "")}`
        : null
  );
  const email =
    typeof person.work_email === "string" && person.work_email.includes("@")
      ? person.work_email.trim()
      : null;

  return {
    id: person.id ?? `pdl-${company.id}-${index}`,
    companyId: company.id,
    companyName: company.name,
    companyDomain: company.domain,
    firstName: titleCaseName(firstName),
    lastName: lastName ? titleCaseName(lastName) : null,
    fullName,
    title,
    department: inferDepartment(title),
    email,
    emailIsGuessed: false,
    linkedinUrl,
    confidenceScore: 85,
    sourceUrl: person.job_company_website
      ? `https://${person.job_company_website.replace(/^www\./, "")}`
      : null,
    discoverySource: "directory_listing",
  };
}

function markPdlTitleMatch(
  contacts: DiscoveredContact[],
  jobTitles: string[],
  relaxedMatch: boolean
): DiscoveredContact[] {
  if (!relaxedMatch) {
    return contacts.map((contact) => ({ ...contact, titleMatched: true }));
  }
  return contacts.map((contact) => ({
    ...contact,
    titleMatched: matchesJobTitle(contact.title, jobTitles),
  }));
}

async function searchCompanyPeople(
  company: ContactDiscoveryTargetCompany,
  jobTitles: string[]
): Promise<{ contacts: DiscoveredContact[]; parsedCount: number; relaxedMatch: boolean }> {
  const domain = company.domain?.replace(/^www\./, "").toLowerCase();
  if (!domain) {
    return { contacts: [], parsedCount: 0, relaxedMatch: false };
  }

  let records = await searchPeopleDataLabsPeople({
    domain,
    companyName: company.name,
    jobTitles,
    size: PDL_RESULTS_PER_COMPANY,
  });

  const executiveRecords = await searchPeopleDataLabsPeople({
    domain,
    companyName: company.name,
    jobTitles,
    size: PDL_RESULTS_PER_COMPANY,
    executiveFallback: true,
  });

  const seenIds = new Set<string>();
  records = [...records, ...executiveRecords].filter((person) => {
    const key = person.id ?? person.full_name ?? "";
    if (!key || seenIds.has(key)) return false;
    seenIds.add(key);
    return true;
  });

  const mapped = records
    .map((person, index) => mapPdlPerson(person, company, index))
    .filter((contact): contact is DiscoveredContact => contact !== null);

  const titleFilter = applyTitleFilter(mapped, jobTitles);
  const marked = markPdlTitleMatch(titleFilter.contacts, jobTitles, titleFilter.relaxedMatch);

  return {
    contacts: marked,
    parsedCount: mapped.length,
    relaxedMatch: titleFilter.relaxedMatch,
  };
}

export class PeopleDataLabsContactDiscoveryProvider implements ContactDiscoveryProvider {
  readonly name = "pdl";

  async search(params: ContactDiscoveryParams): Promise<ProviderContactSearchResult> {
    if (!isPeopleDataLabsConfigured()) {
      throw new ContactDiscoveryError(
        "PROVIDER_NOT_CONFIGURED",
        "People Data Labs API key is not configured. Set PEOPLE_DATA_LABS_API_KEY in your environment.",
        { statusCode: 500, retryable: false }
      );
    }

    const companies = params.companies
      .filter((company) => company.domain)
      .slice(0, MAX_COMPANIES_PER_RUN);

    if (companies.length === 0) {
      return {
        contacts: [],
        scrapedCount: 0,
        parsedCount: 0,
        filteredCount: 0,
        rejectedCount: 0,
        relaxedMatch: false,
        companiesWithContacts: 0,
        pagination: {
          page: params.page,
          perPage: params.perPage,
          totalEntries: 0,
          totalPages: 1,
          hasMore: false,
        },
      };
    }

    log.info("PDL people search started", {
      companies: companies.length,
      jobTitles: params.jobTitles,
    });

    const batches = await mapPool(companies, PDL_SEARCH_CONCURRENCY, (company) =>
      searchCompanyPeople(company, params.jobTitles)
    );

    const allContacts: DiscoveredContact[] = [];
    let parsedCount = 0;
    let filteredCount = 0;
    let relaxedMatch = false;

    for (const batch of batches) {
      allContacts.push(...batch.contacts);
      parsedCount += batch.parsedCount;
      filteredCount += Math.max(0, batch.parsedCount - batch.contacts.length);
      if (batch.relaxedMatch) {
        relaxedMatch = true;
      }
    }

    const ranked = limitContactsPerCompany(
      rankContactsByRelevance(allContacts, params.jobTitles),
      MAX_CONTACTS_PER_COMPANY
    );

    const companiesWithContacts = new Set(ranked.map((contact) => contact.companyId)).size;
    const totalEntries = ranked.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / params.perPage));
    const start = (params.page - 1) * params.perPage;
    const pageItems = ranked.slice(start, start + params.perPage);

    log.info("PDL people search completed", {
      companies: companies.length,
      companiesWithContacts,
      parsed: parsedCount,
      matched: ranked.length,
    });

    return {
      contacts: pageItems.map((contact) => ({
        ...contact,
        email: null,
        emailIsGuessed: false,
        linkedinUrl: null,
      })),
      scrapedCount: ranked.length,
      parsedCount,
      filteredCount,
      rejectedCount: 0,
      relaxedMatch,
      companiesWithContacts,
      pagination: {
        page: params.page,
        perPage: params.perPage,
        totalEntries,
        totalPages,
        hasMore: params.page < totalPages,
      },
    };
  }
}
