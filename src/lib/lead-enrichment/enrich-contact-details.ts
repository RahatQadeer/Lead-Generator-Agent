import { createLogger } from "@/lib/logger";
import { enrichPersonFromPeopleDataLabs } from "@/lib/people-data-labs/enrich-person";
import { isPeopleDataLabsConfigured } from "@/lib/people-data-labs/config";
import { isPaidApisDisabled } from "@/lib/providers/free-stack";
import {
  pickContactEmail,
  pickPersonalContactEmail,
  sanitizeLinkedInForLead,
  sanitizePersonLinkedInForContact,
  sanitizePersonLinkedInUrl,
  emailMatchesPersonName,
} from "@/lib/scraping/data-quality";
import { personNamesMatch, upgradePartialPersonName } from "@/lib/scraping/contact-name-match";
import {
  hasAnySocialProfile,
  mergeSocialProfiles,
  sanitizePersonPhone,
} from "@/lib/scraping/person-contact-channels";
import {
  DIRECTORY_CONTACT_PATHS,
  discoverDirectoryPaths,
} from "@/lib/scraping/directory-paths";
import { FAST_FETCH } from "@/lib/scraping/http-client";
import { normalizeWebsiteUrl } from "@/lib/scraping/extract-domain";
import { discoverPersonLinkedIn } from "@/lib/scraping/linkedin-search";
import { mapPool } from "@/lib/scraping/parallel-pool";
import {
  contactsCacheKey,
  getScrapeCache,
} from "@/lib/scraping/scrape-cache";
import { scrapeContactsFromUrl, scrapePageHtml } from "@/lib/scraping/scrape-page";
import { computeLeadConfidence } from "@/lib/lead-scoring/lead-confidence";
import { scoreTitleRelevance } from "@/lib/scraping/relevance";
import { verifySingleEmail } from "@/lib/email-verification/verify";
import { isEmailSafeToDisplay } from "@/lib/email-verification/display-status";
import type { PersonSocialProfiles } from "@/types/contact";
import type {
  ContactDetailType,
  EmailSource,
  LeadEnrichmentInput,
  LinkedInSource,
  PhoneSource,
} from "@/types/lead";

const log = createLogger("lead-enrichment.contact-details");

const MAX_ENRICH_PATHS = 10;

interface CachedContactRow {
  fullName: string;
  firstName: string;
  lastName: string | null;
  title: string;
  email: string | null;
  emailIsGuessed: boolean;
  linkedinUrl: string | null;
  phone?: string | null;
  socialProfiles?: PersonSocialProfiles | null;
}

export interface EnrichedContactDetails {
  email: string | null;
  linkedinUrl: string | null;
  phone: string | null;
  phoneSource: PhoneSource;
  socialProfiles: PersonSocialProfiles | null;
  emailSource: EmailSource;
  linkedInSource: LinkedInSource;
  contactDetailType: ContactDetailType;
  contactPageUrl: string | null;
  confidenceScore: number;
  emailIsGuessed?: boolean;
  resolvedFullName?: string | null;
}

function resolveCompanyDomain(input: LeadEnrichmentInput): string | null {
  if (input.companyDomain?.trim()) {
    return input.companyDomain.replace(/^www\./, "");
  }
  return null;
}

function resolveContactDetailType(input: {
  email: string | null;
  emailSource: EmailSource;
  linkedinUrl: string | null;
  phone: string | null;
  socialProfiles: PersonSocialProfiles | null;
  contactPageUrl: string | null;
}): ContactDetailType {
  if (input.email && input.emailSource === "found") return null;
  if (input.linkedinUrl) return "linkedin_only";
  if (input.phone) return "phone_only";
  if (hasAnySocialProfile(input.socialProfiles)) return "social_only";
  if (input.contactPageUrl) return "contact_page_only";
  return null;
}

/** Always probe standard contact paths — not limited to the leadership path slice. */
async function resolveContactPageUrl(domain: string): Promise<string | null> {
  const origin = normalizeWebsiteUrl(domain);

  for (const path of DIRECTORY_CONTACT_PATHS) {
    const url = `${origin}${path}`;
    const page = await scrapePageHtml(url, FAST_FETCH);
    if (page?.html && page.html.length > 200) {
      return url;
    }
  }

  const paths = await discoverDirectoryPaths(domain);
  const discovered = paths.find((path) => /\/contact(-us)?\/?$/i.test(path));
  return discovered ?? null;
}

/** Only personal emails listed on the company website — never pattern guesses. */
function emailFoundOnWebsite(
  fullName: string,
  email: string | null,
  emailIsGuessed: boolean
): { email: string | null; emailSource: EmailSource } {
  if (!email || emailIsGuessed) return { email: null, emailSource: null };

  const picked = pickPersonalContactEmail(fullName, email);
  if (!picked.email || picked.emailIsGuessed) {
    return { email: null, emailSource: null };
  }

  return { email: picked.email, emailSource: "found" };
}

function emailFromScrapedContact(
  fullName: string,
  rawEmail: string | null,
  source: "page" | "pattern"
): { email: string | null; emailSource: EmailSource } {
  if (source === "pattern") {
    return { email: null, emailSource: null };
  }

  const picked = pickContactEmail(rawEmail, source, fullName);
  if (!picked.email || picked.emailIsGuessed) {
    return { email: null, emailSource: null };
  }
  return { email: picked.email, emailSource: "found" };
}

function detailsFromCacheRow(
  row: CachedContactRow,
  fullName: string,
  companyName: string
): Pick<
  EnrichedContactDetails,
  "email" | "linkedinUrl" | "emailSource" | "linkedInSource" | "phone" | "socialProfiles"
> {
  const emailResult = emailFoundOnWebsite(fullName, row.email, row.emailIsGuessed);
  const linkedinUrl =
    sanitizePersonLinkedInUrl(row.linkedinUrl) ??
    sanitizePersonLinkedInForContact(row.linkedinUrl, fullName, companyName);
  return {
    email: emailResult.email,
    emailSource: emailResult.emailSource,
    linkedinUrl,
    linkedInSource: linkedinUrl ? "website" : null,
    phone: sanitizePersonPhone(row.phone),
    socialProfiles: row.socialProfiles ?? null,
  };
}

function finalizeDetails(
  input: LeadEnrichmentInput,
  details: Pick<
    EnrichedContactDetails,
    | "email"
    | "linkedinUrl"
    | "emailSource"
    | "linkedInSource"
    | "contactPageUrl"
    | "resolvedFullName"
  > & {
    emailIsGuessed?: boolean;
    phone?: string | null;
    phoneSource?: PhoneSource;
    socialProfiles?: PersonSocialProfiles | null;
  }
): EnrichedContactDetails {
  let emailResult: { email: string | null; emailSource: EmailSource };
  const emailIsGuessed = Boolean(details.emailIsGuessed);

  if (details.emailSource === "found" && details.email) {
    emailResult = emailFoundOnWebsite(input.fullName, details.email, false);
  } else {
    emailResult = { email: null, emailSource: null };
  }

  const linkedinUrl = sanitizeLinkedInForLead(
    details.linkedinUrl,
    input.fullName,
    input.companyName,
    details.linkedInSource
  );

  const resolvedFullName = upgradePartialPersonName(
    input.fullName,
    details.resolvedFullName
  );

  const phone = sanitizePersonPhone(details.phone);
  const socialProfiles = details.socialProfiles ?? null;

  const contactDetailType = resolveContactDetailType({
    email: emailResult.email,
    emailSource: emailResult.emailSource,
    linkedinUrl,
    phone,
    socialProfiles,
    contactPageUrl: details.contactPageUrl,
  });

  const confidenceScore = computeLeadConfidence({
    title: input.title,
    titleRelevanceScore: scoreTitleRelevance(input.title, []),
    email: emailResult.email,
    emailSource: emailResult.emailSource,
    linkedinUrl,
    linkedInSource: linkedinUrl ? details.linkedInSource : null,
    company: {
      name: input.companyName,
      industry: input.companyIndustry ?? null,
      description: input.companyDescription ?? null,
      domain: input.companyDomain,
    },
    targetIndustry: input.targetIndustry ?? "",
  });

  return {
    email: emailResult.email,
    emailSource: emailResult.emailSource,
    linkedinUrl,
    linkedInSource: linkedinUrl ? details.linkedInSource : null,
    phone,
    phoneSource: phone ? (details.phoneSource ?? "website") : null,
    socialProfiles,
    contactDetailType,
    contactPageUrl: details.contactPageUrl,
    confidenceScore,
    emailIsGuessed,
    resolvedFullName:
      resolvedFullName !== input.fullName ? resolvedFullName : details.resolvedFullName,
  };
}

interface PartialContactDetails {
  email: string | null;
  emailSource: EmailSource;
  emailIsGuessed: boolean;
  linkedinUrl: string | null;
  linkedInSource: LinkedInSource;
  phone: string | null;
  phoneSource: PhoneSource;
  socialProfiles: PersonSocialProfiles | null;
  contactPageUrl: string | null;
  resolvedFullName?: string | null;
}

function emailPriority(source: EmailSource, isGuessed: boolean): number {
  if (source === "found" && !isGuessed) return 1;
  return 0;
}

function linkedInPriority(source: LinkedInSource): number {
  if (source === "website") return 3;
  if (source === "pdl") return 2;
  if (source === "contactout") return 2;
  if (source === "public_profile") return 1;
  return 0;
}

function pickBestEmailFromSources(
  web: PartialContactDetails,
  pdl: PartialContactDetails | null
): Pick<PartialContactDetails, "email" | "emailSource" | "emailIsGuessed"> {
  const candidates = [web, pdl].filter(Boolean) as PartialContactDetails[];
  const ranked = candidates
    .filter((entry) => entry.email && entry.emailSource === "found" && !entry.emailIsGuessed)
    .sort(
      (left, right) =>
        emailPriority(right.emailSource, right.emailIsGuessed) -
        emailPriority(left.emailSource, left.emailIsGuessed)
    );

  const best = ranked[0];
  return {
    email: best?.email ?? null,
    emailSource: best?.emailSource ?? null,
    emailIsGuessed: best?.emailIsGuessed ?? false,
  };
}

function pickBestLinkedInFromSources(
  web: PartialContactDetails,
  pdl: PartialContactDetails | null
): Pick<PartialContactDetails, "linkedinUrl" | "linkedInSource" | "resolvedFullName"> {
  const candidates = [web, pdl].filter(Boolean) as PartialContactDetails[];
  const ranked = candidates
    .filter((entry) => entry.linkedinUrl)
    .sort(
      (left, right) =>
        linkedInPriority(right.linkedInSource) - linkedInPriority(left.linkedInSource)
    );

  const best = ranked[0];
  return {
    linkedinUrl: best?.linkedinUrl ?? null,
    linkedInSource: best?.linkedInSource ?? null,
    resolvedFullName: best?.resolvedFullName ?? null,
  };
}

async function enrichEmailFromPdl(
  input: LeadEnrichmentInput,
  pdl: Awaited<ReturnType<typeof enrichPersonFromPeopleDataLabs>> | null
): Promise<PartialContactDetails | null> {
  if (!pdl?.workEmail) return null;

  let email: string | null = null;
  let emailSource: EmailSource = null;

  const picked = pickPersonalContactEmail(input.fullName, pdl.workEmail);
  if (picked.email && !picked.emailIsGuessed) {
    email = picked.email;
    emailSource = "found";
  } else if (pdl.workEmail.includes("@")) {
    const normalized = pdl.workEmail.trim().toLowerCase();
    if (emailMatchesPersonName(normalized, input.fullName)) {
      email = normalized;
      emailSource = "found";
    }
  }

  if (!email) return null;

  return {
    email,
    emailSource,
    emailIsGuessed: false,
    linkedinUrl: null,
    linkedInSource: null,
    phone: null,
    phoneSource: null,
    socialProfiles: null,
    contactPageUrl: null,
  };
}

async function enrichLinkedInFromPdl(
  input: LeadEnrichmentInput,
  pdl: Awaited<ReturnType<typeof enrichPersonFromPeopleDataLabs>> | null
): Promise<PartialContactDetails | null> {
  const rawUrl = pdl?.linkedinUrl ?? input.linkedinUrl;
  const linkedinUrl =
    sanitizePersonLinkedInUrl(rawUrl) ??
    sanitizePersonLinkedInForContact(rawUrl, input.fullName, input.companyName);

  if (!linkedinUrl) return null;

  return {
    email: null,
    emailSource: null,
    emailIsGuessed: false,
    linkedinUrl,
    linkedInSource: "pdl",
    phone: null,
    phoneSource: null,
    socialProfiles: null,
    contactPageUrl: null,
  };
}

/** Website scrape + cache — email only (step 3 phase 1). */
async function enrichEmailFromWebScraping(
  input: LeadEnrichmentInput
): Promise<PartialContactDetails> {
  const domain = resolveCompanyDomain(input);
  const stored = emailFoundOnWebsite(
    input.fullName,
    input.email,
    input.emailIsGuessed ?? false
  );

  let email = stored.email;
  let emailSource: EmailSource = stored.emailSource;
  const emailIsGuessed = false;
  let contactPageUrl: string | null = null;
  let phone: string | null = null;
  let socialProfiles: PersonSocialProfiles | null = null;

  if (domain) {
    const cached = await getScrapeCache<CachedContactRow[]>(contactsCacheKey(domain));
    const cachedMatch = cached?.find((row) => personNamesMatch(row.fullName, input.fullName));
    if (cachedMatch) {
      const fromCache = detailsFromCacheRow(cachedMatch, input.fullName, input.companyName);
      if (!email && fromCache.email) {
        email = fromCache.email;
        emailSource = fromCache.emailSource;
      }
      phone = fromCache.phone;
      socialProfiles = fromCache.socialProfiles;
    }
  }

  if (domain) {
    contactPageUrl = await resolveContactPageUrl(domain);
  }

  const paths =
    domain ? (await discoverDirectoryPaths(domain)).slice(0, MAX_ENRICH_PATHS) : [];

  if (domain && !email) {
    await mapPool(paths, 3, async (path) => {
      if (email) return;

      const { contacts: parsed } = await scrapeContactsFromUrl(path, domain, FAST_FETCH, {
        companyName: input.companyName,
      });
      const match = parsed.find((person) => personNamesMatch(person.fullName, input.fullName));
      if (!match) return;

      // Harvest whatever channels this page happens to carry for the person. No extra
      // fetch is spent on them — this scrape is already paid for by the email lookup.
      phone = phone ?? sanitizePersonPhone(match.phone);
      socialProfiles = mergeSocialProfiles(socialProfiles, match.socialProfiles);

      const found = emailFromScrapedContact(input.fullName, match.email, match.source);
      if (found.email) {
        email = found.email;
        emailSource = "found";
      }
    });
  }

  return {
    email,
    emailSource,
    emailIsGuessed: false,
    linkedinUrl: null,
    linkedInSource: null,
    phone,
    phoneSource: phone ? "website" : null,
    socialProfiles,
    contactPageUrl,
  };
}

async function keepOnlyVerifiedEmail(
  contactId: string,
  fullName: string,
  email: string | null,
  emailSource: EmailSource
): Promise<{ email: string | null; emailSource: EmailSource }> {
  if (!email || emailSource !== "found") {
    return { email: null, emailSource: null };
  }

  const verification = await verifySingleEmail(contactId, email, {
    contactName: fullName,
    trustedEmail: true,
  });

  if (!isEmailSafeToDisplay(verification.displayStatus)) {
    log.info("Rejected unverified email during enrichment", {
      name: fullName,
      email,
      status: verification.displayStatus,
    });
    return { email: null, emailSource: null };
  }

  return {
    email: verification.email ?? email,
    emailSource: "found",
  };
}

/** Website scrape + Google LinkedIn search (name + role + company) for contact step. */
async function enrichLinkedInFromWebScraping(
  input: LeadEnrichmentInput
): Promise<PartialContactDetails> {
  const domain = resolveCompanyDomain(input);
  let linkedinUrl =
    sanitizePersonLinkedInUrl(input.linkedinUrl) ??
    sanitizePersonLinkedInForContact(
      input.linkedinUrl,
      input.fullName,
      input.companyName
    );
  let linkedInSource: LinkedInSource = linkedinUrl
    ? (input.linkedInSource ?? "website")
    : null;
  let contactPageUrl: string | null = null;

  let resolvedFullName: string | null = null;

  const linkedInNeedsSearch =
    !linkedinUrl ||
    !sanitizePersonLinkedInForContact(
      linkedinUrl,
      input.fullName,
      input.companyName
    );

  if (linkedInNeedsSearch) {
    const googleLinkedIn = await discoverPersonLinkedIn(
      input.fullName,
      input.companyName,
      domain,
      input.title,
      {
        companyCity: input.companyCity,
        companyState: input.companyState,
        companyCountry: input.companyCountry,
      }
    );
    // Identity guard: a web-searched profile is only kept when its /in/ slug matches
    // the person — never on snippet text alone — to avoid attaching a same-name
    // stranger. Consistent with the final lead-level gate (sanitizeLinkedInForLead).
    if (googleLinkedIn.url) {
      const sanitized = sanitizePersonLinkedInForContact(
        googleLinkedIn.url,
        input.fullName,
        input.companyName
      );
      if (sanitized) {
        linkedinUrl = sanitized;
        linkedInSource = googleLinkedIn.source ?? "public_profile";
        resolvedFullName = googleLinkedIn.resolvedFullName ?? null;
      }
    }
  }

  if (domain) {
    const cached = await getScrapeCache<CachedContactRow[]>(contactsCacheKey(domain));
    const cachedMatch = cached?.find((row) => personNamesMatch(row.fullName, input.fullName));
    if (cachedMatch) {
      const fromCache = detailsFromCacheRow(cachedMatch, input.fullName, input.companyName);
      if (!linkedinUrl && fromCache.linkedinUrl) {
        linkedinUrl = fromCache.linkedinUrl;
        linkedInSource = fromCache.linkedInSource;
      }
    }
  }

  if (domain) {
    contactPageUrl = await resolveContactPageUrl(domain);
    const paths = (await discoverDirectoryPaths(domain)).slice(0, MAX_ENRICH_PATHS);

    if (!linkedinUrl) {
      await mapPool(paths, 3, async (path) => {
        if (linkedinUrl) return;

        const { contacts: parsed } = await scrapeContactsFromUrl(path, domain, FAST_FETCH, {
          companyName: input.companyName,
        });
        const match = parsed.find((person) => personNamesMatch(person.fullName, input.fullName));
        if (!match) return;

        const found =
          sanitizePersonLinkedInUrl(match.linkedinUrl) ??
          sanitizePersonLinkedInForContact(
            match.linkedinUrl,
            input.fullName,
            input.companyName
          );
        if (found) {
          linkedinUrl = found;
          linkedInSource = "website";
        }
      });
    }
  }

  return {
    email: null,
    emailSource: null,
    emailIsGuessed: false,
    linkedinUrl,
    linkedInSource,
    phone: null,
    phoneSource: null,
    socialProfiles: null,
    contactPageUrl,
    resolvedFullName,
  };
}

export function shouldUsePdlEnrichment(): boolean {
  // Person contact details (email / phone / LinkedIn) are scraped from the
  // company's own site and directory pages by default. People Data Labs is used
  // ONLY when explicitly opted into via CONTACT_DISCOVERY_PROVIDER=pdl and paid
  // APIs are not disabled.
  const provider = process.env.CONTACT_DISCOVERY_PROVIDER?.toLowerCase();
  const optedIntoPdl =
    provider === "pdl" ||
    provider === "people-data-labs" ||
    provider === "peopledatalabs";
  return optedIntoPdl && isPeopleDataLabsConfigured() && !isPaidApisDisabled();
}

const EMPTY_WEB_DETAILS: PartialContactDetails = {
  email: null,
  emailSource: null,
  emailIsGuessed: false,
  linkedinUrl: null,
  linkedInSource: null,
  phone: null,
  phoneSource: null,
  socialProfiles: null,
  contactPageUrl: null,
};

/** Resolve contact details: verified emails from website/PDL, plus LinkedIn profile. */
export async function enrichContactDetailsFromWebsite(
  input: LeadEnrichmentInput
): Promise<EnrichedContactDetails> {
  const pdl = shouldUsePdlEnrichment()
    ? await enrichPersonFromPeopleDataLabs({
        pdlId: input.providerContactId,
        fullName: input.fullName,
        companyName: input.companyName,
        companyDomain: input.companyDomain,
        linkedinUrl: input.linkedinUrl,
      })
    : null;

  const [pdlEmail, pdlLinkedIn] = await Promise.all([
    enrichEmailFromPdl(input, pdl),
    enrichLinkedInFromPdl(input, pdl),
  ]);

  const apiEmailPick = pickBestEmailFromSources(EMPTY_WEB_DETAILS, pdlEmail);
  const apiLinkedInPick = pickBestLinkedInFromSources(EMPTY_WEB_DETAILS, pdlLinkedIn);

  const needsEmail = !apiEmailPick.email;
  const needsLinkedIn = !apiLinkedInPick.linkedinUrl;

  let webEmail = EMPTY_WEB_DETAILS;
  let webLinkedIn = EMPTY_WEB_DETAILS;

  if (needsEmail && needsLinkedIn) {
    [webEmail, webLinkedIn] = await Promise.all([
      enrichEmailFromWebScraping(input),
      enrichLinkedInFromWebScraping(input),
    ]);
  } else if (needsEmail) {
    webEmail = await enrichEmailFromWebScraping(input);
  } else if (needsLinkedIn) {
    webLinkedIn = await enrichLinkedInFromWebScraping(input);
  } else {
    const domain = resolveCompanyDomain(input);
    if (domain) {
      webLinkedIn = {
        ...EMPTY_WEB_DETAILS,
        contactPageUrl: await resolveContactPageUrl(domain),
      };
    }
  }

  const emailPick = pickBestEmailFromSources(webEmail, pdlEmail);
  const verifiedEmail = await keepOnlyVerifiedEmail(
    input.id,
    input.fullName,
    emailPick.email,
    emailPick.emailSource
  );
  const linkedInPick = pickBestLinkedInFromSources(webLinkedIn, pdlLinkedIn);

  // Step 2 discovery already read the person's card, so its phone/socials are the
  // primary source here; the enrichment scrape only fills what discovery missed.
  const phone = sanitizePersonPhone(input.phone) ?? webEmail.phone ?? webLinkedIn.phone;
  const socialProfiles = mergeSocialProfiles(
    input.socialProfiles,
    mergeSocialProfiles(webEmail.socialProfiles, webLinkedIn.socialProfiles)
  );

  const result = finalizeDetails(input, {
    email: verifiedEmail.email,
    emailSource: verifiedEmail.emailSource,
    emailIsGuessed: false,
    ...linkedInPick,
    phone,
    phoneSource: phone ? (input.phone ? "website" : (webEmail.phoneSource ?? "website")) : null,
    socialProfiles: hasAnySocialProfile(socialProfiles) ? socialProfiles : null,
    contactPageUrl: webEmail.contactPageUrl ?? webLinkedIn.contactPageUrl,
  });

  if (result.email || result.linkedinUrl || result.phone || result.contactPageUrl) {
    log.info("Contact details enriched", {
      name: input.fullName,
      hasEmail: Boolean(result.email),
      hasLinkedIn: Boolean(result.linkedinUrl),
      hasPhone: Boolean(result.phone),
      hasSocial: hasAnySocialProfile(result.socialProfiles),
      emailSource: result.emailSource,
      linkedInSource: result.linkedInSource,
    });
  }

  return result;
}
