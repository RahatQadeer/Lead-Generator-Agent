import {
  applyTitleFilter,
  countLeadershipContacts,
  MAX_CONTACTS_PER_COMPANY,
} from "@/lib/contact-discovery/apply-title-filter";
import { foundersToContacts } from "@/lib/companies/persist-decision-makers";
import { createLogger } from "@/lib/logger";
import { extractYcFoundersFromHtml } from "@/lib/scrapers/utils/extract-yc-founders";
import type { DirectoryProfilePayload, ScraperFounder } from "@/lib/scrapers/types";
import { FAST_FETCH } from "@/lib/scraping/http-client";
import type { ContactDiscoveryTargetCompany, DiscoveredContact } from "@/types/contact";
import type { DiscoveredCompany } from "@/types/company";
import type { Json } from "@/types/database";

const log = createLogger("contact-discovery.yc-founders");
const YC_FETCH = { ...FAST_FETCH, timeoutMs: 10_000 };

export function parseDirectoryProfile(
  value: Json | null | undefined
): DirectoryProfilePayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const profile = value as Record<string, unknown>;
  if (typeof profile.source !== "string" || typeof profile.sourceUrl !== "string") {
    return null;
  }
  return value as unknown as DirectoryProfilePayload;
}

export function isYcCompany(company: ContactDiscoveryTargetCompany): boolean {
  if (company.directoryProfile?.source === "ycombinator") return true;
  if (company.providerCompanyId?.startsWith("ycombinator:")) return true;
  return false;
}

function contactDedupKey(contact: DiscoveredContact): string {
  return `${contact.fullName.toLowerCase()}|${contact.title.toLowerCase()}`;
}

function toDiscoveredCompany(
  company: ContactDiscoveryTargetCompany,
  founders: ScraperFounder[]
): DiscoveredCompany {
  return {
    id: company.providerCompanyId ?? company.id,
    name: company.name,
    domain: company.domain,
    industry: null,
    description: null,
    employeeCount: null,
    country: company.country ?? null,
    city: company.city ?? null,
    state: company.state ?? null,
    linkedinUrl: null,
    websiteUrl: null,
    technologies: null,
    confidenceScore: 60,
    founders,
    directoryProfile: company.directoryProfile ?? null,
  };
}

async function fetchYcFoundersFromProfile(sourceUrl: string): Promise<ScraperFounder[]> {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "LeadGeneratorAgent/1.0 (+https://righttail.com)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(YC_FETCH.timeoutMs),
    });
    if (!response.ok) {
      log.warn("YC profile fetch failed", { sourceUrl, status: response.status });
      return [];
    }
    const html = await response.text();
    const founders = extractYcFoundersFromHtml(html);
    log.info("Fetched YC founders from profile page", {
      sourceUrl,
      count: founders.length,
    });
    return founders;
  } catch (error) {
    log.warn("YC profile fetch error", { sourceUrl, error: String(error) });
    return [];
  }
}

export interface YcFounderDiscoveryResult {
  /** Title-filtered contacts ready to return or merge. */
  contacts: DiscoveredContact[];
  /** All YC founders before title filtering (for seeding fallback scraping). */
  founderPool: DiscoveredContact[];
  seenKeys: Set<string>;
  parsedCount: number;
  filteredCount: number;
  rejectedCount: number;
  relaxedMatch: boolean;
  /** When true, website / directory scraping can be skipped for this company. */
  skipOtherSources: boolean;
}

/**
 * Step 2 people discovery: pull founders from the Y Combinator listing first
 * (persisted directory profile from step 1, or live fetch from the YC profile URL).
 */
export async function discoverYcContactsForCompany(
  company: ContactDiscoveryTargetCompany,
  jobTitles: string[]
): Promise<YcFounderDiscoveryResult> {
  const empty: YcFounderDiscoveryResult = {
    contacts: [],
    founderPool: [],
    seenKeys: new Set(),
    parsedCount: 0,
    filteredCount: 0,
    rejectedCount: 0,
    relaxedMatch: false,
    skipOtherSources: false,
  };

  if (!isYcCompany(company)) return empty;

  let founders = company.directoryProfile?.founders ?? [];
  const sourceUrl = company.directoryProfile?.sourceUrl;

  if (founders.length === 0 && sourceUrl?.includes("ycombinator.com/companies/")) {
    founders = await fetchYcFoundersFromProfile(sourceUrl);
  }

  if (founders.length === 0) return empty;

  const founderPool = foundersToContacts(
    toDiscoveredCompany(company, founders),
    company.id
  );
  const seenKeys = new Set(founderPool.map(contactDedupKey));
  const titleFilter = applyTitleFilter(founderPool, jobTitles);
  const matched = titleFilter.contacts;

  const skipOtherSources =
    matched.length > 0 ||
    countLeadershipContacts(founderPool, jobTitles) >= MAX_CONTACTS_PER_COMPANY;

  log.info("YC founders discovered for company", {
    company: company.name,
    founders: founderPool.length,
    matched: matched.length,
    skipOtherSources,
  });

  return {
    contacts: matched,
    founderPool,
    seenKeys,
    parsedCount: founderPool.length,
    filteredCount: titleFilter.filteredCount,
    rejectedCount: 0,
    relaxedMatch: titleFilter.relaxedMatch,
    skipOtherSources,
  };
}
