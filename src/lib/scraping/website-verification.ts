/**
 * Website liveness & quality verification.
 *
 * The company-discovery pipeline must never surface dead, parked, placeholder,
 * or under-construction websites (see the "never show mock/dead data" rule).
 * `fetchPage` already discards non-2xx / non-HTML responses, but a large class
 * of dead sites answer `200 OK` with a parking page, a registrar "domain for
 * sale" splash, a default server page, or a "coming soon" holding page. Those
 * only reveal themselves in the response *body*, so we classify the fetched
 * HTML here.
 *
 * Design decision — asymmetric strictness:
 *   We REJECT only on *affirmative* evidence that a site is not a real business
 *   site (parked / for-sale / suspended / explicit error body / coming-soon /
 *   under-construction / default server template). A transient fetch failure
 *   (robots block, rate-limit, timeout, SPA that renders empty HTML) is treated
 *   as `unreachable`/`low_content` and downgraded to "needs verification" rather
 *   than rejected — rejecting a real company because our bot got blocked would
 *   silently destroy recall. This keeps precision high without nuking legit leads.
 *
 * All functions here are pure and deterministic so they can be unit-tested with
 * fixture HTML and reused outside the scraping stack.
 */

export type WebsiteStatus =
  | "live" // 200 + real, substantive content
  | "parked" // registrar parking / "domain for sale" page
  | "placeholder" // coming soon / under construction / default server template
  | "error_page" // 404/403/500/suspended body served with a 200
  | "unreachable" // fetch failed, non-2xx, non-HTML, or empty body
  | "low_content"; // reachable but too thin to be a real site

/** Statuses that are affirmative evidence a site is not a real business site. */
export const DEAD_WEBSITE_STATUSES: ReadonlySet<WebsiteStatus> = new Set<WebsiteStatus>([
  "parked",
  "placeholder",
  "error_page",
]);

export function isDeadWebsiteStatus(status: WebsiteStatus | null | undefined): boolean {
  return status != null && DEAD_WEBSITE_STATUSES.has(status);
}

export interface WebsiteLivenessInput {
  /** True when a page (HTTP or rendered) was actually retrieved. */
  reachable: boolean;
  /** Raw HTML of the retrieved page, if any. */
  html: string | null;
  /** Parsed <title>, if already available (avoids re-parsing). */
  title?: string | null;
}

export interface WebsiteLivenessResult {
  status: WebsiteStatus;
  /** True only for a genuinely live, substantive site. */
  live: boolean;
  /** Human-readable explanation for non-live statuses. */
  reason: string | null;
}

export interface WebsiteQualityResult {
  hasAbout: boolean;
  hasContact: boolean;
  hasProductsOrServices: boolean;
  /** Approximate count of visible (non-markup) characters. */
  textLength: number;
  /** 0-100 rating combining structural signals + content depth. */
  qualityScore: number;
  signals: string[];
}

export interface WebsiteVerificationResult extends WebsiteLivenessResult {
  quality: WebsiteQualityResult | null;
}

/** Below this many visible characters a reachable page is treated as too thin. */
const MIN_VISIBLE_TEXT = 220;

const PARKED_PATTERNS: RegExp[] = [
  /\bthis domain (?:name )?is (?:for sale|available for purchase)\b/i,
  /\bbuy this domain\b/i,
  /\bthe domain [^.]{0,60} is for sale\b/i,
  /\bdomain (?:parking|is parked|for sale)\b/i,
  /\bparked (?:free )?(?:courtesy of|by)\b/i,
  /\binterested in this domain\b/i,
  /\b(?:hugedomains|sedoparking|dan\.com|afternic|bodis|parkingcrew)\b/i,
  /\brenew (?:your )?domain (?:name )?(?:now|today)\b/i,
];

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\bcoming soon\b/i,
  /\bunder construction\b/i,
  /\bsite (?:is )?(?:currently )?being (?:built|worked on|developed)\b/i,
  /\bwe(?:'| a)?re (?:still )?(?:building|working on)\b/i,
  /\blaunching soon\b/i,
  /\byour (?:new )?website is (?:almost )?ready\b/i,
  /\bdefault (?:web ?server|web ?site|page)\b/i,
  /\bwelcome to nginx\b/i,
  /\bapache2? (?:ubuntu|debian|centos)? ?default page\b/i,
  /\bit works!\b/i,
  /\bindex of \//i,
  /\bthis (?:page|site) is (?:a )?placeholder\b/i,
];

const ERROR_BODY_PATTERNS: RegExp[] = [
  /\b(?:404|403|500|502|503)\b[^<]{0,40}\b(?:error|not found|forbidden|unavailable)\b/i,
  /\bpage not found\b/i,
  /\b(?:account|website|site|domain) (?:has been )?suspended\b/i,
  /\baccess (?:denied|forbidden)\b/i,
  /\bthis (?:site|account) (?:has been )?(?:disabled|suspended)\b/i,
  /\bservice temporarily unavailable\b/i,
  /\b(?:scheduled|under|undergoing) maintenance\b/i,
  /\bwe(?:'| a)?ll be back (?:soon|shortly)\b/i,
];

/** Strip scripts/styles/markup to approximate the human-visible text of a page. */
export function extractVisibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Classify a fetched page as live / parked / placeholder / error / unreachable /
 * low-content. Only the first three are affirmative "dead site" evidence.
 */
export function classifyWebsiteLiveness(input: WebsiteLivenessInput): WebsiteLivenessResult {
  if (!input.reachable || !input.html || input.html.trim().length === 0) {
    return {
      status: "unreachable",
      live: false,
      reason: "Website did not return a usable page (blocked, offline, or empty).",
    };
  }

  const title = (input.title ?? "").toLowerCase();
  const visibleText = extractVisibleText(input.html);
  // Scan title + a bounded head of the body — parking/placeholder markers live
  // at the very top of the document, and this keeps the regex work cheap.
  const haystack = `${title}\n${visibleText.slice(0, 4000)}`.toLowerCase();

  if (matchesAny(haystack, PARKED_PATTERNS)) {
    return { status: "parked", live: false, reason: "Domain appears parked or listed for sale." };
  }

  if (matchesAny(haystack, ERROR_BODY_PATTERNS)) {
    return {
      status: "error_page",
      live: false,
      reason: "Page served an error, suspension, or maintenance notice.",
    };
  }

  if (matchesAny(haystack, PLACEHOLDER_PATTERNS)) {
    return {
      status: "placeholder",
      live: false,
      reason: "Placeholder / coming-soon / default server page — no real site yet.",
    };
  }

  if (visibleText.length < MIN_VISIBLE_TEXT) {
    return {
      status: "low_content",
      live: false,
      reason: `Very little content (${visibleText.length} chars) — could not confirm a real site.`,
    };
  }

  return { status: "live", live: true, reason: null };
}

const ABOUT_PATTERN = /\b(?:about(?:[-\s]us)?|who[-\s]we[-\s]are|our[-\s](?:story|company|team|mission))\b/i;
const CONTACT_PATTERN = /\b(?:contact(?:[-\s]us)?|get[-\s]in[-\s]touch|reach[-\s]us|mailto:)\b/i;
const PRODUCTS_PATTERN =
  /\b(?:products?|services?|solutions?|pricing|features?|platform|what[-\s]we[-\s]do|use[-\s]cases?)\b/i;

/**
 * Assess website quality from the presence of the structural pages the spec
 * requires (About, Contact, Products/Services) plus content depth. Signals are
 * detected from anchor hrefs, anchor/nav text, and headings — a lightweight,
 * dependency-free scan that mirrors how a human skims a homepage.
 */
export function assessWebsiteQuality(html: string): WebsiteQualityResult {
  const visibleText = extractVisibleText(html);
  // Restrict structural detection to link/nav/heading regions so body prose that
  // merely says "about" doesn't create false positives.
  const navRegions = [
    ...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi),
    ...html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi),
    ...html.matchAll(/<h[1-3]\b[^>]*>[\s\S]*?<\/h[1-3]>/gi),
  ]
    .map((m) => m[0])
    .join(" ");
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]).join(" ");
  const structural = `${navRegions} ${hrefs}`;

  const hasAbout = ABOUT_PATTERN.test(structural);
  const hasContact = CONTACT_PATTERN.test(structural) || /mailto:/i.test(html);
  const hasProductsOrServices = PRODUCTS_PATTERN.test(structural);

  const signals: string[] = [];
  if (hasAbout) signals.push("about");
  if (hasContact) signals.push("contact");
  if (hasProductsOrServices) signals.push("products/services");

  // Content-depth bucket (0-40) rewards substantive pages without over-rewarding
  // link-farm pages that are long but empty of prose.
  const depth =
    visibleText.length >= 2500
      ? 40
      : visibleText.length >= 1000
        ? 30
        : visibleText.length >= MIN_VISIBLE_TEXT
          ? 18
          : 0;

  const qualityScore = Math.min(
    100,
    (hasAbout ? 20 : 0) + (hasContact ? 20 : 0) + (hasProductsOrServices ? 20 : 0) + depth
  );

  return { hasAbout, hasContact, hasProductsOrServices, textLength: visibleText.length, qualityScore, signals };
}

/** Full website verification: liveness + (when live enough) quality assessment. */
export function verifyWebsite(input: WebsiteLivenessInput): WebsiteVerificationResult {
  const liveness = classifyWebsiteLiveness(input);
  const quality = input.html && input.html.trim().length > 0 ? assessWebsiteQuality(input.html) : null;
  return { ...liveness, quality };
}
