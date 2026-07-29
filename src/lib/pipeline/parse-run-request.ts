/**
 * Validation for the pipeline run request.
 *
 * Kept out of the route so it is unit-testable and so the BullMQ worker can
 * validate the same payload — an enqueued job is untrusted input by the time it
 * comes back off Redis, not just at the HTTP boundary.
 */
import { DECISION_MAKER_LADDER } from "@/lib/contact-discovery/decision-maker-ladder";
import type { CompanyCriteria } from "@/lib/providers/types";
import type { FundingStage } from "@/lib/scraping/funding-stage";

const VALID_ROLE_KEYS = new Set(DECISION_MAKER_LADDER.map((rung) => rung.key));

const VALID_FUNDING_STAGES: ReadonlySet<string> = new Set<FundingStage>([
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c",
  "series_d_plus",
  "public",
  "acquired",
  "bootstrapped",
]);

/** Upper bound on a single run, to stop a typo becoming an all-night scrape. */
const MAX_LIMIT = 500;

export interface PipelineRunRequest {
  searchId: string | null;
  criteria: CompanyCriteria;
  roleKeys: string[];
  providerIds: string[];
  enrichCompanies: boolean;
}

export type ParseResult =
  | { ok: true; value: PipelineRunRequest }
  | { ok: false; error: string };

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function parsePipelineRunRequest(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object." };
  }
  const raw = body as Record<string, unknown>;

  const searchId =
    typeof raw.searchId === "string" && raw.searchId.trim() ? raw.searchId.trim() : null;

  const roleKeys = stringArray(raw.roleKeys);
  const unknownRoles = roleKeys.filter((key) => !VALID_ROLE_KEYS.has(key));
  if (unknownRoles.length > 0) {
    return {
      ok: false,
      error: `Unknown decision-maker role(s): ${unknownRoles.join(", ")}. Expected ladder keys such as ${[...VALID_ROLE_KEYS].slice(0, 3).join(", ")}.`,
    };
  }

  const fundingStages = stringArray(raw.fundingStages);
  const unknownStages = fundingStages.filter((s) => !VALID_FUNDING_STAGES.has(s));
  if (unknownStages.length > 0) {
    return { ok: false, error: `Unknown funding stage(s): ${unknownStages.join(", ")}.` };
  }

  const sizeMin = optionalInt(raw.companySizeMin);
  const sizeMax = optionalInt(raw.companySizeMax);
  if (sizeMin !== null && sizeMax !== null && sizeMin > sizeMax) {
    return { ok: false, error: "companySizeMin cannot be greater than companySizeMax." };
  }
  if ((sizeMin !== null && sizeMin < 0) || (sizeMax !== null && sizeMax < 0)) {
    return { ok: false, error: "Company size cannot be negative." };
  }

  const recentlyFunded = optionalInt(raw.fundedWithinMonths);
  if (recentlyFunded !== null && (recentlyFunded <= 0 || recentlyFunded > 120)) {
    return { ok: false, error: "fundedWithinMonths must be between 1 and 120." };
  }

  const requestedLimit = optionalInt(raw.limit) ?? 0;
  if (requestedLimit < 0) {
    return { ok: false, error: "limit cannot be negative." };
  }
  // Clamp rather than reject: a caller asking for more than the cap wants "as
  // many as possible", and failing the request would be unhelpfully literal.
  const limit = requestedLimit === 0 ? 0 : Math.min(requestedLimit, MAX_LIMIT);

  const industry =
    typeof raw.industry === "string" && raw.industry.trim() ? raw.industry.trim() : null;

  const criteria: CompanyCriteria = {
    industry,
    category:
      typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : null,
    countries: stringArray(raw.countries),
    keywords: stringArray(raw.keywords),
    companySizeMin: sizeMin,
    companySizeMax: sizeMax,
    fundingStages: fundingStages as FundingStage[],
    fundedWithinMonths: recentlyFunded,
    limit,
  };

  return {
    ok: true,
    value: {
      searchId,
      criteria,
      roleKeys,
      providerIds: stringArray(raw.providerIds),
      // Default ON: a run without website enrichment produces noticeably thinner
      // records, so opting out should be deliberate.
      enrichCompanies: raw.enrichCompanies !== false,
    },
  };
}
