const VAGUE_SEARCH_NAMES = new Set([
  "social",
  "test",
  "draft",
  "new",
  "search",
  "leads",
  "demo",
  "sample",
]);

/** Skip campaign/draft names that pollute web and directory queries. */
export function isUsefulSearchName(searchName: string | undefined | null): boolean {
  const trimmed = (searchName ?? "").trim();
  if (trimmed.length < 4) return false;
  const lower = trimmed.toLowerCase();
  if (VAGUE_SEARCH_NAMES.has(lower)) return false;
  if (/\b(test|draft|sample|demo)\b/i.test(trimmed)) return false;
  return true;
}

const PAGE_TITLE_PREFIXES = new Set([
  "english",
  "home",
  "welcome",
  "homepage",
  "official site",
  "official website",
]);

/** Strip HTML page titles and locale prefixes from stored company names. */
export function normalizeCompanyNameForSearch(name: string): string {
  let cleaned = name.trim();
  if (!cleaned) return name;

  const pipeParts = cleaned
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (pipeParts.length > 1) {
    cleaned =
      pipeParts.find((part) => !PAGE_TITLE_PREFIXES.has(part.toLowerCase())) ??
      pipeParts[pipeParts.length - 1];
  }

  cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  return cleaned || name;
}
