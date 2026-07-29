import { createLogger } from "@/lib/logger";
import { linkedInTextNamesOtherEmployer } from "@/lib/scraping/company-affiliation";
import {
  splitPersonName,
  upgradePartialPersonName,
} from "@/lib/scraping/contact-name-match";
import { sanitizePersonLinkedInForContact } from "@/lib/scraping/data-quality";
import { discoverPersonLinkedIn } from "@/lib/scraping/linkedin-search";
import { isLinkedInWebSearchAvailable } from "@/lib/scraping/linkedin-profile-search";
import { mapPool } from "@/lib/scraping/parallel-pool";
import { computeContactConfidence } from "@/lib/scraping/relevance";
import type { ContactDiscoveryParams, DiscoveredContact } from "@/types/contact";

const log = createLogger("contact-discovery.linkedin");
const LINKEDIN_RESOLVE_CONCURRENCY = 5;

function jobTitleForLinkedInSearch(contact: DiscoveredContact): string {
  const title = contact.title?.trim() || "";
  if (title && !/^team member$/i.test(title)) return title;
  const fromContext = contact.titleContext?.trim();
  if (fromContext) return fromContext.slice(0, 120);
  return title || "Team Member";
}

/** Step 2 keeps LinkedIn from Google search; email waits for step 3. */
function stripContactDetailsForPeopleStep(
  contact: DiscoveredContact
): DiscoveredContact {
  return {
    ...contact,
    email: null,
    emailIsGuessed: false,
  };
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

/** Missing URL or website link whose /in/ slug does not match the person. */
export function contactNeedsLinkedInWebSearch(
  contact: DiscoveredContact,
  companyName: string
): boolean {
  if (!contact.linkedinUrl?.trim()) return true;
  return !sanitizePersonLinkedInForContact(
    contact.linkedinUrl,
    contact.fullName,
    companyName
  );
}

async function attachDiscoveredLinkedIn(
  contact: DiscoveredContact,
  company: ContactDiscoveryParams["companies"][number],
  discovered: Awaited<ReturnType<typeof discoverPersonLinkedIn>>
): Promise<DiscoveredContact> {
  if (!discovered.url) return contact;

  const headline = [discovered.headline, discovered.resolvedFullName]
    .filter(Boolean)
    .join(" ");
  if (
    linkedInTextNamesOtherEmployer(headline, {
      name: company.name,
      domain: company.domain,
    })
  ) {
    log.info("Skipped LinkedIn profile — headline names another employer", {
      name: contact.fullName,
      company: company.name,
      headline: discovered.headline,
      url: discovered.url,
    });
    return contact;
  }

  const linkedinUrl = sanitizePersonLinkedInForContact(
    discovered.url,
    contact.fullName,
    company.name
  );

  if (!linkedinUrl) {
    log.info("Skipped LinkedIn profile — slug does not match person", {
      name: contact.fullName,
      company: company.name,
      url: discovered.url,
      companyMatch: discovered.companyMatch,
    });
    return contact;
  }

  const fullName = upgradePartialPersonName(
    contact.fullName,
    discovered.resolvedFullName
  );
  const { firstName, lastName } = splitPersonName(fullName);

  log.info("LinkedIn profile resolved via Google/SearXNG search", {
    name: fullName,
    previousName: contact.fullName !== fullName ? contact.fullName : undefined,
    company: company.name,
    title: jobTitleForLinkedInSearch(contact),
    url: linkedinUrl,
    replacedWeakUrl: Boolean(
      contact.linkedinUrl && contact.linkedinUrl !== linkedinUrl
    ),
  });

  return {
    ...contact,
    fullName,
    firstName,
    lastName,
    linkedinUrl,
    discoverySource:
      contact.discoverySource === "website_team" ||
      contact.discoverySource === "domain_search" ||
      contact.discoverySource === "directory_listing"
        ? "linkedin_search"
        : contact.discoverySource,
  };
}

/**
 * Google/SearXNG search: person name + role + company (+ location) → best /in/ profile.
 * Tries strict company match first, then relaxed name/slug match.
 */
export async function resolveLinkedInViaWebSearch(
  contacts: DiscoveredContact[],
  company: ContactDiscoveryParams["companies"][number]
): Promise<DiscoveredContact[]> {
  if (!isLinkedInWebSearchAvailable()) return contacts;

  return mapPool(contacts, LINKEDIN_RESOLVE_CONCURRENCY, async (contact) => {
    if (!contactNeedsLinkedInWebSearch(contact, company.name)) return contact;

    const searchTitle = jobTitleForLinkedInSearch(contact);
    const discovered = await discoverPersonLinkedIn(
      contact.fullName,
      company.name,
      company.domain,
      searchTitle,
      {
        companyCity: company.city,
        companyState: company.state,
        companyCountry: company.country,
      }
    );

    return attachDiscoveredLinkedIn(contact, company, discovered);
  });
}

/** Attach LinkedIn profile URLs and refresh relevance scores for step-2 people. */
export async function finalizePeopleStepContacts(
  contacts: DiscoveredContact[],
  company: ContactDiscoveryParams["companies"][number],
  jobTitles: string[]
): Promise<DiscoveredContact[]> {
  const withLinkedIn = await resolveLinkedInViaWebSearch(contacts, company);
  return withLinkedIn.map((contact) =>
    refreshContactConfidence(stripContactDetailsForPeopleStep(contact), jobTitles)
  );
}
