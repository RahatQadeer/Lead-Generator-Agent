import {
  limitContactsPerCompany,
  MAX_CONTACTS_PER_COMPANY,
} from "@/lib/contact-discovery/apply-title-filter";
import { PeopleDataLabsContactDiscoveryProvider } from "@/lib/contact-discovery/pdl-provider";
import { ScrapingContactDiscoveryProvider } from "@/lib/contact-discovery/scraping-provider";
import type {
  ContactDiscoveryProvider,
  ProviderContactSearchResult,
} from "@/lib/contact-discovery/types";
import { createLogger } from "@/lib/logger";
import { rankContactsByRelevance } from "@/lib/scraping/relevance";
import type { ContactDiscoveryParams, DiscoveredContact } from "@/types/contact";

const log = createLogger("contact-discovery.hybrid");

/** PDL for structured data + website scraping for companies PDL misses. */
export class HybridContactDiscoveryProvider implements ContactDiscoveryProvider {
  readonly name = "pdl+scraping";

  private readonly pdl = new PeopleDataLabsContactDiscoveryProvider();
  private readonly scraping = new ScrapingContactDiscoveryProvider();

  async search(params: ContactDiscoveryParams): Promise<ProviderContactSearchResult> {
    const fetchParams: ContactDiscoveryParams = {
      ...params,
      page: 1,
      perPage: Math.max(params.perPage, MAX_CONTACTS_PER_COMPANY * 15),
    };

    const pdlResult = await this.pdl.search(fetchParams).catch((error) => {
      log.warn("PDL people search failed — using website scraping only", {
        error: String(error),
      });
      return emptyResult();
    });

    const coveredCompanyIds = new Set(
      pdlResult.contacts.map((contact) => contact.companyId)
    );
    const uncoveredCompanies = params.companies.filter(
      (company) => !coveredCompanyIds.has(company.id)
    );

    const scrapeResult =
      uncoveredCompanies.length > 0
        ? await this.scraping.search({
            ...fetchParams,
            companies: uncoveredCompanies,
          })
        : emptyResult();

    const mergedContacts = mergeDiscoveredContacts(
      pdlResult.contacts,
      scrapeResult.contacts,
      params.jobTitles
    );

    const relaxedMatch = pdlResult.relaxedMatch || scrapeResult.relaxedMatch || false;
    const totalEntries = mergedContacts.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / params.perPage));
    const start = (params.page - 1) * params.perPage;
    const pageItems = mergedContacts.slice(start, start + params.perPage);

    log.info("Hybrid people search completed", {
      pdl: pdlResult.contacts.length,
      scraping: scrapeResult.contacts.length,
      uncoveredCompanies: uncoveredCompanies.length,
      merged: mergedContacts.length,
      page: params.page,
    });

    return {
      contacts: pageItems,
      scrapedCount: mergedContacts.length,
      parsedCount: (pdlResult.parsedCount ?? 0) + (scrapeResult.parsedCount ?? 0),
      filteredCount: (pdlResult.filteredCount ?? 0) + (scrapeResult.filteredCount ?? 0),
      rejectedCount: (pdlResult.rejectedCount ?? 0) + (scrapeResult.rejectedCount ?? 0),
      relaxedMatch,
      companiesWithContacts: new Set(mergedContacts.map((contact) => contact.companyId)).size,
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

function mergeDiscoveredContacts(
  pdlContacts: DiscoveredContact[],
  scrapeContacts: DiscoveredContact[],
  jobTitles: string[]
): DiscoveredContact[] {
  const seen = new Set<string>();
  const merged: DiscoveredContact[] = [];

  for (const contact of [...pdlContacts, ...scrapeContacts]) {
    const key = `${contact.companyId}|${contact.fullName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(contact);
  }

  return limitContactsPerCompany(
    rankContactsByRelevance(merged, jobTitles),
    MAX_CONTACTS_PER_COMPANY
  );
}

function emptyResult(): ProviderContactSearchResult {
  return {
    contacts: [],
    scrapedCount: 0,
    parsedCount: 0,
    filteredCount: 0,
    rejectedCount: 0,
    relaxedMatch: false,
    companiesWithContacts: 0,
    pagination: {
      page: 1,
      perPage: 25,
      totalEntries: 0,
      totalPages: 1,
      hasMore: false,
    },
  };
}
