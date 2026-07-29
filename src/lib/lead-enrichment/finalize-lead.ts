import type { EnrichedLead, OutreachChannel } from "@/types/lead";
import {
  isPlausiblePersonName,
  pickPersonalContactEmail,
  sanitizeLinkedInForLead,
} from "@/lib/scraping/data-quality";
import {
  hasAnySocialProfile,
  sanitizePersonPhone,
} from "@/lib/scraping/person-contact-channels";

function resolvePersonalEmail(lead: EnrichedLead): {
  email: string | null;
  emailIsGuessed: boolean;
} {
  if (!lead.email?.trim()) return { email: null, emailIsGuessed: false };

  if (lead.emailSource === "found") {
    return pickPersonalContactEmail(lead.name, lead.email);
  }

  return { email: null, emailIsGuessed: false };
}

/**
 * Keep leads reachable on any name-matched channel: personal email, LinkedIn,
 * direct phone, a personal social profile, or a contact page.
 *
 * Phone and socials arrive already identity-gated (a `tel:` in the person's own card,
 * a handle matching their name), so reaching here means they belong to this person.
 */
export function finalizeEnrichedLead(lead: EnrichedLead): EnrichedLead | null {
  if (!isPlausiblePersonName(lead.name)) return null;

  const linkedin = sanitizeLinkedInForLead(
    lead.linkedin,
    lead.name,
    lead.company,
    lead.linkedInSource
  );
  const hasLinkedIn = Boolean(linkedin);
  const personalEmail = resolvePersonalEmail(lead);
  const hasPersonalEmail = Boolean(personalEmail.email);
  const phone = sanitizePersonPhone(lead.phone);
  const hasPhone = Boolean(phone);
  const socialProfiles = hasAnySocialProfile(lead.socialProfiles) ? lead.socialProfiles : null;
  const hasSocial = Boolean(socialProfiles);
  const hasContactPage =
    lead.contactDetailType === "contact_page_only" && Boolean(lead.contactPageUrl?.trim());

  if (!hasPersonalEmail && !hasLinkedIn && !hasPhone && !hasSocial && !hasContactPage) {
    return null;
  }

  const outreachChannel: OutreachChannel | null = hasPersonalEmail
    ? "email"
    : hasLinkedIn
      ? "linkedin"
      : hasPhone
        ? "phone"
        : hasSocial
          ? "social"
          : null;

  let contactDetailType = lead.contactDetailType;
  if (hasPersonalEmail) {
    contactDetailType = lead.contactDetailType;
  } else if (hasLinkedIn) {
    contactDetailType = "linkedin_only";
  } else if (hasPhone) {
    contactDetailType = "phone_only";
  } else if (hasSocial) {
    contactDetailType = "social_only";
  }

  return {
    ...lead,
    linkedin: hasLinkedIn ? linkedin : null,
    linkedInSource: hasLinkedIn ? lead.linkedInSource : null,
    email: hasPersonalEmail ? personalEmail.email : null,
    emailSource: hasPersonalEmail ? "found" : null,
    emailIsGuessed: false,
    phone,
    phoneSource: hasPhone ? (lead.phoneSource ?? "website") : null,
    socialProfiles,
    contactDetailType,
    outreachChannel,
  };
}

/** One personal email per company — later contacts keep LinkedIn only. */
function dedupeCompanyEmails(leads: EnrichedLead[]): EnrichedLead[] {
  const seen = new Map<string, string>();

  return leads.map((lead) => {
    if (!lead.email?.trim()) return lead;

    const key = `${lead.companyId}|${lead.email.trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, lead.id);
      return lead;
    }

    const hasLinkedIn = Boolean(lead.linkedin);
    const hasPhone = Boolean(lead.phone);
    const hasSocial = hasAnySocialProfile(lead.socialProfiles);
    const hasContactPage =
      lead.contactDetailType === "contact_page_only" && Boolean(lead.contactPageUrl?.trim());

    return {
      ...lead,
      email: null,
      emailSource: null,
      emailIsGuessed: false,
      contactDetailType: hasLinkedIn
        ? "linkedin_only"
        : hasPhone
          ? "phone_only"
          : hasSocial
            ? "social_only"
            : hasContactPage
              ? "contact_page_only"
              : null,
      outreachChannel: hasLinkedIn
        ? ("linkedin" as const)
        : hasPhone
          ? ("phone" as const)
          : hasSocial
            ? ("social" as const)
            : null,
    };
  });
}

export function partitionEnrichedLeads(leads: EnrichedLead[]): {
  kept: EnrichedLead[];
  discardedIds: string[];
} {
  const kept: EnrichedLead[] = [];
  const discardedIds: string[] = [];

  for (const lead of leads) {
    const finalized = finalizeEnrichedLead(lead);
    if (finalized) {
      kept.push(finalized);
    } else {
      discardedIds.push(lead.id);
    }
  }

  return { kept: dedupeCompanyEmails(kept), discardedIds };
}

/** After email verification succeeds, upgrade contact detail classification. */
export function withVerifiedEmailDetailType(lead: EnrichedLead): EnrichedLead {
  if (lead.email && lead.emailVerificationStatus === "valid") {
    return { ...lead, contactDetailType: "verified_email" };
  }
  return lead;
}
