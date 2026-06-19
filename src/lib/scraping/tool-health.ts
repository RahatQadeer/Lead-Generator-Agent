/**
 * Session-level circuit breaker — skip tools that repeatedly fail or return nothing.
 * Speeds up the pipeline by not retrying broken backends (DDG blocks, AI 404, etc.).
 */

export type ScrapingToolId =
  | "searxng"
  | "duckduckgo"
  | "wikipedia"
  | "playwright"
  | "ai-extraction"
  | "wikidata-people"
  | "google-places"
  | "overpass"
  | "opencorporates"
  | "wikidata-directory"
  | "business-directory"
  | "public-database"
  | "apify-google-maps"
  | "apify-website-crawler";

interface ToolHealthState {
  consecutiveFailures: number;
  consecutiveMisses: number;
  disabledUntil: number;
  lastSuccessAt: number | null;
}

const FAILURE_THRESHOLD = 3;
const MISS_THRESHOLD = 5;
const COOLDOWN_MS = 15 * 60 * 1000;

const state = new Map<ScrapingToolId, ToolHealthState>();

function getState(tool: ScrapingToolId): ToolHealthState {
  let entry = state.get(tool);
  if (!entry) {
    entry = {
      consecutiveFailures: 0,
      consecutiveMisses: 0,
      disabledUntil: 0,
      lastSuccessAt: null,
    };
    state.set(tool, entry);
  }
  return entry;
}

function maybeDisable(tool: ScrapingToolId, entry: ToolHealthState): void {
  if (
    entry.consecutiveFailures >= FAILURE_THRESHOLD ||
    entry.consecutiveMisses >= MISS_THRESHOLD
  ) {
    entry.disabledUntil = Date.now() + COOLDOWN_MS;
  }
}

/** Whether this tool should be called right now. */
export function isScrapingToolAvailable(tool: ScrapingToolId): boolean {
  const entry = getState(tool);
  if (entry.disabledUntil === 0) return true;
  if (Date.now() >= entry.disabledUntil) {
    entry.consecutiveFailures = 0;
    entry.consecutiveMisses = 0;
    entry.disabledUntil = 0;
    return true;
  }
  return false;
}

export function recordScrapingToolSuccess(tool: ScrapingToolId): void {
  const entry = getState(tool);
  entry.consecutiveFailures = 0;
  entry.consecutiveMisses = 0;
  entry.disabledUntil = 0;
  entry.lastSuccessAt = Date.now();
}

export function recordScrapingToolFailure(tool: ScrapingToolId): void {
  const entry = getState(tool);
  entry.consecutiveFailures += 1;
  entry.consecutiveMisses = 0;
  maybeDisable(tool, entry);
}

/** Request succeeded but returned no usable results. */
export function recordScrapingToolMiss(tool: ScrapingToolId): void {
  const entry = getState(tool);
  entry.consecutiveMisses += 1;
  maybeDisable(tool, entry);
}

export interface ScrapingToolHealthView {
  tool: ScrapingToolId;
  available: boolean;
  consecutiveFailures: number;
  consecutiveMisses: number;
  disabledUntil: string | null;
  lastSuccessAt: string | null;
}

export function getScrapingToolHealth(): ScrapingToolHealthView[] {
  const tools: ScrapingToolId[] = [
    "searxng",
    "duckduckgo",
    "wikipedia",
    "playwright",
    "ai-extraction",
    "wikidata-people",
    "google-places",
    "overpass",
    "opencorporates",
    "wikidata-directory",
    "business-directory",
    "apify-google-maps",
    "apify-website-crawler",
  ];

  return tools.map((tool) => {
    const entry = getState(tool);
    return {
      tool,
      available: isScrapingToolAvailable(tool),
      consecutiveFailures: entry.consecutiveFailures,
      consecutiveMisses: entry.consecutiveMisses,
      disabledUntil:
        entry.disabledUntil > Date.now()
          ? new Date(entry.disabledUntil).toISOString()
          : null,
      lastSuccessAt: entry.lastSuccessAt
        ? new Date(entry.lastSuccessAt).toISOString()
        : null,
    };
  });
}

/** For tests — reset all tool state. */
export function resetScrapingToolHealth(): void {
  state.clear();
}
