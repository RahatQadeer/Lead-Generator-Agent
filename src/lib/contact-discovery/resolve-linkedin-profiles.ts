import { createLogger } from "@/lib/logger";
import { linkedInTextNamesOtherEmployer } from "@/lib/scraping/company-affiliation";
import {
  splitPersonName,
  upgradePartialPersonName,
} from "@/lib/scraping/contact-name-match";
import {
  sanitizePersonLinkedInForContact,
  sanitizePersonLinkedInFromSearchHit,
  sanitizePersonLinkedInUrl,
} from "@/lib/scraping/data-quality";
import { discoverPersonLinkedIn } from "@/lib/scraping/linkedin-search";
import { isLinkedInWebSearchAvailable } from "@/lib/scraping/linkedin-profile-search";
import { mapPool } from "@/lib/scraping/parallel-pool";
import { computeContactConfidence } from "@/lib/scraping/relevance";
import type { ContactDiscoveryParams, DiscoveredContact } from "@/types/contact";

const log = createLogger("contact-discovery.linkedin");

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

/**
 * Google/SearXNG search: person name + role + company → best matching /in/ profile URL.
 */
export async function resolveLinkedInViaWebSearch(
  contacts: DiscoveredContact[],
  company: ContactDiscoveryParams["companies"][number]
): Promise<DiscoveredContact[]> {
  if (!isLinkedInWebSearchAvailable()) return contacts;

  return mapPool(contacts, 3, async (contact) => {
    if (contact.linkedinUrl) return contact;

    const searchTitle = jobTitleForLinkedInSearch(contact);
    const discovered = await discoverPersonLinkedIn(
      contact.fullName,
      company.name,
      company.domain,
      searchTitle,
      { requireCompanyMatch: contact.discoverySource === "linkedin_search" }
    );

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

    if (
      contact.discoverySource === "linkedin_search" &&
      discovered.companyMatch === false
    ) {
      return contact;
    }

    const hitText = [discovered.headline, discovered.resolvedFullName, searchTitle]
      .filter(Boolean)
      .join(" ");
    const linkedinUrl =
      sanitizePersonLinkedInFromSearchHit(
        discovered.url,
        contact.fullName,
        company.name,
        hitText
      ) ??
      sanitizePersonLinkedInUrl(discovered.url) ??
      sanitizePersonLinkedInForContact(
        discovered.url,
        contact.fullName,
        company.name
      );

    if (!linkedinUrl) return contact;

    const fullName = upgradePartialPersonName(
      contact.fullName,
      discovered.resolvedFullName
    );
    const { firstName, lastName } = splitPersonName(fullName);

    log.info("LinkedIn profile resolved via Google/SearXNG search", {
      name: fullName,
      previousName: contact.fullName !== fullName ? contact.fullName : undefined,
      company: company.name,
      title: searchTitle,
      url: linkedinUrl,
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
