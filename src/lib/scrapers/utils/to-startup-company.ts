/**
 * Map a scraped directory profile onto the global startup catalog
 * (`startup_companies` + `startup_people`, migrations 033/034).
 *
 * This is the counterpart to {@link toDiscoveredCompany}, which produces the
 * PER-USER lead record. The catalog is global reference data: one row per
 * company regardless of which user's job discovered it, written with the
 * service role, read by every search.
 *
 * The dedup key is deliberately computed by running the profile through
 * `toDiscoveredCompany` + `getCompanyDedupKey` rather than reimplementing the
 * rule here. The catalog and the per-user `companies` table must agree on
 * identity — if the two drifted, the same company would key differently in each
 * and cross-referencing them would silently fail.
 */
import { getCompanyDedupKey } from "@/lib/company-discovery/apply-dedup";
import type { ScrapedCompanyProfile, ScraperFounder } from "@/lib/scrapers/types";
import { toDiscoveredCompany } from "@/lib/scrapers/utils/to-discovered-company";
import type { Json } from "@/types/database";
import type { StartupCompanyInsert, StartupPersonInsert } from "@/types/startup-db";

/** A person row before it can be linked — `startup_id` is assigned on insert. */
export type StartupPersonDraft = Omit<
  StartupPersonInsert,
  "startup_id" | "created_at" | "updated_at"
>;

export interface StartupCatalogRecord {
  dedupKey: string;
  company: Omit<StartupCompanyInsert, "id" | "first_seen_at" | "created_at">;
  people: StartupPersonDraft[];
}

/**
 * Normalized role bucket, so a search for "founders" matches across the wildly
 * inconsistent titles directories publish ("Co-founder & CTO", "Founding CEO").
 * Ordered most- to least-specific: "Founder & CEO" resolves to `ceo`, since the
 * executive role is the more useful targeting signal.
 */
const ROLE_PATTERNS: Array<[RegExp, string]> = [
  [/\bceo\b|chief executive/i, "ceo"],
  [/\bcto\b|chief technology|chief technical/i, "cto"],
  [/\bcfo\b|chief financial/i, "cfo"],
  [/\bcmo\b|chief marketing/i, "cmo"],
  [/\bcoo\b|chief operating/i, "coo"],
  [/\bfounder\b|\bco-?founder\b/i, "founder"],
  [/\bchief\b|\bpresident\b|\bvp\b|\bhead of\b|\bdirector\b/i, "exec"],
];

export function roleTypeFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  for (const [pattern, role] of ROLE_PATTERNS) {
    if (pattern.test(title)) return role;
  }
  return null;
}

/** Collapse whitespace; return null for anything blank. */
function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Split a display name into first/last. Deliberately naive — it takes the first
 * token as the given name and the remainder as the family name, which is right
 * for the overwhelming majority of directory listings and wrong in ways that
 * cost nothing here (both parts are convenience columns; `full_name` is the
 * value everything actually keys on).
 */
function splitName(fullName: string): { first: string | null; last: string | null } {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0] ?? null, last: null };
  return { first: parts[0] ?? null, last: parts.slice(1).join(" ") };
}

/** Per-company person dedup key: the normalized name. */
function personDedupKey(fullName: string): string {
  return fullName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toPersonDraft(
  founder: ScraperFounder,
  profile: ScrapedCompanyProfile
): StartupPersonDraft | null {
  const fullName = clean(founder.name);
  if (!fullName) return null;

  const { first, last } = splitName(fullName);
  return {
    dedup_key: personDedupKey(fullName),
    full_name: fullName,
    first_name: first,
    last_name: last,
    title: clean(founder.title),
    role_type: roleTypeFromTitle(founder.title) ?? "founder",
    linkedin_url: clean(founder.linkedinUrl),
    // Directories do not publish founder inboxes; enrichment fills this later.
    email: null,
    source: profile.source,
    twitter_url: clean(founder.twitterUrl),
    bio: clean(founder.bio),
    avatar_url: clean(founder.avatarUrl),
    source_url: profile.sourceUrl,
  };
}

/**
 * Build the catalog record for one scraped profile.
 *
 * Returns null when the profile has neither a resolvable domain nor a name to
 * key on — such a row could not be deduped and would accumulate a duplicate on
 * every scrape.
 */
export function toStartupCatalogRecord(
  profile: ScrapedCompanyProfile
): StartupCatalogRecord | null {
  const dedupKey = getCompanyDedupKey(toDiscoveredCompany(profile));
  if (!dedupKey) return null;

  const emails = (profile.publicEmails ?? []).map(clean).filter((v): v is string => v !== null);
  const phones = (profile.publicPhones ?? []).map(clean).filter((v): v is string => v !== null);

  // `publicEmail` is the primary; make sure it also appears in the array so a
  // reader querying either column sees a consistent picture.
  const primaryEmail = clean(profile.publicEmail) ?? emails[0] ?? null;
  const primaryPhone = clean(profile.publicPhone) ?? phones[0] ?? null;
  const allEmails = [...new Set([primaryEmail, ...emails].filter((v): v is string => v !== null))];
  const allPhones = [...new Set([primaryPhone, ...phones].filter((v): v is string => v !== null))];

  const people = profile.founders
    .map((founder) => toPersonDraft(founder, profile))
    .filter((person): person is StartupPersonDraft => person !== null);

  // Collapse founders that repeat under different titles on the same listing.
  const peopleByKey = new Map(people.map((person) => [person.dedup_key, person]));

  const now = new Date().toISOString();

  return {
    dedupKey,
    company: {
      dedup_key: dedupKey,
      source: profile.source,
      source_url: profile.sourceUrl,
      source_company_id: profile.sourceCompanyId,

      name: profile.name,
      domain: profile.domain,
      website_url: profile.websiteUrl,
      description: profile.description,
      industry: profile.industry,
      category: profile.category,
      tags: profile.tags ?? [],
      country: profile.country,
      city: profile.city,
      state: profile.state,

      funding_stage: profile.fundingStage,
      investors: profile.investors ?? [],
      team_size: profile.teamSize,
      launch_date: profile.launchDate,

      public_email: primaryEmail,
      public_phone: primaryPhone,
      public_emails: allEmails,
      public_phones: allPhones,
      contact_page_url: profile.contactPageUrl,
      careers_page_url: profile.careersPageUrl,

      linkedin_url: profile.socialLinks.linkedin ?? null,
      twitter_url: profile.socialLinks.twitter ?? null,
      github_url: profile.socialLinks.github ?? null,
      facebook_url: profile.socialLinks.facebook ?? null,
      crunchbase_url: profile.socialLinks.crunchbase ?? null,
      product_hunt_url: profile.socialLinks.productHunt ?? null,

      batch: profile.batch ?? null,
      portfolio_status: profile.portfolioStatus ?? null,
      founded_year: profile.foundedYear ?? null,
      total_funding: profile.totalFunding ?? null,
      logo_url: profile.logoUrl ?? null,

      website_extras: (profile.websiteExtras ?? {}) as Json,
      raw_profile: profile as unknown as Json,

      last_seen_at: now,
      scraped_at: profile.scrapedAt,
      updated_at: now,
    },
    people: [...peopleByKey.values()],
  };
}
