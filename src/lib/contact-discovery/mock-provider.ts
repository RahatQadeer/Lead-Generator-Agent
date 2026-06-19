import { applyTitleFilter } from "@/lib/contact-discovery/apply-title-filter";
import type { ContactDiscoveryProvider, ProviderContactSearchResult } from "@/lib/contact-discovery/types";
import {
  computeContactConfidence,
  inferDepartment,
} from "@/lib/scraping/relevance";
import { sanitizePersonLinkedInUrl } from "@/lib/scraping/data-quality";
import { normalizeDomain } from "@/lib/search/exclusions";
import type { ContactDiscoveryParams, DiscoveredContact } from "@/types/contact";

interface MockContactSeed {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  linkedinUrl: string | null;
}

const MOCK_CONTACTS_BY_DOMAIN: Record<string, MockContactSeed[]> = {
  "abchealth.com": [
    {
      firstName: "Alice",
      lastName: "Morgan",
      title: "CEO",
      email: "alice.morgan@abchealth.com",
      linkedinUrl: "https://linkedin.com/in/alice-morgan",
    },
    {
      firstName: "Brian",
      lastName: "Cho",
      title: "CTO",
      email: "brian.cho@abchealth.com",
      linkedinUrl: null,
    },
  ],
  "medtechpro.com": [
    {
      firstName: "Sarah",
      lastName: "Chen",
      title: "CEO",
      email: "sarah.chen@medtechpro.com",
      linkedinUrl: "https://linkedin.com/in/sarah-chen",
    },
    {
      firstName: "James",
      lastName: "Park",
      title: "CTO",
      email: "james.park@medtechpro.com",
      linkedinUrl: "https://linkedin.com/in/james-park",
    },
    {
      firstName: "Mike",
      lastName: "Torres",
      title: "VP Sales",
      email: "mike.torres@medtechpro.com",
      linkedinUrl: null,
    },
  ],
  "caresync.io": [
    {
      firstName: "Lisa",
      lastName: "Wong",
      title: "Founder",
      email: "lisa.wong@caresync.io",
      linkedinUrl: "https://linkedin.com/in/lisa-wong",
    },
    {
      firstName: "Emma",
      lastName: "Reed",
      title: "Marketing Director",
      email: "emma.reed@caresync.io",
      linkedinUrl: null,
    },
  ],
  "healthbridge.com": [
    {
      firstName: "David",
      lastName: "Kim",
      title: "CEO",
      email: "david.kim@healthbridge.com",
      linkedinUrl: null,
    },
    {
      firstName: "Rachel",
      lastName: "Foster",
      title: "CTO",
      email: "rachel.foster@healthbridge.com",
      linkedinUrl: "https://linkedin.com/in/rachel-foster",
    },
  ],
  "novacare.com": [
    {
      firstName: "Tom",
      lastName: "Walsh",
      title: "Founder",
      email: "tom.walsh@novacare.com",
      linkedinUrl: null,
    },
    {
      firstName: "Nina",
      lastName: "Patel",
      title: "CTO",
      email: "nina.patel@novacare.com",
      linkedinUrl: "https://linkedin.com/in/nina-patel",
    },
  ],
  "competitor.com": [
    {
      firstName: "John",
      lastName: "Smith",
      title: "CEO",
      email: "john.smith@competitor.com",
      linkedinUrl: null,
    },
  ],
  "finedge.com": [
    {
      firstName: "Oliver",
      lastName: "Grant",
      title: "CEO",
      email: "oliver.grant@finedge.com",
      linkedinUrl: null,
    },
    {
      firstName: "Sophie",
      lastName: "Bell",
      title: "VP Sales",
      email: "sophie.bell@finedge.com",
      linkedinUrl: null,
    },
  ],
  "techflow.io": [
    {
      firstName: "Alex",
      lastName: "Rivera",
      title: "Founder",
      email: "alex.rivera@techflow.io",
      linkedinUrl: null,
    },
    {
      firstName: "Jordan",
      lastName: "Lee",
      title: "CTO",
      email: "jordan.lee@techflow.io",
      linkedinUrl: null,
    },
  ],
  "butterbee.co": [
    {
      firstName: "Laiba",
      lastName: "Kafayat",
      title: "CEO",
      email: "layibakafayat@gmail.com",
      linkedinUrl: null,
    },
  ],
};

function buildMockContacts(params: ContactDiscoveryParams): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];

  for (const company of params.companies) {
    const domain = company.domain ? normalizeDomain(company.domain) : null;
    if (!domain) continue;

    const seeds = MOCK_CONTACTS_BY_DOMAIN[domain] ?? [];
    for (const seed of seeds) {
      const department = inferDepartment(seed.title);
      const linkedinUrl = sanitizePersonLinkedInUrl(seed.linkedinUrl);
      const contact: DiscoveredContact = {
        id: `mock-${domain}-${seed.email}`,
        companyId: company.id,
        companyName: company.name,
        companyDomain: company.domain,
        firstName: seed.firstName,
        lastName: seed.lastName,
        fullName: `${seed.firstName} ${seed.lastName}`,
        title: seed.title,
        department,
        email: seed.email,
        emailIsGuessed: false,
        linkedinUrl,
        confidenceScore: 0,
      };
      contact.confidenceScore = computeContactConfidence({
        title: contact.title,
        email: contact.email,
        emailIsGuessed: false,
        linkedinUrl: contact.linkedinUrl,
        jobTitles: params.jobTitles,
      });
      contacts.push(contact);
    }
  }

  return contacts;
}

export class MockContactDiscoveryProvider implements ContactDiscoveryProvider {
  readonly name = "mock";

  async search(params: ContactDiscoveryParams): Promise<ProviderContactSearchResult> {
    await new Promise((r) => setTimeout(r, 300));

    const allContacts = buildMockContacts(params);
    const scrapedCount = allContacts.length;
    const { contacts: matched, filteredCount } = applyTitleFilter(
      allContacts,
      params.jobTitles
    );

    const totalEntries = matched.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / params.perPage));
    const start = (params.page - 1) * params.perPage;
    const pageItems = matched.slice(start, start + params.perPage);

    return {
      contacts: pageItems,
      scrapedCount,
      filteredCount,
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
