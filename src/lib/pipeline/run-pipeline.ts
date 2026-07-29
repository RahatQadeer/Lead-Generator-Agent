/**
 * The lead-generation pipeline.
 *
 *   Company Providers → Company Enrichment → People Providers →
 *   Contact Providers → Funding Providers → Deduplication →
 *   Confidence Scoring → Save
 *
 * Each phase is a private function with the same shape: take the run state, do
 * its work, report progress, return. Adding or reordering a phase is local to
 * `runPipeline`, and no phase knows which providers exist — it asks the registry.
 *
 * Failure policy: a provider that throws degrades the run, never fails it. The
 * error is recorded on the progress snapshot and the pipeline moves to the next
 * provider or the next item. Only an abort stops the run, because a stopped job
 * should stop.
 */
import { getCompanyDedupKey } from "@/lib/company-discovery/apply-dedup";
import { createLogger } from "@/lib/logger";
import { mapPool } from "@/lib/scraping/parallel-pool";
import { ProviderError } from "@/lib/providers/errors";
import { tryProvider } from "@/lib/providers/execute";
import {
  getCompanyProviders,
  getContactProviders,
  getFundingProviders,
  getPeopleProviders,
} from "@/lib/providers/registry";
import { bootstrapProviders } from "@/lib/providers";
import type {
  CompanyCriteria,
  ContactChannels,
  FundingEvent,
  PersonRecord,
  ProviderContext,
} from "@/lib/providers/types";
import { ProgressTracker, type PipelineProgressListener } from "@/lib/pipeline/progress";
import { enrichCompanyFromWebsite } from "@/lib/scraping/enrich-company";
import { toDiscoveredCompany } from "@/lib/scrapers/utils/to-discovered-company";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";
import type { DiscoveredCompany } from "@/types/company";

const log = createLogger("pipeline");

/** How many companies are processed at once in the per-company phases. */
const COMPANY_CONCURRENCY = 4;
/** How many people are resolved at once within one company. */
const PERSON_CONCURRENCY = 3;

export interface PipelineInput {
  jobId: string;
  userId: string;
  searchId: string | null;
  criteria: CompanyCriteria;
  /** Ladder keys, best first. Empty means "best available decision maker". */
  roleKeys: string[];
  /** Restrict to these provider ids. Empty means every enabled provider. */
  providerIds?: string[];
  /**
   * Visit each company's own website to fill gaps the directory left.
   * Defaults to true. Turning it off roughly halves a run's wall-clock at the
   * cost of thinner records, and is what tests use to stay offline.
   */
  enrichCompanies?: boolean;
  /** Dedup keys already known for this user, so re-runs do not re-save. */
  knownDedupKeys?: ReadonlySet<string>;
  signal: AbortSignal;
  onProgress?: PipelineProgressListener;
}

/** One company plus everything the pipeline learned about it. */
export interface PipelineCompany {
  profile: ScrapedCompanyProfile;
  dedupKey: string | null;
  people: PipelinePerson[];
  funding: FundingEvent[];
  /** 0–1, set by the scoring phase. */
  confidence: number;
}

export interface PipelinePerson {
  person: PersonRecord;
  contact: ContactChannels | null;
  confidence: number;
}

export interface PipelineResult {
  companies: PipelineCompany[];
  duplicatesRemoved: number;
  /** Provider ids that failed at least once. */
  degradedProviders: string[];
}

function providerCtx(input: PipelineInput, tracker: ProgressTracker): ProviderContext {
  return {
    jobId: input.jobId,
    signal: input.signal,
    onProgress: (event) => {
      tracker.setProvider(event.provider);
    },
  };
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new ProviderError({
      provider: "pipeline",
      code: "ABORTED",
      message: "Run stopped",
    });
  }
}

// --- phase 1: company discovery ----------------------------------------------

async function discoverCompanies(
  input: PipelineInput,
  tracker: ProgressTracker,
  degraded: Set<string>
): Promise<PipelineCompany[]> {
  tracker.setPhase("company_discovery");

  const all = getCompanyProviders();
  const providers = input.providerIds?.length
    ? all.filter((p) => input.providerIds!.includes(p.id))
    : all;

  if (providers.length === 0) {
    tracker.recordError("No company providers are enabled", null);
    return [];
  }

  const target = input.criteria.limit ?? 0;
  const out: PipelineCompany[] = [];
  const seen = new Set<string>();

  for (const [index, provider] of providers.entries()) {
    throwIfAborted(input.signal);
    if (target > 0 && out.length >= target) break;

    tracker.setProvider(provider.id);

    try {
      const remaining = target > 0 ? target - out.length : 0;
      const stream = provider.discover(
        { ...input.criteria, limit: remaining },
        providerCtx(input, tracker)
      );

      for await (const profile of stream) {
        throwIfAborted(input.signal);

        // Dedup as we stream. Holding every profile and deduping at the end
        // would enrich the same company once per source that lists it — the
        // common case for a startup in several VC portfolios.
        const key = dedupKeyForProfile(profile);
        if (key && seen.has(key)) {
          tracker.increment("duplicatesRemoved");
          continue;
        }
        if (key) seen.add(key);

        out.push({ profile, dedupKey: key, people: [], funding: [], confidence: 0 });
        tracker.setCompany(profile.name);
        tracker.increment("companiesFound");

        if (target > 0) tracker.setPhaseStep(out.length, target);
        if (target > 0 && out.length >= target) break;
      }
    } catch (error) {
      if (error instanceof ProviderError && error.code === "ABORTED") throw error;
      degraded.add(provider.id);
      tracker.recordError(
        error instanceof Error ? error.message : String(error),
        provider.id
      );
      log.warn("Company provider failed", { provider: provider.id, error: String(error) });
    }

    if (target === 0) tracker.setPhaseStep(index + 1, providers.length);
  }

  return out;
}

function dedupKeyForProfile(profile: ScrapedCompanyProfile): string | null {
  // Reuse the app-wide identity rule, via the same mapper the rest of the app
  // uses, so the pipeline, the per-user companies table and the startup catalog
  // all agree on what "the same company" means. Building a partial object and
  // casting would compile but silently diverge the moment that rule changes.
  return getCompanyDedupKey(toDiscoveredCompany(profile));
}

// --- phase 2: company enrichment ---------------------------------------------

async function enrichCompanies(
  input: PipelineInput,
  tracker: ProgressTracker,
  companies: PipelineCompany[]
): Promise<void> {
  tracker.setPhase("company_enrichment", "website");
  if (companies.length === 0) return;

  if (input.enrichCompanies === false) {
    tracker.setPhaseFraction(1);
    return;
  }

  let done = 0;

  await mapPool(companies, COMPANY_CONCURRENCY, async (entry) => {
    throwIfAborted(input.signal);
    const domain = entry.profile.domain;

    if (domain) {
      try {
        tracker.setCompany(entry.profile.name);
        // The enricher speaks DiscoveredCompany, so round-trip through the
        // existing mapper rather than duplicating its field logic here.
        const enriched = await enrichCompanyFromWebsite(
          toDiscoveredCompany(entry.profile),
          input.criteria.industry ?? ""
        );
        if (enriched) {
          entry.profile = mergeCompanyEnrichment(entry.profile, enriched);
          tracker.increment("companiesEnriched");
        }
      } catch (error) {
        // Enrichment is additive — a failure leaves the directory data intact.
        tracker.recordError(
          `Enrichment failed for ${entry.profile.name}: ${String(error)}`,
          "website"
        );
      }
    }

    done += 1;
    tracker.setPhaseStep(done, companies.length);
  });
}

/**
 * Only fill gaps: a directory's own data is first-party and beats anything
 * inferred from scraping the company's marketing site. YC saying a company is in
 * "Fintech" outranks a homepage that talks about "the future of money".
 */
function mergeCompanyEnrichment(
  profile: ScrapedCompanyProfile,
  enriched: DiscoveredCompany
): ScrapedCompanyProfile {
  return {
    ...profile,
    description: profile.description ?? enriched.description ?? null,
    industry: profile.industry ?? enriched.industry ?? null,
    country: profile.country ?? enriched.country ?? null,
    city: profile.city ?? enriched.city ?? null,
    state: profile.state ?? enriched.state ?? null,
    websiteUrl: profile.websiteUrl ?? enriched.websiteUrl ?? null,
    teamSize: profile.teamSize ?? enriched.employeeCount ?? null,
    socialLinks: {
      ...profile.socialLinks,
      linkedin: profile.socialLinks?.linkedin ?? enriched.linkedinUrl ?? null,
    },
    websiteExtras: {
      ...profile.websiteExtras,
      ...(enriched.technologies?.length ? { technologies: enriched.technologies } : {}),
    },
  };
}

// --- phase 3: people discovery ------------------------------------------------

async function discoverPeople(
  input: PipelineInput,
  tracker: ProgressTracker,
  companies: PipelineCompany[],
  degraded: Set<string>
): Promise<void> {
  tracker.setPhase("people_discovery");
  const providers = getPeopleProviders();

  if (providers.length === 0) {
    tracker.recordError("No people providers are enabled", null);
    return;
  }

  let done = 0;

  await mapPool(companies, COMPANY_CONCURRENCY, async (entry) => {
    throwIfAborted(input.signal);
    tracker.setCompany(entry.profile.name);

    const target = {
      companyId: entry.dedupKey ?? entry.profile.name,
      companyName: entry.profile.name,
      companyDomain: entry.profile.domain,
      websiteUrl: entry.profile.websiteUrl,
      linkedinUrl: entry.profile.socialLinks?.linkedin ?? null,
    };

    // Providers run in priority order and STOP at the first that returns an
    // exact-title match. Running them all would multiply cost for duplicates of
    // the same person; falling through only on a miss is the point of ordering.
    for (const provider of providers) {
      throwIfAborted(input.signal);
      tracker.setProvider(provider.id);

      const people = await tryProvider(
        provider,
        { operation: "findPeople", jobId: input.jobId, signal: input.signal },
        () => provider.findPeople(target, input.roleKeys, providerCtx(input, tracker)),
        [] as PersonRecord[]
      ).catch((error) => {
        if (error instanceof ProviderError && error.code === "ABORTED") throw error;
        degraded.add(provider.id);
        return [] as PersonRecord[];
      });

      if (people.length === 0) continue;

      entry.people = people.map((person) => ({ person, contact: null, confidence: 0 }));
      tracker.increment("peopleFound", people.length);

      if (people.some((p) => p.titleMatched)) break;
      // Only fallback people so far — keep trying lower-priority providers in
      // case one of them has the requested role.
    }

    // Directory listings often already carry founders. Fold them in when the
    // providers found nothing, so a company is never left with no decision maker
    // when the source told us who the founders are.
    if (entry.people.length === 0 && entry.profile.founders.length > 0) {
      entry.people = entry.profile.founders.map((founder) => ({
        person: {
          fullName: founder.name,
          firstName: null,
          lastName: null,
          title: founder.title ?? "Founder",
          department: null,
          roleKey: "founder",
          titleMatched: input.roleKeys.length === 0 || input.roleKeys.includes("founder"),
          confidence: 0.6,
          sourceUrl: entry.profile.sourceUrl,
          linkedinUrl: founder.linkedinUrl ?? null,
        },
        contact: null,
        confidence: 0,
      }));
      tracker.increment("peopleFound", entry.people.length);
    }

    done += 1;
    tracker.setPhaseStep(done, companies.length);
  });
}

// --- phase 4: contact discovery -----------------------------------------------

async function discoverContacts(
  input: PipelineInput,
  tracker: ProgressTracker,
  companies: PipelineCompany[],
  degraded: Set<string>
): Promise<void> {
  tracker.setPhase("contact_discovery");
  const providers = getContactProviders();

  if (providers.length === 0) {
    tracker.recordError("No contact providers are enabled", null);
    return;
  }

  const totalPeople = companies.reduce((sum, c) => sum + c.people.length, 0);
  if (totalPeople === 0) return;

  let done = 0;

  await mapPool(companies, COMPANY_CONCURRENCY, async (entry) => {
    throwIfAborted(input.signal);
    tracker.setCompany(entry.profile.name);

    await mapPool(entry.people, PERSON_CONCURRENCY, async (slot) => {
      throwIfAborted(input.signal);

      const target = {
        fullName: slot.person.fullName,
        title: slot.person.title,
        companyName: entry.profile.name,
        companyDomain: entry.profile.domain,
        websiteUrl: entry.profile.websiteUrl,
        linkedinUrl: slot.person.linkedinUrl ?? null,
      };

      // Layered: every provider is tried in priority order and results are
      // MERGED, not replaced. A provider that only knows a phone number still
      // contributes when an earlier one supplied the email.
      for (const provider of providers) {
        throwIfAborted(input.signal);
        tracker.setProvider(provider.id);

        const channels = await tryProvider(
          provider,
          { operation: "findContacts", jobId: input.jobId, signal: input.signal },
          () => provider.findContacts(target, providerCtx(input, tracker)),
          null
        ).catch((error) => {
          if (error instanceof ProviderError && error.code === "ABORTED") throw error;
          degraded.add(provider.id);
          return null;
        });

        if (channels) slot.contact = mergeChannels(slot.contact, channels);
        if (isContactComplete(slot.contact)) break;
      }

      if (slot.contact) tracker.increment("contactsFound");

      done += 1;
      tracker.setPhaseStep(done, totalPeople);
    });
  });
}

/** Prefer what we already have; only fill gaps, and never downgrade an
 *  observed email to a guessed one. */
function mergeChannels(
  existing: ContactChannels | null,
  incoming: ContactChannels
): ContactChannels {
  if (!existing) return incoming;

  const preferIncomingEmail =
    !existing.email || (existing.emailIsGuessed === true && incoming.emailIsGuessed !== true);

  return {
    email: preferIncomingEmail ? (incoming.email ?? existing.email) : existing.email,
    emailIsGuessed: preferIncomingEmail
      ? (incoming.emailIsGuessed ?? false)
      : existing.emailIsGuessed,
    linkedinUrl: existing.linkedinUrl ?? incoming.linkedinUrl ?? null,
    phone: existing.phone ?? incoming.phone ?? null,
    socialProfiles: existing.socialProfiles ?? incoming.socialProfiles ?? null,
    contactPageUrl: existing.contactPageUrl ?? incoming.contactPageUrl ?? null,
    confidence: Math.max(existing.confidence, incoming.confidence),
  };
}

/** Enough to act on — stop paying other providers for the same person. */
function isContactComplete(channels: ContactChannels | null): boolean {
  if (!channels) return false;
  return Boolean(channels.email && !channels.emailIsGuessed && channels.linkedinUrl);
}

// --- phase 5: funding ----------------------------------------------------------

async function discoverFunding(
  input: PipelineInput,
  tracker: ProgressTracker,
  companies: PipelineCompany[],
  degraded: Set<string>
): Promise<void> {
  tracker.setPhase("funding_discovery");
  const providers = getFundingProviders();

  // No funding provider is registered yet. The phase is a no-op rather than an
  // error so the contract stays live for when one lands.
  if (providers.length === 0 || companies.length === 0) return;

  let done = 0;

  await mapPool(companies, COMPANY_CONCURRENCY, async (entry) => {
    throwIfAborted(input.signal);
    tracker.setCompany(entry.profile.name);

    for (const provider of providers) {
      tracker.setProvider(provider.id);
      const events = await tryProvider(
        provider,
        { operation: "findFunding", jobId: input.jobId, signal: input.signal },
        () =>
          provider.findFunding(
            {
              companyName: entry.profile.name,
              companyDomain: entry.profile.domain,
              websiteUrl: entry.profile.websiteUrl,
            },
            providerCtx(input, tracker)
          ),
        [] as FundingEvent[]
      ).catch((error) => {
        if (error instanceof ProviderError && error.code === "ABORTED") throw error;
        degraded.add(provider.id);
        return [] as FundingEvent[];
      });

      if (events.length > 0) {
        entry.funding = events;
        tracker.increment("fundingEventsFound", events.length);
        break;
      }
    }

    done += 1;
    tracker.setPhaseStep(done, companies.length);
  });
}

// --- phase 6: deduplication ----------------------------------------------------

function deduplicate(
  input: PipelineInput,
  tracker: ProgressTracker,
  companies: PipelineCompany[]
): PipelineCompany[] {
  tracker.setPhase("deduplication");

  const known = input.knownDedupKeys ?? new Set<string>();
  const seen = new Set<string>();
  const kept: PipelineCompany[] = [];

  for (const entry of companies) {
    // A company with no dedup key cannot be identified across runs; keep it
    // rather than dropping it, and let the per-user save decide.
    if (entry.dedupKey && (seen.has(entry.dedupKey) || known.has(entry.dedupKey))) {
      tracker.increment("duplicatesRemoved");
      continue;
    }
    if (entry.dedupKey) seen.add(entry.dedupKey);

    // People within a company: same person can come from two providers.
    const peopleSeen = new Set<string>();
    entry.people = entry.people.filter((slot) => {
      const key = slot.person.fullName.trim().toLowerCase();
      if (!key || peopleSeen.has(key)) return false;
      peopleSeen.add(key);
      return true;
    });

    kept.push(entry);
  }

  tracker.setPhaseFraction(1);
  return kept;
}

// --- phase 7: confidence scoring ------------------------------------------------

function scoreConfidence(
  tracker: ProgressTracker,
  companies: PipelineCompany[]
): void {
  tracker.setPhase("scoring");

  for (const entry of companies) {
    for (const slot of entry.people) {
      slot.confidence = personConfidence(slot);
    }
    // A company is only as good as its best reachable decision maker.
    entry.confidence = entry.people.length
      ? Math.max(...entry.people.map((p) => p.confidence))
      : 0;
  }

  tracker.setPhaseFraction(1);
}

/**
 * Blend identity confidence with reachability.
 *
 * A perfectly identified CEO with no way to contact them is not a usable lead,
 * and a verified email attached to a name we are unsure about is worse — so
 * neither term alone can carry the score.
 */
function personConfidence(slot: PipelinePerson): number {
  const identity = slot.person.confidence * (slot.person.titleMatched ? 1 : 0.7);
  const contact = slot.contact?.confidence ?? 0;
  const verifiedEmail = slot.contact?.email && !slot.contact.emailIsGuessed ? 0.15 : 0;

  return Math.min(1, identity * 0.5 + contact * 0.35 + verifiedEmail + (slot.contact?.linkedinUrl ? 0.1 : 0));
}

// --- orchestrator ----------------------------------------------------------------

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  bootstrapProviders();

  const tracker = new ProgressTracker(input.jobId, input.onProgress);
  const degraded = new Set<string>();

  try {
    tracker.setPhase("starting");

    let companies = await discoverCompanies(input, tracker, degraded);
    await enrichCompanies(input, tracker, companies);
    await discoverPeople(input, tracker, companies, degraded);
    await discoverContacts(input, tracker, companies, degraded);
    await discoverFunding(input, tracker, companies, degraded);

    companies = deduplicate(input, tracker, companies);
    scoreConfidence(tracker, companies);

    const duplicatesRemoved = tracker.snapshot().counts.duplicatesRemoved;
    tracker.finish("completed");

    return {
      companies,
      duplicatesRemoved,
      degradedProviders: [...degraded],
    };
  } catch (error) {
    const aborted = error instanceof ProviderError && error.code === "ABORTED";
    tracker.finish(aborted ? "stopped" : "failed");
    if (!aborted) {
      tracker.recordError(error instanceof Error ? error.message : String(error));
      log.error("Pipeline failed", { jobId: input.jobId, error: String(error) });
    }
    throw error;
  }
}
