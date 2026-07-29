import type { FundingStage } from "@/lib/scraping/funding-stage";
import type { ScraperFilters } from "@/lib/scrapers/filters";

const FUNDING_STAGES: ReadonlySet<string> = new Set<FundingStage>([
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

function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toTrimmedString(item))
      .filter((item): item is string => item !== null);
  }
  const single = toTrimmedString(value);
  return single ? [single] : [];
}

function toPositiveInt(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
}

function toFundingStages(value: unknown): FundingStage[] {
  return toStringArray(value)
    .map((stage) => stage.toLowerCase())
    .filter((stage): stage is FundingStage => FUNDING_STAGES.has(stage));
}

/**
 * Coerce an untrusted request-body value into a well-formed {@link ScraperFilters}.
 * Unknown/invalid fields are dropped rather than throwing so a malformed filter
 * never fails the whole run.
 */
export function parseScraperFilters(input: unknown): ScraperFilters {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;

  const filters: ScraperFilters = {
    industry: toTrimmedString(raw.industry),
    category: toTrimmedString(raw.category),
    location: toTrimmedString(raw.location),
    fundingStage: toFundingStages(raw.fundingStage),
    companySizeMin: toPositiveInt(raw.companySizeMin),
    companySizeMax: toPositiveInt(raw.companySizeMax),
    keywords: toStringArray(raw.keywords),
  };

  return filters;
}
