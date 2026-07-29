/**
 * The Save phase.
 *
 * Reuses the existing persistence layer rather than writing new SQL:
 * `persistDiscoveredCompaniesForUser` upserts on (user_id, dedup_key) and
 * `upsertDiscoveredContacts` dedupes per search, so re-running a search UPDATES
 * the existing rows instead of duplicating them. That property is the whole
 * reason to go through these helpers instead of inserting directly.
 *
 * Ordering matters: companies must be persisted before people, because contacts
 * are keyed to the company's database id, which only exists after the upsert.
 * The ids are then resolved by domain (falling back to name) exactly the way
 * `persistDecisionMakers` already does it.
 */
import { getCompaniesBySearchId } from "@/lib/companies/queries";
import { persistDiscoveredCompaniesForUser } from "@/lib/companies/persist-admin";
import { upsertDiscoveredContacts } from "@/lib/contacts/queries";
import { createLogger } from "@/lib/logger";
import { normalizeDomain } from "@/lib/scrapers/utils/normalize";
import { toDiscoveredCompany } from "@/lib/scrapers/utils/to-discovered-company";
import type { PipelineCompany, PipelinePerson } from "@/lib/pipeline/run-pipeline";
import type { ProgressTracker } from "@/lib/pipeline/progress";
import type { DiscoveredCompany } from "@/types/company";
import type { DiscoveredContact } from "@/types/contact";

const log = createLogger("pipeline.save");

/** Provider label stored on every row so results carry source attribution. */
const PROVIDER = "provider-pipeline";

export interface SaveResultsInput {
  userId: string;
  searchId: string | null;
  companies: PipelineCompany[];
  tracker: ProgressTracker;
}

export interface SaveResultsOutput {
  companiesSaved: number;
  contactsSaved: number;
  /** Set when there was nowhere to save to (no search attached). */
  skippedReason?: string;
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: null };
  if (parts.length === 1) return { firstName: parts[0] as string, lastName: null };
  return { firstName: parts[0] as string, lastName: parts.slice(1).join(" ") };
}

/**
 * Fold the pipeline's findings back onto the DiscoveredCompany shape the
 * persistence layer expects, carrying source attribution and confidence.
 */
function toPersistableCompany(entry: PipelineCompany): DiscoveredCompany {
  const base = toDiscoveredCompany(entry.profile);
  return {
    ...base,
    // Pipeline confidence is 0–1; the column is 0–100.
    confidenceScore: Math.round(entry.confidence * 100),
  };
}

function toPersistableContact(
  slot: PipelinePerson,
  entry: PipelineCompany,
  companyDbId: string,
  index: number
): DiscoveredContact | null {
  const fullName = slot.person.fullName?.trim();
  if (!fullName) return null;

  const { firstName, lastName } = splitName(fullName);
  if (!firstName) return null;

  return {
    // Stable across re-runs so the upsert updates rather than inserts.
    id: `${companyDbId}:person:${fullName.toLowerCase().replace(/\s+/g, "-")}:${index}`,
    companyId: companyDbId,
    companyName: entry.profile.name,
    companyDomain: entry.profile.domain,
    firstName,
    lastName,
    fullName,
    title: slot.person.title ?? "",
    department: slot.person.department,
    email: slot.contact?.email ?? null,
    emailIsGuessed: slot.contact?.emailIsGuessed ?? false,
    linkedinUrl: slot.contact?.linkedinUrl ?? slot.person.linkedinUrl ?? null,
    phone: slot.contact?.phone ?? null,
    socialProfiles: slot.contact?.socialProfiles ?? null,
    // Blended identity + reachability score from the scoring phase.
    confidenceScore: Math.round(slot.confidence * 100),
    sourceUrl: slot.person.sourceUrl,
    discoverySource: "website_team",
    titleMatched: slot.person.titleMatched,
  };
}

/**
 * Persist companies, then the people and contact channels found for them.
 *
 * Deduplication has already run in the pipeline, so everything arriving here is
 * expected to be unique; the upserts are the second line of defence for repeat
 * runs rather than the primary dedup.
 */
export async function saveResults(input: SaveResultsInput): Promise<SaveResultsOutput> {
  const { userId, searchId, companies, tracker } = input;
  tracker.setPhase("saving");

  if (!searchId) {
    // A run with no search attached has nowhere user-scoped to save to. Not an
    // error — the caller may only want the returned results.
    tracker.setPhaseFraction(1);
    return { companiesSaved: 0, contactsSaved: 0, skippedReason: "no search attached" };
  }

  if (companies.length === 0) {
    tracker.setPhaseFraction(1);
    return { companiesSaved: 0, contactsSaved: 0 };
  }

  // --- companies ---
  const persistable = companies.map(toPersistableCompany);
  await persistDiscoveredCompaniesForUser(userId, searchId, PROVIDER, persistable);
  tracker.increment("saved", persistable.length);
  tracker.setPhaseFraction(0.5);

  // --- resolve database ids so contacts can reference their company ---
  const persisted = await getCompaniesBySearchId(userId, searchId);
  const idByDomain = new Map<string, string>();
  const idByName = new Map<string, string>();
  for (const row of persisted) {
    const domain = normalizeDomain(row.domain);
    if (domain) idByDomain.set(domain, row.id);
    idByName.set(row.name.trim().toLowerCase(), row.id);
  }

  // --- people + contact channels ---
  const contacts: DiscoveredContact[] = [];
  for (const entry of companies) {
    if (entry.people.length === 0) continue;

    const domain = normalizeDomain(entry.profile.domain);
    const dbId =
      (domain ? idByDomain.get(domain) : undefined) ??
      idByName.get(entry.profile.name.trim().toLowerCase());

    // Company was deduped away or rejected by the mapper — skip its people
    // rather than orphaning them against a missing foreign key.
    if (!dbId) continue;

    entry.people.forEach((slot, index) => {
      const contact = toPersistableContact(slot, entry, dbId, index);
      if (contact) contacts.push(contact);
    });
  }

  let contactsSaved = 0;
  if (contacts.length > 0) {
    const result = await upsertDiscoveredContacts(userId, searchId, PROVIDER, contacts);
    contactsSaved = result.savedCount;

    if (result.failedCount > 0) {
      tracker.recordError(
        `${result.failedCount} contacts could not be saved: ${result.errorMessage ?? "unknown"}`,
        PROVIDER
      );
    }
  }

  tracker.setPhaseFraction(1);

  log.info("Pipeline results saved", {
    searchId,
    companies: persistable.length,
    contacts: contactsSaved,
  });

  return { companiesSaved: persistable.length, contactsSaved };
}
