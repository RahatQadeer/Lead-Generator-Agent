/**
 * Best-effort funding stage from public text (company site copy, search snippets).
 *
 * There is no funding data source wired into this codebase — Crunchbase is blocked as
 * an aggregator — so this reads what a company says about itself. That is sparse and
 * can be stale: plenty of funded startups never mention a round on their site. It
 * returns null rather than guessing, and callers must treat null as "unknown", not
 * "bootstrapped".
 */

export type FundingStage =
  | "pre_seed"
  | "seed"
  | "series_a"
  | "series_b"
  | "series_c"
  | "series_d_plus"
  | "public"
  | "acquired"
  | "bootstrapped";

export const FUNDING_STAGE_LABELS: Record<FundingStage, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c: "Series C",
  series_d_plus: "Series D+",
  public: "Public",
  acquired: "Acquired",
  bootstrapped: "Bootstrapped",
};

/**
 * Ordered most-specific first, and later rounds before earlier ones: a company that
 * mentions both its seed and its Series B is at Series B.
 */
const STAGE_PATTERNS: { stage: FundingStage; pattern: RegExp }[] = [
  { stage: "acquired", pattern: /\b(was acquired by|acquired by|acquisition by)\b/i },
  { stage: "public", pattern: /\b(nasdaq|nyse|publicly traded|ipo'?d|listed on the)\b/i },
  { stage: "series_d_plus", pattern: /\bseries\s*[d-j]\b/i },
  { stage: "series_c", pattern: /\bseries\s*c\b/i },
  { stage: "series_b", pattern: /\bseries\s*b\b/i },
  { stage: "series_a", pattern: /\bseries\s*a\b/i },
  { stage: "seed", pattern: /\b(seed round|seed funding|seed-funded|seed stage|raised.{0,12}seed)\b/i },
  { stage: "pre_seed", pattern: /\b(pre[-\s]?seed)\b/i },
  { stage: "bootstrapped", pattern: /\b(bootstrapped|self[-\s]funded|profitable since|no outside funding)\b/i },
];

/** Pre-seed must win over the "seed" pattern it contains. */
const PRE_SEED_PATTERN = /\bpre[-\s]?seed\b/i;

export function detectFundingStage(text: string | null | undefined): FundingStage | null {
  const value = text?.trim();
  if (!value) return null;

  if (PRE_SEED_PATTERN.test(value)) return "pre_seed";

  for (const { stage, pattern } of STAGE_PATTERNS) {
    if (pattern.test(value)) return stage;
  }

  return null;
}

export function fundingStageLabel(stage: FundingStage | null | undefined): string | null {
  return stage ? FUNDING_STAGE_LABELS[stage] : null;
}
