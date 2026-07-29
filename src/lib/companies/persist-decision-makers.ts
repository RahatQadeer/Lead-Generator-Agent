import { getCompaniesBySearchId } from "@/lib/companies/queries";
import { upsertDiscoveredContacts } from "@/lib/contacts/queries";
import { normalizeDomain } from "@/lib/scrapers/utils/normalize";
import { sanitizePersonLinkedInUrl } from "@/lib/scraping/data-quality";
import { createLogger } from "@/lib/logger";
import type { DiscoveredCompany } from "@/types/company";
import type { DiscoveredContact } from "@/types/contact";
import type { ScraperFounder } from "@/lib/scrapers/types";

const log = createLogger("company-discovery.decision-makers");
const PROVIDER = "directory-scraper";

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function foundersToContacts(
  company: DiscoveredCompany,
  companyDbId: string
): DiscoveredContact[] {
  const founders = company.founders ?? [];
  const sourceUrl = company.directoryProfile?.sourceUrl ?? null;

  return founders
    .filter((founder): founder is ScraperFounder => Boolean(founder?.name?.trim()))
    .map((founder, index) => {
      const fullName = founder.name.trim();
      const { firstName, lastName } = splitName(fullName);

      return {
        id: `${companyDbId}:founder:${index}`,
        companyId: companyDbId,
        companyName: company.name,
        companyDomain: company.domain,
        firstName,
        lastName,
        fullName,
        title: founder.title?.trim() || "Founder",
        department: null,
        email: null,
        emailIsGuessed: false,
        linkedinUrl: sanitizePersonLinkedInUrl(founder.linkedinUrl ?? null),
        confidenceScore: 60,
        sourceUrl,
        discoverySource: "directory_listing",
        titleMatched: true,
      } satisfies DiscoveredContact;
    });
}

/**
 * Persist the publicly-listed founders/leadership that directory scrapers found
 * as decision-maker contacts, tied to their company + search. Company DB ids are
 * resolved by domain/name from the companies just upserted for this search.
 * Best-effort: a failure here never fails the discovery run.
 */
export async function persistDecisionMakers(
  userId: string,
  searchId: string,
  companies: DiscoveredCompany[]
): Promise<{ savedCount: number }> {
  const companiesWithFounders = companies.filter(
    (company) => (company.founders?.length ?? 0) > 0
  );
  if (companiesWithFounders.length === 0) return { savedCount: 0 };

  try {
    const persisted = await getCompaniesBySearchId(userId, searchId);
    const idByDomain = new Map<string, string>();
    const idByName = new Map<string, string>();
    for (const row of persisted) {
      const domain = normalizeDomain(row.domain);
      if (domain) idByDomain.set(domain, row.id);
      idByName.set(row.name.trim().toLowerCase(), row.id);
    }

    const contacts: DiscoveredContact[] = [];
    for (const company of companiesWithFounders) {
      const domain = normalizeDomain(company.domain);
      const dbId =
        (domain ? idByDomain.get(domain) : undefined) ??
        idByName.get(company.name.trim().toLowerCase());
      if (!dbId) continue; // company was deduped away / not persisted under this search
      contacts.push(...foundersToContacts(company, dbId));
    }

    if (contacts.length === 0) return { savedCount: 0 };

    const { savedCount, failedCount, errorMessage } = await upsertDiscoveredContacts(
      userId,
      searchId,
      PROVIDER,
      contacts
    );

    if (failedCount > 0) {
      log.warn("Some decision-maker contacts failed to persist", {
        failedCount,
        errorMessage,
      });
    }
    log.info("Persisted decision-maker contacts from directory scrapers", {
      savedCount,
      companies: companiesWithFounders.length,
    });

    return { savedCount };
  } catch (error) {
    log.warn("Decision-maker persistence failed — continuing", {
      error: String(error),
    });
    return { savedCount: 0 };
  }
}
