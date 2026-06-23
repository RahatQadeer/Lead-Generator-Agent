/** Tunables for Google Places Text Search company discovery. */

const PAGE_SIZE_MAX = 20;
const PAGES_PER_QUERY_MAX = 3;

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  max: number
): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(max, Math.round(value));
}

/** Max unique companies to collect from Google Places in one discovery run. */
export function getGooglePlacesMaxResultsPerRun(): number {
  return parsePositiveInt(process.env.GOOGLE_PLACES_MAX_RESULTS_PER_RUN, 200, 500);
}

/** Max distinct text queries (country + city + keyword variants). */
export function getGooglePlacesMaxQueries(): number {
  return parsePositiveInt(process.env.GOOGLE_PLACES_MAX_QUERIES, 12, 24);
}

/** Pages to fetch per query (Google allows up to 3 × 20 = 60 per query). */
export function getGooglePlacesPagesPerQuery(): number {
  return parsePositiveInt(
    process.env.GOOGLE_PLACES_PAGES_PER_QUERY,
    PAGES_PER_QUERY_MAX,
    PAGES_PER_QUERY_MAX
  );
}

export function getGooglePlacesPageSize(): number {
  return parsePositiveInt(process.env.GOOGLE_PLACES_PAGE_SIZE, PAGE_SIZE_MAX, PAGE_SIZE_MAX);
}

/** Delay before using nextPageToken (Google recommends a short wait). */
export function getGooglePlacesPageTokenDelayMs(): number {
  return parsePositiveInt(process.env.GOOGLE_PLACES_PAGE_TOKEN_DELAY_MS, 350, 2_000);
}

export const GOOGLE_PLACES_API_LIMITS = {
  pageSizeMax: PAGE_SIZE_MAX,
  pagesPerQueryMax: PAGES_PER_QUERY_MAX,
  maxResultsPerQuery: PAGE_SIZE_MAX * PAGES_PER_QUERY_MAX,
} as const;
