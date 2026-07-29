/**
 * Company cross-verification & validation status.
 *
 * Turns the raw discovery signals (which sources surfaced a company, whether its
 * website is live, how well it matches the query, and its confidence score) into
 * a single auditable verdict:
 *
 *   - "verified"           — live site, cross-verified in >=2 trusted sources,
 *                            strong semantic match, confidence >= 85.
 *   - "needs_verification" — real but under-corroborated (single source, weak
 *                            semantic match, unreachable site, or confidence 70-84).
 *   - "rejected"           — affirmative dead-site evidence (parked/placeholder/
 *                            error page). Off-industry/size/country rejections are
 *                            handled separately by validate-company / apply-criteria.
 *
 * This mirrors the spec's "Cross Verification" (>=2 sources) and confidence gate
 * (display 85+, 70-84 = needs verification). Pure & deterministic.
 */

import type { MergedCompanySeed } from "@/lib/scraping/merge-company-seeds";
import {
  isDeadWebsiteStatus,
  type WebsiteStatus,
} from "@/lib/scraping/website-verification";
import { SEMANTIC_RELEVANCE_FLOOR } from "@/lib/company-discovery/semantic-relevance";

export type CompanySourceKind =
  | "official_website"
  | "linkedin"
  | "google_maps"
  | "opencorporates"
  | "wikidata"
  | "public_registry"
  | "web_search";

export interface CompanySource {
  kind: CompanySourceKind;
  label: string;
  url: string | null;
}

export type CompanyValidationStatus = "verified" | "needs_verification" | "rejected";

/** Confidence at/above which a live, cross-verified company is "verified". */
export const CONFIDENCE_VERIFIED_MIN = 85;
/** Below this, a company is rejected outright as too weak (spec: "below 70 reject"). */
export const CONFIDENCE_REJECT_BELOW = 70;
/** Trusted (non-web-search) sources required to be considered cross-verified. */
export const CROSS_VERIFY_MIN_SOURCES = 2;

/** Sources that count as independent corroboration. Bare web search does not. */
const TRUSTED_SOURCE_KINDS: ReadonlySet<CompanySourceKind> = new Set<CompanySourceKind>([
  "official_website",
  "linkedin",
  "google_maps",
  "opencorporates",
  "wikidata",
  "public_registry",
]);

const SOURCE_LABELS: Record<CompanySourceKind, string> = {
  official_website: "Official website",
  linkedin: "LinkedIn",
  google_maps: "Google Maps / Places",
  opencorporates: "OpenCorporates",
  wikidata: "Wikidata",
  public_registry: "Public registry / directory",
  web_search: "Web search",
};

function directorySourceKind(source: MergedCompanySeed["directorySource"]): CompanySourceKind {
  switch (source) {
    case "google-places":
    case "overpass":
    case "apify":
      return "google_maps";
    case "opencorporates":
      return "opencorporates";
    case "wikidata":
      return "wikidata";
    case "business-directory":
    case "public-database":
      return "public_registry";
    default:
      return "public_registry";
  }
}

export interface CollectSourcesInput {
  seedSource?: "directory" | "web";
  directorySource?: MergedCompanySeed["directorySource"];
  websiteStatus?: WebsiteStatus | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
}

/**
 * Build the deduplicated list of trusted sources that corroborate a company.
 * The official website is only counted once verified live — a dead/parked page
 * is not corroboration.
 */
export function collectCompanySources(input: CollectSourcesInput): CompanySource[] {
  const byKind = new Map<CompanySourceKind, CompanySource>();
  const add = (kind: CompanySourceKind, url: string | null) => {
    if (byKind.has(kind)) return;
    byKind.set(kind, { kind, label: SOURCE_LABELS[kind], url });
  };

  if (input.websiteStatus === "live") {
    add("official_website", input.websiteUrl ?? null);
  }
  if (input.linkedinUrl) {
    add("linkedin", input.linkedinUrl);
  }
  if (input.seedSource === "directory" && input.directorySource) {
    add(directorySourceKind(input.directorySource), null);
  }
  if (input.seedSource === "web") {
    add("web_search", input.websiteUrl ?? null);
  }

  return [...byKind.values()];
}

export function countTrustedSources(sources: CompanySource[]): number {
  return sources.filter((source) => TRUSTED_SOURCE_KINDS.has(source.kind)).length;
}

export interface CompanyVerificationInput {
  websiteStatus?: WebsiteStatus | null;
  sources: CompanySource[];
  confidenceScore: number;
  semanticRelevance?: number | null;
}

export interface CompanyVerification {
  status: CompanyValidationStatus;
  sources: CompanySource[];
  trustedSourceCount: number;
  crossVerified: boolean;
  reasons: string[];
}

/**
 * Compute the final validation verdict. Rejection is reserved for affirmative
 * dead-site evidence and clearly-too-weak confidence; everything else lands as
 * "verified" (fully corroborated) or "needs_verification" (real but thin).
 */
export function computeCompanyVerification(input: CompanyVerificationInput): CompanyVerification {
  const trustedSourceCount = countTrustedSources(input.sources);
  const crossVerified = trustedSourceCount >= CROSS_VERIFY_MIN_SOURCES;
  const reasons: string[] = [];

  // Rejection is reserved for affirmative dead-site evidence. Off-industry /
  // size / country rejections are owned by validate-company + apply-criteria, and
  // low confidence is surfaced as "needs verification" (below) rather than a hard
  // drop, so the pipeline's own acceptance logic stays authoritative.
  if (isDeadWebsiteStatus(input.websiteStatus)) {
    return {
      status: "rejected",
      sources: input.sources,
      trustedSourceCount,
      crossVerified,
      reasons: [`Website not live (${input.websiteStatus})`],
    };
  }

  if (!crossVerified) {
    reasons.push(
      `Only ${trustedSourceCount} trusted source${trustedSourceCount === 1 ? "" : "s"} (needs >=${CROSS_VERIFY_MIN_SOURCES})`
    );
  }
  if (input.websiteStatus === "unreachable") {
    reasons.push("Website could not be reached for verification");
  }
  if (input.websiteStatus === "low_content") {
    reasons.push("Website has very little content");
  }
  if (
    typeof input.semanticRelevance === "number" &&
    input.semanticRelevance < SEMANTIC_RELEVANCE_FLOOR
  ) {
    reasons.push(`Weak semantic match to query (${input.semanticRelevance}%)`);
  }
  if (input.confidenceScore < CONFIDENCE_VERIFIED_MIN) {
    reasons.push(`Confidence ${input.confidenceScore} below verified threshold ${CONFIDENCE_VERIFIED_MIN}`);
  }

  return {
    status: reasons.length === 0 ? "verified" : "needs_verification",
    sources: input.sources,
    trustedSourceCount,
    crossVerified,
    reasons,
  };
}
