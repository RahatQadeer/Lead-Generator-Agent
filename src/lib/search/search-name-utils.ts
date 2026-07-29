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

const LEGAL_SUFFIX_PATTERN =
  /\b(incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|company|co|group|holdings|plc|pvt|private|gmbh|bv|ag|srl|sarl|oy|ab|as|nv)\b\.?/gi;

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** "RightTail Pvt Ltd" -> "RightTail" */
export function stripCompanyLegalSuffix(name: string): string {
  const cleaned = collapseSpaces(
    name.replace(LEGAL_SUFFIX_PATTERN, " ").replace(/[,.]/g, " ")
  );
  return cleaned || collapseSpaces(name);
}

/** "RightTail" -> "Right Tail", "Right-Tail" -> "Right Tail", "R&D Labs" -> "R and D Labs" */
export function splitCompoundCompanyName(name: string): string {
  return collapseSpaces(
    name
      .replace(/[-_/]+/g, " ")
      .replace(/&/g, " and ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
  );
}

/** "Right Tail" -> "righttail" */
export function joinCompanyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const MAX_COMPANY_VARIANTS = 4;

/**
 * Company spellings to try in search, most faithful to the stored name first:
 * "RightTail Inc" -> "RightTail Inc", "RightTail", "Right Tail", "righttail".
 * Search engines treat these as different terms even though they are one company.
 */
export function companySearchVariants(
  companyName: string,
  companyDomain?: string | null
): string[] {
  const canonical = normalizeCompanyNameForSearch(companyName).trim();
  const variants: string[] = [];

  const push = (value: string | null | undefined) => {
    const trimmed = collapseSpaces(value ?? "");
    if (trimmed.length < 2) return;
    if (variants.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) return;
    variants.push(trimmed);
  };

  push(canonical);

  const stripped = stripCompanyLegalSuffix(canonical);
  push(stripped);
  push(splitCompoundCompanyName(stripped));
  push(joinCompanyName(stripped));

  const root = companyDomain?.replace(/^www\./, "").split(".")[0];
  if (root && root.length >= 3) push(root);

  return variants.slice(0, MAX_COMPANY_VARIANTS);
}
