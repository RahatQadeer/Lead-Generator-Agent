import { getExecutiveFallbackTitleLabel } from "@/lib/contact-discovery/apply-title-filter";

export interface ApiErrorLike {
  code: string;
  message: string;
}

export interface DiscoverMetaLike {
  filteredCount?: number;
  excludedCount?: number;
  duplicateCount?: number;
  batchDuplicateCount?: number;
  knownDuplicateCount?: number;
  seedCount?: number;
  enrichedCount?: number;
  relaxedMatch?: boolean;
  rejectedCount?: number;
}

export const GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_ERROR: "Please sign in to continue.",
  NETWORK_ERROR:
    "We couldn't connect right now. Check your internet and try again.",
  VALIDATION_ERROR: "Something was missing from your request. Please try again.",
  SEARCH_NOT_FOUND: "This search couldn't be found. Refresh the page and try again.",
  NO_COMPANIES:
    "No companies yet. Complete “Find companies” first, then come back to this step.",
  NO_CONTACTS:
    "No contacts yet. Complete “Find people” first, then come back to this step.",
  CONTACTS_DISCARDED:
    "Your contacts were discarded because no email or LinkedIn was found. Run “Find people” again to reset them.",
  PROVIDER_NOT_CONFIGURED:
    "This feature isn't set up yet. Ask your administrator for help.",
  PLAN_RESTRICTED:
    "This data source isn't available on your current plan. Ask your administrator to enable the free provider.",
  RATE_LIMIT: "Too many requests. Please wait a moment and try again.",
  QUEUE_ERROR: "We couldn't start the background job. Please try again.",
  PROVIDER_ERROR: GENERIC_ERROR_MESSAGE,
  SAVE_FAILED: "We couldn't save your changes. Please try again.",
  UPDATE_FAILED: "We couldn't update your settings. Please try again.",
  CONTACT_NOT_FOUND: "We couldn't find that contact. Refresh the page and try again.",
  EMAIL_NOT_FOUND: "We couldn't find that email. Refresh the page and try again.",
  NOT_FOUND: "We couldn't find what you were looking for. Refresh and try again.",
};

const ERROR_HINTS: Record<string, string> = {
  NO_COMPANIES: "Go back to step 1 and click “Find companies”.",
  NO_CONTACTS: "Go back to step 2 and click “Find people”.",
  CONTACTS_DISCARDED:
    "Go back to step 2, click “Find people” again, then return here.",
  PLAN_RESTRICTED:
    "Your team can use the built-in free company search instead of a paid API.",
  SAVE_FAILED: "Go back to step 1, run Find companies, then try Find people again.",
  AUTH_ERROR: "Sign in, then try your action again.",
};

const TECHNICAL_MESSAGE_PATTERNS = [
  /\.env/i,
  /API key/i,
  /SearXNG|Wikipedia|OpenRouter|Apollo|COMPANY_DATA/i,
  /Authentication required/i,
  /\w+Id is required/i,
  /unexpected error/i,
  /enqueue/i,
  /Set \w+ in your environment/i,
  /restart.*dev server/i,
  /generationProvider must be/i,
  /sendingProvider must be/i,
  /Live sources:/i,
  /No API key configured/i,
];

function isTechnicalMessage(message: string): boolean {
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

/** Turn API error codes into plain language for end users. */
export function getUserFriendlyError(error: ApiErrorLike): string {
  const msg = error.message?.trim();

  if (
    (error.code === "SAVE_FAILED" || error.code === "CONTACTS_DISCARDED") &&
    msg &&
    !isTechnicalMessage(msg)
  ) {
    return msg;
  }

  if (ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }

  if (msg && !isTechnicalMessage(msg)) {
    return msg;
  }

  return GENERIC_ERROR_MESSAGE;
}

/** Use on API responses: prefers friendly copy, falls back to a step-specific default. */
export function getApiErrorMessage(
  error?: ApiErrorLike | null,
  fallback = GENERIC_ERROR_MESSAGE
): string {
  if (!error) {
    return fallback;
  }

  const friendly = getUserFriendlyError(error);
  if (friendly === GENERIC_ERROR_MESSAGE && fallback !== GENERIC_ERROR_MESSAGE) {
    return fallback;
  }

  return friendly;
}

/** Optional second line under an error (actionable hint). */
export function getErrorHint(code: string): string | null {
  return ERROR_HINTS[code] ?? null;
}

/** Explain why “Find companies” returned zero results. */
export function getNoCompaniesMessage(meta?: DiscoverMetaLike): string {
  const filtered = meta?.filteredCount ?? 0;
  const excluded = meta?.excludedCount ?? 0;
  const dropped = meta?.duplicateCount ?? 0;
  const seeds = meta?.seedCount ?? 0;
  const enriched = meta?.enrichedCount ?? 0;
  const rejected = meta?.rejectedCount ?? 0;

  if (seeds === 0) {
    return "No companies found. Try a different industry, country, or keywords.";
  }

  if (enriched > 0 && filtered > 0 && filtered >= enriched) {
    return "No companies matched your country and industry filters. Web search often returns global list pages (e.g. US or India healthcare giants) instead of local businesses. Run Find companies again — results vary by source; OpenStreetMap and business directories work better for country-specific searches like Pakistan.";
  }

  if (enriched > 0 && filtered > 0) {
    return "No companies matched your filters. Try widening company size or using a broader industry.";
  }

  if (seeds > 0 && enriched > 0) {
    if ((meta?.rejectedCount ?? 0) > 0) {
      return `${enriched} companies were found but filtered out by industry, country, or company-type rules. Try one keyword instead of two similar ones (e.g. healthtech only), then run Find companies again.`;
    }
    return "No companies matched your search. Try widening company size or adjusting filters.";
  }

  if (dropped > 0 && (meta?.knownDuplicateCount ?? 0) === 0) {
    return "Duplicate companies were found in this batch but could not be added. Try again or adjust your criteria.";
  }

  if (filtered > 0) {
    return "Companies were found, but none matched your company size or industry filters. Try widening the employee range or using a broader industry.";
  }

  if (excluded > 0) {
    return "Companies were found, but your exclusion rules filtered them all out. Review the “Companies to skip” section in this search.";
  }

  return "We couldn't find companies that match this search. Try a broader industry, a different country, or remove some keywords.";
}

/** Friendly labels for result summary chips (no internal provider names). */
export function formatDiscoverSummary(meta?: DiscoverMetaLike): string[] {
  const lines: string[] = [];

  if ((meta?.filteredCount ?? 0) > 0) {
    lines.push(`${meta!.filteredCount} didn't match your filters`);
  }
  if ((meta?.knownDuplicateCount ?? 0) > 0) {
    lines.push(
      `${meta!.knownDuplicateCount} linked from current results (seen before)`
    );
  }
  const batchDupes = meta?.batchDuplicateCount ?? 0;
  if (batchDupes > 0) {
    lines.push(`${batchDupes} duplicate${batchDupes === 1 ? "" : "s"} skipped in this batch`);
  } else if (
    (meta?.duplicateCount ?? 0) > 0 &&
    (meta?.knownDuplicateCount ?? 0) === 0
  ) {
    lines.push(`${meta!.duplicateCount} duplicates skipped`);
  }
  if ((meta?.excludedCount ?? 0) > 0) {
    lines.push(`${meta!.excludedCount} excluded by your rules`);
  }

  return lines;
}

export interface NoContactsMeta {
  /** People matching job titles (saved / shown). */
  scrapedCount?: number;
  /** Raw people parsed from websites before title filter. */
  parsedCount?: number;
  filteredCount?: number;
  /** Parsed but rejected before matching (affiliation, junk names, quality). */
  rejectedCount?: number;
  companyCount?: number;
  jobTitles?: string[];
  relaxedMatch?: boolean;
  companiesWithoutDomain?: number;
  searxngConfigured?: boolean;
}

export function getNoContactsMessage(meta?: NoContactsMeta): string {
  const matched = meta?.scrapedCount ?? 0;
  const parsed = meta?.parsedCount ?? matched;
  const filtered = meta?.filteredCount ?? 0;
  const companies = meta?.companyCount ?? 0;
  const titles =
    meta?.jobTitles && meta.jobTitles.length > 0
      ? meta.jobTitles.join(", ")
      : "CEO, CTO, or Founder";

  if (companies === 0) {
    return "No companies yet. Complete “Find companies” first, then return to this step.";
  }

  if (parsed > 0 && matched === 0 && filtered > 0) {
    return `Checked ${companies} ${companies === 1 ? "company" : "companies"} and found ${parsed} people on their websites, but none matched your roles (${titles}) or other executive titles we could identify. Try broader job titles like Founder or Director, or re-run after clearing the scrape cache.`;
  }

  const rejected = meta?.rejectedCount ?? 0;
  if (parsed > 0 && matched === 0 && rejected > 0) {
    return `Found ${parsed} names on company websites, but none passed quality checks (wrong company, invalid name, or low confidence). Try broader job titles like Founder or Director, or pick companies with a public team page.`;
  }

  if (parsed > 0 && matched === 0) {
    return "People were found on company websites but none could be matched to your search. Try broader job titles (e.g. Founder, Director) and run Find people again.";
  }

  if (companies > 0 && parsed === 0) {
    if ((meta?.companiesWithoutDomain ?? 0) > 0) {
      return `${meta?.companiesWithoutDomain} of ${companies} ${companies === 1 ? "company has" : "companies have"} no website domain — people discovery needs a company website. Re-run Find companies and pick listings with a website URL.`;
    }

    if (rejected > 0) {
      return `Scraping ran for ${companies} ${companies === 1 ? "company" : "companies"}, but ${rejected} candidate ${rejected === 1 ? "name was" : "names were"} rejected (wrong company, junk name, or affiliation check). Try broader titles (Founder, Director) or a company with a public /team page.`;
    }

    const searxngHint =
      meta?.searxngConfigured === false
        ? " SearXNG is not configured — set SEARXNG_URL and run docker compose up -d searxng for LinkedIn/directory fallbacks."
        : "";

    return `No people found on the company website for ${companies} ${companies === 1 ? "company" : "companies"}. Many sites hide team pages, block scrapers, or list no names.${searxngHint} Try broader job titles (Founder, Director) or companies that publish leadership on /team or /about.`;
  }

  return "We couldn't find people for this search. Try again or adjust your job titles.";
}

export function getRelaxedContactsNotice(meta?: {
  jobTitles?: string[];
  companyCount?: number;
  companiesWithContacts?: number;
}): string {
  const titles =
    meta?.jobTitles && meta.jobTitles.length > 0
      ? meta.jobTitles.join(", ")
      : "Selected title";

  return `${titles} not found — showing other decision-makers instead.`;
}

export function getNoLeadsEnrichedMessage(meta?: { discardedCount?: number }): string {
  if ((meta?.discardedCount ?? 0) > 0) {
    return "No email or LinkedIn could be found for these people. Re-run Find people, then try Add contact details again.";
  }
  return "No profiles were updated. Make sure you've found contacts first, then try again.";
}
