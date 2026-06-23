import {
  applyTitleFilter,
  countLeadershipContacts,
  limitContactsPerCompany,
  matchesJobTitle,
  MAX_CONTACTS_PER_COMPANY,
} from "@/lib/contact-discovery/apply-title-filter";
import { inferExecutiveTitleFromText } from "@/lib/contact-discovery/resolve-contact-title";
import type {
  ContactDiscoveryProvider,
  ProviderContactSearchResult,
} from "@/lib/contact-discovery/types";
import { createLogger } from "@/lib/logger";
import { isApifyEnabled } from "@/lib/apify/config";
import type { AffiliationSource } from "@/lib/scraping/company-affiliation";
import { verifyPersonCompanyAffiliation } from "@/lib/scraping/company-affiliation";
import { normalizeCompanyNameForSearch } from "@/lib/search/search-name-utils";
import {
  isPlausiblePersonName,
  pickContactEmail,
  sanitizePersonLinkedInForContact,
  sanitizePersonLinkedInUrl,
} from "@/lib/scraping/data-quality";
import { discoverDirectoryPaths } from "@/lib/scraping/directory-paths";
import { FAST_FETCH } from "@/lib/scraping/http-client";
import { normalizeWebsiteUrl } from "@/lib/scraping/extract-domain";
import { mapPool } from "@/lib/scraping/parallel-pool";
import { isLeadershipDirectoryUrl } from "@/lib/scraping/parse-html";
import {
  computeContactConfidence,
  inferDepartment,
  rankContactsByRelevance,
} from "@/lib/scraping/relevance";
import {
  contactsCacheKey,
  getScrapeCache,
  setScrapeCache,
} from "@/lib/scraping/scrape-cache";
import { scrapeContactsFromUrl } from "@/lib/scraping/scrape-page";
import type { ParsedContact } from "@/lib/scraping/parse-html";
import { discoverPeopleFromPublicDirectories } from "@/lib/scraping/directory-people-search";
import { fetchLeadershipFromWikidata } from "@/lib/scraping/wikidata-people";
import {
  discoverLeadershipOnCompanyDomain,
  discoverLeadershipViaSearch,
} from "@/lib/scraping/leadership-search";
import { discoverLeadershipFromPressPages } from "@/lib/scraping/press-release-leaders";
import { finalizePeopleStepContacts } from "@/lib/contact-discovery/resolve-linkedin-profiles";
import { isScrapingToolAvailable } from "@/lib/scraping/tool-health";
import type { ContactDiscoveryParams, DiscoveredContact } from "@/types/contact";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";

const log = createLogger("contact-discovery.scraping");
const MAX_COMPANIES_PER_RUN = 15;
const MAX_PATHS_PER_COMPANY = 16;
const PATH_SCRAPE_CONCURRENCY = 3;
const COMPANY_SCRAPE_CONCURRENCY = 3;
/** Keep scraping until this many leaders are found, or paths are exhausted. */
const TARGET_DECISION_MAKERS_PER_COMPANY = MAX_CONTACTS_PER_COMPANY;
const MAX_RAW_CONTACTS_PER_COMPANY = 40;
/** Stop early only after finding at least this many decision-makers per company. */
const MIN_LEADERS_BEFORE_EARLY_STOP = 3;
const LEADERSHIP_PATH_BUDGET = 10;
const ABOUT_PATH_BUDGET = 8;
const OTHER_PATH_BUDGET = 6;

function isPeopleDiscoveryAiEnabled(): boolean {
  const flag = process.env.SCRAPING_AI_EXTRACTION_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

/** Faster HTTP profile for people discovery — many URLs per company. */
const PEOPLE_DISCOVERY_FETCH: typeof FAST_FETCH = {
  timeoutMs: 8_000,
  minIntervalMs: 150,
  respectRobots: true,
};

/** Applied after job-title filter — parsed rows may use placeholder titles during extraction. */
const MIN_PERSON_CONFIDENCE = 35;

interface CachedContactRow {
  fullName: string;
  firstName: string;
  lastName: string | null;
  title: string;
  titleContext: string | null;
  department: string | null;
  email: string | null;
  emailIsGuessed: boolean;
  linkedinUrl: string | null;
  confidenceScore: number;
  sourceUrl: string | null;
  discoverySource: DiscoveredContact["discoverySource"];
}

function resolveParsedPersonTitle(person: ParsedContact): string {
  const direct = person.title?.trim() || "Team Member";
  if (!/^(team member|staff member|employee|member|unknown|n\/a)$/i.test(direct)) {
    return direct;
  }

  const inferred = inferExecutiveTitleFromText(
    [person.title, person.affiliationText, person.fullName].filter(Boolean).join(" ")
  );
  return inferred ?? direct;
}

function toDiscoveredContact(
  person: ParsedContact,
  company: ContactDiscoveryParams["companies"][number],
  domain: string,
  index: number,
  jobTitles: string[]
): DiscoveredContact | null {
  if (!isPlausiblePersonName(person.fullName)) return null;

  const linkedinUrl = sanitizePersonLinkedInForContact(
    person.linkedinUrl,
    person.fullName,
    company.name
  );
  const { email, emailIsGuessed } = pickContactEmail(
    person.email,
    person.source,
    person.fullName
  );
  const title = resolveParsedPersonTitle(person);
  const department = inferDepartment(title);

  const contact: DiscoveredContact = {
    id: `scraping-${domain}-${index}`,
    companyId: company.id,
    companyName: company.name,
    companyDomain: company.domain,
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: person.fullName,
    title,
    department,
    email,
    emailIsGuessed,
    linkedinUrl,
    confidenceScore: 0,
    sourceUrl: person.sourceUrl ?? null,
    discoverySource: person.extractionSource ?? "website_team",
    titleContext: person.affiliationText ?? null,
  };

  contact.confidenceScore = computeContactConfidence({
    title: contact.title,
    email: contact.email,
    emailIsGuessed: contact.emailIsGuessed,
    linkedinUrl: contact.linkedinUrl,
    jobTitles,
  });

  return contact;
}

function fromCachedRow(
  row: CachedContactRow,
  company: ContactDiscoveryParams["companies"][number],
  domain: string,
  index: number
): DiscoveredContact {
  return {
    id: `scraping-${domain}-${index}`,
    companyId: company.id,
    companyName: company.name,
    companyDomain: company.domain,
    firstName: row.firstName || "Unknown",
    lastName: row.lastName,
    fullName: row.fullName || `${row.firstName} ${row.lastName ?? ""}`.trim(),
    title: row.title?.trim() || "Team Member",
    department: row.department,
    email: row.email,
    emailIsGuessed: row.emailIsGuessed,
    linkedinUrl: row.linkedinUrl,
    confidenceScore: row.confidenceScore,
    sourceUrl: row.sourceUrl,
    discoverySource: row.discoverySource,
    titleContext: row.titleContext ?? null,
  };
}

function toCachedRow(contact: DiscoveredContact): CachedContactRow {
  return {
    fullName: contact.fullName,
    firstName: contact.firstName,
    lastName: contact.lastName,
    title: contact.title,
    titleContext: contact.titleContext ?? null,
    department: contact.department,
    email: contact.email,
    emailIsGuessed: contact.emailIsGuessed,
    linkedinUrl: contact.linkedinUrl,
    confidenceScore: contact.confidenceScore,
    sourceUrl: contact.sourceUrl ?? null,
    discoverySource: contact.discoverySource ?? null,
  };
}

function resolveAffiliationSource(
  extractionSource: ParsedContact["extractionSource"]
): AffiliationSource {
  if (
    extractionSource === "domain_search" ||
    extractionSource === "website_team" ||
    !extractionSource
  ) {
    return "website_team";
  }
  return extractionSource;
}

function isOnCompanyWebsite(extractionSource: ParsedContact["extractionSource"]): boolean {
  return extractionSource === "website_team" || extractionSource === "domain_search";
}

function mergeParsedContacts(
  parsed: ParsedContact[],
  contacts: DiscoveredContact[],
  seen: Set<string>,
  company: ContactDiscoveryParams["companies"][number],
  domain: string,
  jobTitles: string[],
  options?: { sourceUrl?: string | null }
): number {
  let rejected = 0;
  const leadershipPage = options?.sourceUrl
    ? isLeadershipDirectoryUrl(options.sourceUrl)
    : false;

  for (const person of parsed) {
    const extractionSource = person.extractionSource ?? "website_team";
    const affiliation = verifyPersonCompanyAffiliation(
      {
        title: person.title,
        bioText: person.affiliationText,
        source: resolveAffiliationSource(extractionSource),
        onCompanyWebsite: isOnCompanyWebsite(extractionSource),
        leadershipPage,
      },
      { name: company.name, domain: company.domain }
    );

    if (!affiliation.matches) {
      rejected += 1;
      log.info("Rejected person — company affiliation mismatch", {
        domain,
        company: company.name,
        name: person.fullName,
        title: person.title,
        source: person.extractionSource ?? "website_team",
        reason: affiliation.reason,
      });
      continue;
    }

    const key = `${person.fullName.toLowerCase()}|${person.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const contact = toDiscoveredContact(
      person,
      company,
      domain,
      contacts.length,
      jobTitles
    );
    if (!contact) {
      rejected += 1;
      continue;
    }

    contacts.push(contact);
  }

  return rejected;
}

interface CompanyScrapeResult {
  contacts: DiscoveredContact[];
  parsedCount: number;
  filteredCount: number;
  rejectedCount: number;
  relaxedMatch: boolean;
}

function refreshContactConfidence(
  contact: DiscoveredContact,
  jobTitles: string[]
): DiscoveredContact {
  return {
    ...contact,
    confidenceScore: computeContactConfidence({
      title: contact.title,
      email: contact.email,
      emailIsGuessed: contact.emailIsGuessed,
      linkedinUrl: contact.linkedinUrl,
      jobTitles,
    }),
  };
}

function applyTitleFilterWithConfidence(
  contacts: DiscoveredContact[],
  jobTitles: string[]
) {
  const filtered = applyTitleFilter(contacts, jobTitles);
  return {
    ...filtered,
    contacts: filtered.contacts.map((contact) =>
      refreshContactConfidence(contact, jobTitles)
    ),
  };
}

function markTitleMatch(
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
function applyPostTitleQualityGate(
  contacts: DiscoveredContact[],
  options?: { relaxedMatch?: boolean }
): {
  contacts: DiscoveredContact[];
  rejectedCount: number;
} {
  const minConfidence = options?.relaxedMatch ? 25 : MIN_PERSON_CONFIDENCE;
  const kept: DiscoveredContact[] = [];
  let rejectedCount = 0;

  for (const contact of contacts) {
    if (contact.confidenceScore < minConfidence) {
      rejectedCount += 1;
      continue;
    }
    kept.push(contact);
  }

  return { contacts: kept, rejectedCount };
}

function hasEnoughLeadership(
  contacts: DiscoveredContact[],
  jobTitles: string[]
): boolean {
  return countLeadershipContacts(contacts, jobTitles) >= MIN_LEADERS_BEFORE_EARLY_STOP;
}

function hasFullLeadershipCoverage(
  contacts: DiscoveredContact[],
  jobTitles: string[]
): boolean {
  return (
    applyTitleFilter(contacts, jobTitles).contacts.length >= TARGET_DECISION_MAKERS_PER_COMPANY
  );
}

function shouldEnableAiForPath(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path === "/" || /\/contact/i.test(path)) return false;
    return isLeadershipDirectoryUrl(url);
  } catch {
    return false;
  }
}

type PeoplePathPhase = "leadership" | "about" | "other";

function classifyPeoplePathPhase(url: string): PeoplePathPhase {
  try {
    const path = new URL(url).pathname.toLowerCase().replace(/\/$/, "") || "/";
    if (path === "/") return "other";
    if (
      /\/(team|people|leadership|management|board|directors|executive|staff|our-team|our-people|executive-team|senior-leadership|key-management|governance)(\/|$)/i.test(
        path
      )
    ) {
      return "leadership";
    }
    if (
      path === "/about" ||
      path === "/about-us" ||
      path === "/who-we-are" ||
      /\/about/i.test(path) ||
      /\/who-we-are/i.test(path) ||
      /\/(awards|press|news|speakers|events|blog|announcements)/i.test(path)
    ) {
      return "about";
    }
    return "other";
  } catch {
    return "other";
  }
}

function buildPhasedPeoplePaths(paths: string[], domain: string): string[] {
  const prioritized = prioritizePeopleDiscoveryPaths(paths, domain);
  const leadership: string[] = [];
  const about: string[] = [];
  const other: string[] = [];
  const seen = new Set<string>();

  for (const url of prioritized) {
    const key = url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const phase = classifyPeoplePathPhase(url);
    if (phase === "leadership") leadership.push(url);
    else if (phase === "about") about.push(url);
    else other.push(url);
  }

  return [
    ...leadership.slice(0, LEADERSHIP_PATH_BUDGET),
    ...about.slice(0, ABOUT_PATH_BUDGET),
    ...other.slice(0, OTHER_PATH_BUDGET),
  ].slice(0, MAX_PATHS_PER_COMPANY);
}

function prioritizePeopleDiscoveryPaths(paths: string[], domain?: string): string[] {
  const origin = domain ? normalizeWebsiteUrl(domain.replace(/^www\./, "")) : null;
  const seeded = origin
    ? [
        ...paths.filter(
          (url) =>
            url.replace(/\/$/, "").toLowerCase() !== origin.replace(/\/$/, "").toLowerCase()
        ),
        origin,
      ]
    : paths;

  const score = (url: string): number => {
    try {
      const path = new URL(url).pathname.toLowerCase().replace(/\/$/, "") || "/";
      if (/\/about-us\/leadership|\/leadership|\/executive-team|\/senior-leadership/i.test(path)) {
        return 100;
      }
      if (/\/about-us\/team|\/our-team|\/team\b|\/people\b|\/management\b/i.test(path)) {
        return 98;
      }
      if (path === "/about-us" || path === "/about" || path === "/who-we-are") return 94;
      if (/\/awards\//i.test(path) || /\/speakers/i.test(path) || /\/press/i.test(path)) {
        return 90;
      }
      if (isLeadershipDirectoryUrl(url)) return 88;
      if (/\/about-us\//i.test(path) || /\/about\//i.test(path)) return 86;
      if (path === "/") return 70;
      if (/\/contact/i.test(path)) return 10;
      return 55;
    } catch {
      return 0;
    }
  };

  const seen = new Set<string>();
  return [...seeded]
    .sort((left, right) => score(right) - score(left))
    .filter((url) => {
      const key = url.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function deepLeadershipScrape(
  company: ContactDiscoveryParams["companies"][number],
  domain: string,
  jobTitles: string[],
  contacts: DiscoveredContact[],
  seen: Set<string>,
  paths: string[]
): Promise<number> {
  let rejected = 0;
  const leadershipPaths = buildPhasedPeoplePaths(paths, domain);

  for (const path of leadershipPaths) {
    if (hasFullLeadershipCoverage(contacts, jobTitles)) break;

    const { contacts: parsed, source } = await scrapeContactsFromUrl(
      path,
      domain,
      PEOPLE_DISCOVERY_FETCH,
      {
        companyName: companySearchName(company),
        skipAi: !shouldEnableAiForPath(path),
        useApify: isApifyEnabled(),
      }
    );

    if (parsed.length > 0) {
      log.info("Deep leadership scrape found contacts", {
        company: company.name,
        domain,
        path,
        source,
        count: parsed.length,
      });
    }

    rejected += mergeParsedContacts(parsed, contacts, seen, company, domain, jobTitles, {
      sourceUrl: path,
    });
  }

  return rejected;
}

async function supplementCompanyLeadership(
  company: ContactDiscoveryParams["companies"][number],
  jobTitles: string[]
): Promise<CompanyScrapeResult> {
  if (!company.domain) {
    return scrapeCompanyContactsWithoutDomain(company, jobTitles);
  }

  const domain = company.domain.replace(/^www\./, "");
  const paths = buildPhasedPeoplePaths(
    await discoverDirectoryPaths(domain),
    domain
  );
  const contacts: DiscoveredContact[] = [];
  const seen = new Set<string>();
  let rejected = 0;

  rejected += await runFallbackDiscovery(company, domain, jobTitles, contacts, seen, {
    broadDecisionMakerSearch: true,
  });

  rejected += await deepLeadershipScrape(company, domain, jobTitles, contacts, seen, paths);

  if (!hasEnoughLeadership(contacts, jobTitles)) {
    rejected += await ensureCompanyLeadership(
      company,
      domain,
      jobTitles,
      contacts,
      seen,
      paths
    );
  }

  const titleFilter = applyTitleFilterWithConfidence(contacts, jobTitles);
  const quality = applyPostTitleQualityGate(titleFilter.contacts, {
    relaxedMatch: titleFilter.relaxedMatch,
  });
  const marked = markTitleMatch(quality.contacts, jobTitles, titleFilter.relaxedMatch);

  return {
    contacts: await finalizePeopleStepContacts(marked, company, jobTitles),
    parsedCount: contacts.length,
    filteredCount: titleFilter.filteredCount,
    rejectedCount: rejected + quality.rejectedCount,
    relaxedMatch: titleFilter.relaxedMatch,
  };
}

async function scrapeCompanyContactsWithoutDomain(
  company: ContactDiscoveryParams["companies"][number],
  jobTitles: string[]
): Promise<CompanyScrapeResult> {
  const contacts: DiscoveredContact[] = [];
  const seen = new Set<string>();
  let mergeRejectedCount = 0;

  log.info("People discovery without website domain — using directory and web search", {
    company: company.name,
  });

  mergeRejectedCount += await runFallbackDiscovery(company, "", jobTitles, contacts, seen, {
    skipDomainSearch: true,
    broadDecisionMakerSearch: true,
  });

  let titleFilter = applyTitleFilterWithConfidence(contacts, jobTitles);
  if (titleFilter.contacts.length === 0) {
    mergeRejectedCount += await runFallbackDiscovery(company, "", jobTitles, contacts, seen, {
      skipDomainSearch: true,
      skipDirectorySearch: true,
      broadDecisionMakerSearch: true,
    });
    titleFilter = applyTitleFilterWithConfidence(contacts, jobTitles);
  }

  const quality = applyPostTitleQualityGate(titleFilter.contacts, {
    relaxedMatch: titleFilter.relaxedMatch,
  });
  const marked = markTitleMatch(quality.contacts, jobTitles, titleFilter.relaxedMatch);

  return {
    contacts: await finalizePeopleStepContacts(marked, company, jobTitles),
    parsedCount: contacts.length,
    filteredCount: titleFilter.filteredCount,
    rejectedCount: mergeRejectedCount + quality.rejectedCount,
    relaxedMatch: titleFilter.relaxedMatch,
  };
}

async function runFallbackDiscovery(
  company: ContactDiscoveryParams["companies"][number],
  domain: string,
  jobTitles: string[],
  contacts: DiscoveredContact[],
  seen: Set<string>,
  options?: {
    skipWikidata?: boolean;
    skipLeadershipSearch?: boolean;
    skipDirectorySearch?: boolean;
    skipDomainSearch?: boolean;
    broadDecisionMakerSearch?: boolean;
  }
): Promise<number> {
  let rejected = 0;
  const fallbackOptions = {
    ...(options?.broadDecisionMakerSearch ? { broadDecisionMakerSearch: true as const } : {}),
    scrapeProfiles: true as const,
  };
  const searchName = companySearchName(company);

  if (
    !options?.skipDomainSearch &&
    domain &&
    (isScrapingToolAvailable("searxng") || isScrapingToolAvailable("duckduckgo"))
  ) {
    const domainPeople = await discoverLeadershipOnCompanyDomain(
      searchName,
      domain,
      jobTitles,
      fallbackOptions
    );
    if (domainPeople.length > 0) {
      rejected += mergeParsedContacts(
        domainPeople,
        contacts,
        seen,
        company,
        domain,
        jobTitles
      );
      log.info("Domain-scoped leadership search fallback", {
        domain,
        company: company.name,
        added: domainPeople.length,
      });
    }
  }

  if (!options?.skipDirectorySearch && getSearxngBaseUrl()) {
    const directoryPeople = await discoverPeopleFromPublicDirectories(
      searchName,
      domain,
      jobTitles,
      fallbackOptions
    );
    if (directoryPeople.length > 0) {
      rejected += mergeParsedContacts(
        directoryPeople,
        contacts,
        seen,
        company,
        domain,
        jobTitles
      );
      log.info("Public directory people fallback", {
        domain,
        company: company.name,
        added: directoryPeople.length,
      });
    }
  }

  if (domain) {
    const pressPeople = await discoverLeadershipFromPressPages(searchName, domain);
    if (pressPeople.length > 0) {
      rejected += mergeParsedContacts(
        pressPeople,
        contacts,
        seen,
        company,
        domain,
        jobTitles
      );
      log.info("Press release leadership fallback", {
        domain,
        company: company.name,
        added: pressPeople.length,
      });
    }
  }

  if (!options?.skipWikidata && isScrapingToolAvailable("wikidata-people")) {
    const wikidataPeople = await fetchLeadershipFromWikidata(searchName);
    if (wikidataPeople.length > 0) {
      rejected += mergeParsedContacts(
        wikidataPeople,
        contacts,
        seen,
        company,
        domain,
        jobTitles
      );
      log.info("Wikidata directory fallback", {
        domain,
        company: company.name,
        added: wikidataPeople.length,
      });
    }
  }

  if (options?.skipLeadershipSearch) return rejected;

  if (getSearxngBaseUrl()) {
    const searchPeople = await discoverLeadershipViaSearch(
      searchName,
      jobTitles,
      domain,
      fallbackOptions
    );
    if (searchPeople.length > 0) {
      rejected += mergeParsedContacts(searchPeople, contacts, seen, company, domain, jobTitles);
      log.info("Leadership web search fallback", {
        domain,
        company: company.name,
        added: searchPeople.length,
      });
    }
  }

  return rejected;
}

function companySearchName(company: ContactDiscoveryParams["companies"][number]): string {
  return normalizeCompanyNameForSearch(company.name);
}

/** Last-resort passes when a company still has no leaders after website scraping. */
async function ensureCompanyLeadership(
  company: ContactDiscoveryParams["companies"][number],
  domain: string,
  jobTitles: string[],
  contacts: DiscoveredContact[],
  seen: Set<string>,
  paths: string[]
): Promise<number> {
  let rejected = 0;

  if (applyTitleFilter(contacts, jobTitles).contacts.length > 0) {
    return 0;
  }

  if (getSearxngBaseUrl()) {
    const searchPeople = await discoverLeadershipViaSearch(
      companySearchName(company),
      jobTitles,
      domain || null,
      { broadDecisionMakerSearch: true, scrapeProfiles: true }
    );
    if (searchPeople.length > 0) {
      rejected += mergeParsedContacts(
        searchPeople,
        contacts,
        seen,
        company,
        domain,
        jobTitles
      );
      log.info("LinkedIn leadership pass", {
        company: company.name,
        added: searchPeople.length,
      });
    }
  }

  if (applyTitleFilter(contacts, jobTitles).contacts.length > 0) {
    return rejected;
  }

  if (isScrapingToolAvailable("wikidata-people")) {
    const wikidataPeople = await fetchLeadershipFromWikidata(companySearchName(company));
    if (wikidataPeople.length > 0) {
      rejected += mergeParsedContacts(
        wikidataPeople,
        contacts,
        seen,
        company,
        domain,
        jobTitles
      );
      log.info("Wikidata leadership pass", {
        company: company.name,
        added: wikidataPeople.length,
      });
    }
  }

  if (applyTitleFilter(contacts, jobTitles).contacts.length > 0) {
    return rejected;
  }

  const leadershipPaths = [
    ...paths.filter((path) => isLeadershipDirectoryUrl(path)),
    ...(domain ? [normalizeWebsiteUrl(domain)] : []),
  ];
  const uniquePaths = [...new Set(leadershipPaths)].slice(0, 4);

  for (const path of uniquePaths) {
    if (!domain) break;
    const { contacts: parsed } = await scrapeContactsFromUrl(
      path,
      domain,
      PEOPLE_DISCOVERY_FETCH,
      {
        companyName: companySearchName(company),
        skipAi: false,
        useApify: isApifyEnabled(),
      }
    );
    rejected += mergeParsedContacts(parsed, contacts, seen, company, domain, jobTitles, {
      sourceUrl: path,
    });
    if (applyTitleFilter(contacts, jobTitles).contacts.length > 0) {
      break;
    }
  }

  return rejected;
}

async function scrapeCompanyContacts(
  company: ContactDiscoveryParams["companies"][number],
  jobTitles: string[]
): Promise<CompanyScrapeResult> {
  try {
    return await scrapeCompanyContactsInner(company, jobTitles);
  } catch (error) {
    log.warn("Company contact scrape failed", {
      company: company.name,
      domain: company.domain,
      error: String(error),
    });
    return { contacts: [], parsedCount: 0, filteredCount: 0, rejectedCount: 0, relaxedMatch: false };
  }
}

async function scrapeCompanyContactsInner(
  company: ContactDiscoveryParams["companies"][number],
  jobTitles: string[]
): Promise<CompanyScrapeResult> {
  if (!company.domain) {
    return scrapeCompanyContactsWithoutDomain(company, jobTitles);
  }

  const domain = company.domain.replace(/^www\./, "");
  const cacheKey = contactsCacheKey(domain);
  const cached = await getScrapeCache<CachedContactRow[]>(cacheKey);

  if (cached?.length) {
    const restored = cached.map((row, index) =>
      fromCachedRow(row, company, domain, index)
    );
    const titleFilter = applyTitleFilterWithConfidence(restored, jobTitles);

    const shouldRefreshCache =
      restored.length < 5 ||
      (titleFilter.contacts.length < MAX_CONTACTS_PER_COMPANY &&
        countLeadershipContacts(restored, jobTitles) > titleFilter.contacts.length);

    if (titleFilter.contacts.length > 0 && !shouldRefreshCache) {
      const quality = applyPostTitleQualityGate(titleFilter.contacts, {
        relaxedMatch: titleFilter.relaxedMatch,
      });
      const marked = markTitleMatch(quality.contacts, jobTitles, titleFilter.relaxedMatch);
      log.info("Using cached contacts", {
        domain,
        pool: restored.length,
        count: marked.length,
        relaxedMatch: titleFilter.relaxedMatch,
      });
      return {
        contacts: await finalizePeopleStepContacts(marked, company, jobTitles),
        parsedCount: restored.length,
        filteredCount: titleFilter.filteredCount,
        rejectedCount: quality.rejectedCount,
        relaxedMatch: titleFilter.relaxedMatch,
      };
    }

    if (titleFilter.contacts.length > 0 && shouldRefreshCache) {
      log.info("Cache incomplete for leadership coverage, re-scraping", {
        domain,
        cached: restored.length,
        selected: titleFilter.contacts.length,
      });
    }

    const fallbackPool = [...restored];
    const fallbackSeen = new Set(
      restored.map((contact) => `${contact.fullName.toLowerCase()}|${contact.title.toLowerCase()}`)
    );
    await runFallbackDiscovery(company, domain, jobTitles, fallbackPool, fallbackSeen, {
      broadDecisionMakerSearch: true,
    });
    const fallbackFilter = applyTitleFilterWithConfidence(fallbackPool, jobTitles);
    if (fallbackFilter.contacts.length > 0) {
      const quality = applyPostTitleQualityGate(fallbackFilter.contacts, {
        relaxedMatch: fallbackFilter.relaxedMatch,
      });
      const marked = markTitleMatch(quality.contacts, jobTitles, fallbackFilter.relaxedMatch);
      if (fallbackPool.length > 0) {
        await setScrapeCache(cacheKey, "contacts", fallbackPool.map(toCachedRow));
      }
      log.info("Using cached contacts with decision-maker fallback", {
        domain,
        count: marked.length,
        relaxedMatch: fallbackFilter.relaxedMatch,
      });
      return {
        contacts: await finalizePeopleStepContacts(marked, company, jobTitles),
        parsedCount: fallbackPool.length,
        filteredCount: fallbackFilter.filteredCount,
        rejectedCount: quality.rejectedCount,
        relaxedMatch: fallbackFilter.relaxedMatch,
      };
    }

    log.info("Cached contacts did not match job titles, re-scraping", { domain });
  }

  const paths = buildPhasedPeoplePaths(await discoverDirectoryPaths(domain), domain);
  const contacts: DiscoveredContact[] = [];
  const seen = new Set<string>();
  let rawParsedCount = 0;
  let mergeRejectedCount = 0;
  let leadershipSatisfied = false;

  const domainSearchPromise =
    isScrapingToolAvailable("searxng") || isScrapingToolAvailable("duckduckgo")
      ? discoverLeadershipOnCompanyDomain(companySearchName(company), domain, jobTitles, {
          broadDecisionMakerSearch: true,
        })
      : Promise.resolve([]);

  async function scrapePath(path: string): Promise<void> {
    if (leadershipSatisfied || contacts.length >= MAX_RAW_CONTACTS_PER_COMPANY) return;

    const enableAi = shouldEnableAiForPath(path) && isPeopleDiscoveryAiEnabled();
    const { contacts: parsed, source } = await scrapeContactsFromUrl(
      path,
      domain,
      PEOPLE_DISCOVERY_FETCH,
      {
        companyName: companySearchName(company),
        skipAi: !enableAi,
        useApify: isApifyEnabled(),
      }
    );
    rawParsedCount += parsed.length;

    if (source === "playwright") {
      log.info("Playwright rendered contacts", { domain, path, count: parsed.length });
    }
    if (source === "ai") {
      log.info("AI extracted contacts", { domain, path, count: parsed.length });
    }
    if (source === "apify") {
      log.info("Apify extracted contacts", { domain, path, count: parsed.length });
    }

    mergeRejectedCount += mergeParsedContacts(parsed, contacts, seen, company, domain, jobTitles, {
      sourceUrl: path,
    });

    if (hasFullLeadershipCoverage(contacts, jobTitles)) {
      leadershipSatisfied = true;
    }
  }

  const leadershipPhase = paths.filter((path) => classifyPeoplePathPhase(path) === "leadership");
  const aboutPhase = paths.filter((path) => classifyPeoplePathPhase(path) === "about");
  const otherPhase = paths.filter((path) => classifyPeoplePathPhase(path) === "other");

  for (const path of leadershipPhase) {
    if (leadershipSatisfied) break;
    await scrapePath(path);
  }

  if (!leadershipSatisfied) {
    for (const path of aboutPhase) {
      if (leadershipSatisfied) break;
      await scrapePath(path);
    }
  }

  if (!leadershipSatisfied) {
    await mapPool(otherPhase, PATH_SCRAPE_CONCURRENCY, async (path) => {
      if (leadershipSatisfied) return;
      await scrapePath(path);
    });
  }

  const domainSearchPeople = await domainSearchPromise;
  if (domainSearchPeople.length > 0) {
    mergeRejectedCount += mergeParsedContacts(
      domainSearchPeople,
      contacts,
      seen,
      company,
      domain,
      jobTitles
    );
    log.info("Domain-scoped leadership search (parallel)", {
      domain,
      company: company.name,
      added: domainSearchPeople.length,
    });
  }

  if (contacts.length === 0) {
    const homepage = normalizeWebsiteUrl(domain);
    const { contacts: parsed } = await scrapeContactsFromUrl(
      homepage,
      domain,
      PEOPLE_DISCOVERY_FETCH,
      { companyName: companySearchName(company), skipAi: true, useApify: isApifyEnabled() }
    );
    rawParsedCount += parsed.length;
    mergeRejectedCount += mergeParsedContacts(parsed, contacts, seen, company, domain, jobTitles, {
      sourceUrl: homepage,
    });
  }

  if (!hasEnoughLeadership(contacts, jobTitles)) {
    mergeRejectedCount += await runFallbackDiscovery(
      company,
      domain,
      jobTitles,
      contacts,
      seen,
      { skipDomainSearch: true, broadDecisionMakerSearch: true }
    );
  }

  if (!hasEnoughLeadership(contacts, jobTitles)) {
    mergeRejectedCount += await deepLeadershipScrape(
      company,
      domain,
      jobTitles,
      contacts,
      seen,
      paths
    );
  }

  let titleFilter = applyTitleFilterWithConfidence(contacts, jobTitles);

  if (!hasEnoughLeadership(contacts, jobTitles)) {
    mergeRejectedCount += await ensureCompanyLeadership(
      company,
      domain,
      jobTitles,
      contacts,
      seen,
      paths
    );
    titleFilter = applyTitleFilterWithConfidence(contacts, jobTitles);
  } else if (
    titleFilter.relaxedMatch &&
    countLeadershipContacts(contacts, jobTitles) < TARGET_DECISION_MAKERS_PER_COMPANY
  ) {
    mergeRejectedCount += await ensureCompanyLeadership(
      company,
      domain,
      jobTitles,
      contacts,
      seen,
      paths
    );
    titleFilter = applyTitleFilterWithConfidence(contacts, jobTitles);
  }

  const discoveredCount = Math.max(rawParsedCount, contacts.length);

  const quality = applyPostTitleQualityGate(titleFilter.contacts, {
    relaxedMatch: titleFilter.relaxedMatch,
  });
  const rejectedCount = mergeRejectedCount + quality.rejectedCount;
  const marked = markTitleMatch(quality.contacts, jobTitles, titleFilter.relaxedMatch);

  if (contacts.length > 0) {
    await setScrapeCache(cacheKey, "contacts", contacts.map(toCachedRow));
  }

  return {
    contacts: await finalizePeopleStepContacts(marked, company, jobTitles),
    parsedCount: discoveredCount,
    filteredCount: titleFilter.filteredCount,
    rejectedCount,
    relaxedMatch: titleFilter.relaxedMatch,
  };
}

export class ScrapingContactDiscoveryProvider implements ContactDiscoveryProvider {
  readonly name = "scraping";

  async search(params: ContactDiscoveryParams): Promise<ProviderContactSearchResult> {
    const contacts: DiscoveredContact[] = [];
    const companies = params.companies.slice(0, MAX_COMPANIES_PER_RUN);
    let parsedCount = 0;
    let filteredCount = 0;
    let rejectedCount = 0;
    let relaxedMatch = false;

    const companyResults = await mapPool(
      companies,
      COMPANY_SCRAPE_CONCURRENCY,
      (company) => scrapeCompanyContacts(company, params.jobTitles)
    );
    for (const found of companyResults) {
      contacts.push(...found.contacts);
      parsedCount += found.parsedCount;
      filteredCount += found.filteredCount;
      rejectedCount += found.rejectedCount;
      relaxedMatch = relaxedMatch || found.relaxedMatch;
    }

    const coveredCompanyIds = new Set(contacts.map((contact) => contact.companyId));
    const uncoveredCompanies = companies.filter((company) => !coveredCompanyIds.has(company.id));

    if (uncoveredCompanies.length > 0) {
      log.info("Supplementing companies without decision-makers", {
        total: companies.length,
        uncovered: uncoveredCompanies.length,
      });

      const supplements = await mapPool(uncoveredCompanies, 2, (company) =>
        supplementCompanyLeadership(company, params.jobTitles)
      );

      for (const found of supplements) {
        contacts.push(...found.contacts);
        parsedCount += found.parsedCount;
        filteredCount += found.filteredCount;
        rejectedCount += found.rejectedCount;
        relaxedMatch = relaxedMatch || found.relaxedMatch;
      }
    }

    relaxedMatch =
      relaxedMatch || contacts.some((contact) => contact.titleMatched === false);

    const scrapedCount = contacts.length;
    const ranked = limitContactsPerCompany(
      rankContactsByRelevance(contacts, params.jobTitles),
      MAX_CONTACTS_PER_COMPANY
    );
    const companiesWithContacts = new Set(ranked.map((contact) => contact.companyId)).size;
    const totalEntries = ranked.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / params.perPage));
    const start = (params.page - 1) * params.perPage;
    const pageItems = ranked.slice(start, start + params.perPage);

    log.info("Contact scraping completed", {
      companies: companies.length,
      companiesWithContacts,
      parsed: parsedCount,
      matched: scrapedCount,
      filtered: filteredCount,
    });

    return {
      contacts: pageItems,
      scrapedCount,
      parsedCount,
      filteredCount,
      rejectedCount,
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
