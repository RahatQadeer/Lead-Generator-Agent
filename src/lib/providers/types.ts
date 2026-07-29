/**
 * The provider layer: one contract for every external data source.
 *
 * The pipeline asks the registry for "the company providers" and iterates them.
 * It never names Apollo, Google Places, or a directory scraper, so adding a
 * source is a class plus a registry entry and nothing in the pipeline changes.
 *
 * Four kinds, split by the QUESTION each answers rather than by vendor — most
 * vendors answer more than one, and a vendor-shaped interface forces the
 * pipeline to know which:
 *
 *   company  — which companies match this search?
 *   people   — who are the decision makers at this company?
 *   contact  — how do I reach this person?
 *   funding  — what money has this company raised?
 *
 * People and contact are deliberately separate. `DiscoveredContact` merges them,
 * but discovering WHO works at a company (a team page, a directory listing) and
 * discovering HOW to reach them (an email pattern, a LinkedIn URL) have
 * different sources, different failure modes, and different costs. Fusing them
 * would mean a provider that knows names but not emails has nowhere to live.
 */
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";
import type { FundingStage } from "@/lib/scraping/funding-stage";
import type { PersonSocialProfiles } from "@/types/contact";

export type ProviderKind = "company" | "people" | "contact" | "funding";

/**
 * Cost tier. `paid` providers are gated by the free-stack policy
 * (DISABLE_PAID_APIS) and stay dormant unless explicitly enabled, so a
 * misconfigured deploy cannot silently start billing.
 */
export type ProviderTier = "free" | "paid";

export interface RateLimitPolicy {
  /** Sustained requests per second. */
  requestsPerSecond: number;
  /** Burst allowance above the sustained rate. Defaults to 1s worth. */
  burst?: number;
  /** Max calls in flight at once for this provider. */
  maxConcurrent?: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** Per-run context handed to every provider call. */
export interface ProviderContext {
  readonly jobId: string;
  readonly signal: AbortSignal;
  /** Coarse progress for the UI; providers report their own phase labels. */
  onProgress?: (event: {
    provider: string;
    phase: string;
    current?: number;
    total?: number;
  }) => void;
}

/** Shared by all four kinds. */
export interface Provider {
  readonly id: string;
  readonly displayName: string;
  readonly kind: ProviderKind;
  readonly tier: ProviderTier;

  /**
   * Whether this provider can run right now — credentials present, feature flag
   * on, quota not exhausted. The registry filters on this, so an unconfigured
   * provider is skipped rather than throwing mid-pipeline.
   *
   * Integration points that are designed but not yet implemented return false,
   * which is how they stay registered without affecting a run.
   */
  isConfigured(): boolean;

  /** Overrides the layer defaults in `./policy`. */
  readonly rateLimit?: RateLimitPolicy;
  readonly retry?: RetryPolicy;
}

// --- company -----------------------------------------------------------------

/** What a company provider is asked to find. */
export interface CompanyCriteria {
  industry?: string | null;
  /** Sub-vertical, e.g. "developer tools". */
  category?: string | null;
  countries?: string[];
  keywords?: string[];
  companySizeMin?: number | null;
  companySizeMax?: number | null;
  /** Typed rather than string[] so a typo cannot silently match nothing. */
  fundingStages?: FundingStage[];
  /** Only companies funded within this many months. */
  fundedWithinMonths?: number | null;
  /** Hard cap on companies to return. 0 = provider default. */
  limit?: number;
}

export interface CompanyProvider extends Provider {
  readonly kind: "company";
  /**
   * Yield matching companies as they are found. Streaming so the pipeline can
   * enrich early results while a slow source is still paging.
   */
  discover(
    criteria: CompanyCriteria,
    ctx: ProviderContext
  ): AsyncIterable<ScrapedCompanyProfile>;
}

// --- people ------------------------------------------------------------------

/** The company a people provider is searching within. */
export interface PeopleTarget {
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  websiteUrl: string | null;
  linkedinUrl?: string | null;
}

/** WHO — identity and role only. Reachability is a contact provider's job. */
export interface PersonRecord {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  /** Normalized ladder key from decision-maker-ladder (founder, ceo, cto, …). */
  roleKey: string | null;
  /** False when returned as a fallback because the requested title was absent. */
  titleMatched: boolean;
  /** 0–1. How sure the provider is this person works here in this role. */
  confidence: number;
  sourceUrl: string | null;
  /** Anything the provider already knows — saves a contact lookup. */
  linkedinUrl?: string | null;
}

export interface PeopleProvider extends Provider {
  readonly kind: "people";
  /**
   * Find people at `target` matching `roleKeys` (ladder keys, best first).
   * Returning fewer or lower-ranked people than asked for is expected — the
   * pipeline applies the fallback ladder across providers, not within one.
   */
  findPeople(
    target: PeopleTarget,
    roleKeys: readonly string[],
    ctx: ProviderContext
  ): Promise<PersonRecord[]>;
}

// --- contact -----------------------------------------------------------------

/** The person a contact provider is resolving channels for. */
export interface ContactTarget {
  fullName: string;
  title: string | null;
  companyName: string;
  companyDomain: string | null;
  websiteUrl: string | null;
  linkedinUrl?: string | null;
}

/** HOW to reach someone. Every field optional — partial answers are useful. */
export interface ContactChannels {
  email?: string | null;
  /** True when the email was inferred from a pattern rather than observed. */
  emailIsGuessed?: boolean;
  linkedinUrl?: string | null;
  phone?: string | null;
  socialProfiles?: PersonSocialProfiles | null;
  contactPageUrl?: string | null;
  /** 0–1 confidence in the channels returned. */
  confidence: number;
}

export interface ContactProvider extends Provider {
  readonly kind: "contact";
  /**
   * Resolve whatever channels this provider can. Returning `null` means "found
   * nothing" and is not an error — the pipeline tries the next layer.
   */
  findContacts(
    target: ContactTarget,
    ctx: ProviderContext
  ): Promise<ContactChannels | null>;
}

// --- funding -----------------------------------------------------------------

export interface FundingTarget {
  companyName: string;
  companyDomain: string | null;
  websiteUrl: string | null;
}

export interface FundingEvent {
  /** Round label as published ("Series A", "Seed"). */
  round: string | null;
  stage: string | null;
  /** As published — sources disagree on units and currency. */
  amount: string | null;
  currency: string | null;
  investors: string[];
  announcedOn: string | null;
  sourceUrl: string | null;
  confidence: number;
}

export interface FundingProvider extends Provider {
  readonly kind: "funding";
  findFunding(
    target: FundingTarget,
    ctx: ProviderContext
  ): Promise<FundingEvent[]>;
}

export type AnyProvider =
  | CompanyProvider
  | PeopleProvider
  | ContactProvider
  | FundingProvider;

/** Narrow a provider by kind — used by the registry's typed accessors. */
export function isKind<K extends ProviderKind>(
  provider: AnyProvider,
  kind: K
): provider is Extract<AnyProvider, { kind: K }> {
  return provider.kind === kind;
}
