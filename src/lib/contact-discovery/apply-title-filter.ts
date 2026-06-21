import type { DiscoveredContact } from "@/types/contact";
import {
  enrichContactTitles,
  inferExecutiveTitleFromText,
} from "@/lib/contact-discovery/resolve-contact-title";
import { isPlausiblePersonName } from "@/lib/scraping/data-quality";

/** Parser fallbacks when a page lists a person but not their role. */
const UNKNOWN_TITLES = new Set([
  "team member",
  "staff member",
  "employee",
  "member",
  "unknown",
  "n/a",
  "",
]);

/** Default roles when the search has no explicit job-title filter. */
export const DEFAULT_LEADERSHIP_TITLES = ["CEO", "CTO", "Founder"] as const;

/** Roles used when the selected title is missing and we search for other decision-makers. */
export const DECISION_MAKER_SEARCH_ROLES = [
  "CEO",
  "CFO",
  "COO",
  "CTO",
  "Founder",
  "Co-Founder",
  "President",
  "VP Engineering",
  "Vice President Engineering",
  "Director",
  "Owner",
  "Manager",
  "VP",
] as const;

export function getDecisionMakerSearchRoles(): string[] {
  return [...DECISION_MAKER_SEARCH_ROLES];
}

/** Max people saved per company — keeps coverage spread across the company list. */
export const MAX_CONTACTS_PER_COMPANY = 5;

/**
 * When the selected job title is missing, accept these executive roles from company websites.
 */
export const EXECUTIVE_FALLBACK_TITLES = [
  "CEO",
  "CFO",
  "COO",
  "CTO",
  "CMO",
  "Owner",
  "Director",
  "Manager",
  "Founder",
  "Co-Founder",
  "President",
  "Vice President",
  "VP",
  "Chairman",
  "Partner",
  "Head of",
] as const;

export function getExecutiveFallbackTitleLabel(): string {
  return "CEO, CFO, COO, Owner, Director, Manager, Founder, Co-Founder, President";
}

const DECISION_MAKER_TITLE_PRIORITY: { pattern: RegExp; score: number }[] = [
  { pattern: /\b(co[- ]?founder|cofounder)\b/i, score: 100 },
  { pattern: /\bfounder\b/i, score: 98 },
  { pattern: /\bceo\b|chief executive/i, score: 96 },
  { pattern: /\bcto\b|chief technology/i, score: 92 },
  { pattern: /\bcfo\b|chief financial/i, score: 90 },
  { pattern: /\bcoo\b|chief operating/i, score: 88 },
  { pattern: /\bpresident\b/i, score: 84 },
  { pattern: /\bvp\b|vice president/i, score: 82 },
  { pattern: /\bowner\b/i, score: 80 },
  { pattern: /\bmanaging director\b/i, score: 78 },
  { pattern: /\bdirector\b/i, score: 76 },
  { pattern: /\bhead of\b/i, score: 74 },
  { pattern: /\bgeneral manager\b/i, score: 72 },
];

function decisionMakerPriority(title: string | null | undefined): number {
  const normalized = title?.trim() ?? "";
  for (const { pattern, score } of DECISION_MAKER_TITLE_PRIORITY) {
    if (normalized && pattern.test(normalized)) return score;
  }
  return isExecutiveFallbackTitle(title) ? 50 : 0;
}

function sortByDecisionMakerRank(contacts: DiscoveredContact[]): DiscoveredContact[] {
  return [...contacts].sort((a, b) => {
    const scoreDiff = decisionMakerPriority(b.title) - decisionMakerPriority(a.title);
    if (scoreDiff !== 0) return scoreDiff;
    return a.fullName.localeCompare(b.fullName);
  });
}

/** People matching the selected title or qualifying as website decision-makers. */
export function countLeadershipContacts(
  contacts: DiscoveredContact[],
  jobTitles: string[]
): number {
  return contacts.filter(
    (contact) =>
      isPlausiblePersonName(contact.fullName) &&
      (matchesJobTitle(contact.title, jobTitles) ||
        isRelatedDecisionMakerForJobTitles(contact.title, jobTitles) ||
        isExecutiveFallbackTitle(contact.title))
  ).length;
}

/** Cap results so one company cannot consume the entire people list. */
export function limitContactsPerCompany(
  contacts: DiscoveredContact[],
  maxPerCompany = MAX_CONTACTS_PER_COMPANY
): DiscoveredContact[] {
  const buckets = new Map<string, DiscoveredContact[]>();

  for (const contact of contacts) {
    const bucket = buckets.get(contact.companyId) ?? [];
    if (bucket.length >= maxPerCompany) continue;
    bucket.push(contact);
    buckets.set(contact.companyId, bucket);
  }

  return [...buckets.values()].flat();
}

/** Broader executive titles listed on company team/about pages. */
export const WEBSITE_DECISION_MAKER_TITLES = [
  "CEO",
  "CTO",
  "CFO",
  "COO",
  "CMO",
  "CPO",
  "CHRO",
  "Founder",
  "Co-Founder",
  "President",
  "Vice President",
  "VP",
  "Director",
  "Managing Director",
  "Executive Director",
  "Owner",
  "Partner",
  "Head of",
  "Chairman",
  "General Manager",
  "Manager",
] as const;

const NON_EXECUTIVE_REJECT =
  /\b(software engineer|engineer|developer|designer|analyst|intern|assistant|coordinator|specialist|recruiter|account executive|customer success|sales rep|support|technician|writer|editor|associate)\b/i;

/** Advisors, board, consultants, and former roles — not active decision-makers. */
const NON_DECISION_MAKER_REJECT =
  /\b(advisor|adviser|advisory board|board member|board of directors|non-executive director|independent director|consultant|consulting partner|internship|intern\b|fellow\b|volunteer|mentor|emeritus|honorary|retired|alumni|ex[-\s]employee|former\s+(ceo|cto|cfo|coo|founder|president|director))\b/i;

/** Operational managers — not executive decision-makers when only "Manager" is in the filter. */
const OPERATIONAL_MANAGER_REJECT =
  /\b(workshop|office|project|program|account|store|warehouse|shift|floor|area|department|hr|human resources|facilities|maintenance|production|plant|site|field|customer|client|community|content|social media|digital marketing|brand|events|logistics|supply chain|inventory|quality|safety|security)\s+manager\b/i;

const EXECUTIVE_MANAGER_PATTERN =
  /\b(general manager|managing manager|country manager|regional manager|national manager|global manager|business manager|sales manager|marketing manager|product manager|operations manager|engineering manager|finance manager)\b/i;

const EXECUTIVE_ROLE_ALIASES: Record<string, readonly string[]> = {
  ceo: ["ceo", "chief executive officer"],
  cto: [
    "cto",
    "chief technology officer",
    "chief technical officer",
    "vp engineering",
    "vice president of engineering",
    "vp of engineering",
    "head of technology",
    "head of engineering",
    "engineering director",
  ],
  cfo: ["cfo", "chief financial officer"],
  coo: ["coo", "chief operating officer"],
  cmo: ["cmo", "chief marketing officer"],
  cpo: ["cpo", "chief product officer"],
  chro: ["chro", "chief human resources officer"],
  founder: ["founder", "co-founder", "cofounder", "co founder"],
  president: ["president", "chairman", "chairperson"],
  director: [
    "director",
    "managing director",
    "executive director",
    "marketing director",
    "sales director",
    "it director",
  ],
  manager: [
    "general manager",
    "marketing manager",
    "product manager",
    "sales manager",
    "business manager",
    "operations manager",
    "regional manager",
    "country manager",
  ],
  owner: ["owner", "co-owner", "business owner", "proprietor"],
  "vice president": ["vice president", "vp"],
  svp: ["svp", "senior vice president"],
  evp: ["evp", "executive vice president"],
  vp: ["vp", "vice president", "vp engineering", "vp sales", "vp marketing", "vp product"],
  "vp engineering": [
    "vp engineering",
    "v.p. engineering",
    "vice president engineering",
    "vice president of engineering",
    "vice president, engineering",
    "vp of engineering",
    "v.p. of engineering",
    "svp engineering",
    "senior vice president engineering",
    "evp engineering",
    "executive vice president engineering",
  ],
  "head of growth": ["head of growth", "growth lead", "director of growth"],
  "head of": ["head of"],
  partner: ["partner"],
  chairman: ["chairman", "chairperson", "chairwoman", "chair", "founding chairman"],
  chairperson: ["chairperson", "chairman", "chairwoman"],
  deputy: ["deputy ceo", "deputy"],
};

function normalizeTitle(value: string): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function searchTargetsVpEngineering(jobTitles: string[]): boolean {
  return jobTitles.some((title) => {
    const normalized = normalizeTitle(title);
    return (
      normalized.includes("vp engineering") ||
      normalized.includes("vice president engineering") ||
      normalized === "vp eng" ||
      /\bvp\b.*\bengineering\b/.test(normalized)
    );
  });
}

/** VP Engineering and close equivalents (VP Technology, SVP Engineering, etc.). */
function matchesVpEngineeringTitle(normalized: string): boolean {
  return (
    /\bvp\b[^|]{0,40}\b(engineering|technology|tech|software|digital|it|platform|data)\b/i.test(
      normalized
    ) ||
    /\bvice president\b[^|]{0,40}\b(engineering|technology|tech|software|digital|it|platform|data)\b/i.test(
      normalized
    ) ||
    /\b(svp|evp|senior vice president|executive vice president)\b[^|]{0,40}\b(engineering|technology|tech)\b/i.test(
      normalized
    )
  );
}

/**
 * Roles closely related to the searched title — shown when the exact title is missing.
 * E.g. VP Engineering → CTO, Head of Engineering, Engineering Director.
 */
export function isRelatedDecisionMakerForJobTitles(
  title: string | null | undefined,
  jobTitles: string[]
): boolean {
  if (!title?.trim() || isUnknownTitle(title)) return false;

  const normalized = normalizeTitle(title);
  if (NON_DECISION_MAKER_REJECT.test(normalized)) return false;
  if (isNonExecutiveTitle(normalized)) return false;

  if (searchTargetsVpEngineering(jobTitles)) {
    if (matchesVpEngineeringTitle(normalized)) return true;
    return (
      /\b(cto|chief technology officer|chief technical officer|chief information officer)\b/i.test(
        normalized
      ) ||
      /\bhead of (engineering|technology|tech|software|it|digital|product|platform)\b/i.test(
        normalized
      ) ||
      /\b(engineering|technology|software|it|digital|platform|product)\s+director\b/i.test(
        normalized
      ) ||
      /\bdirector of (engineering|technology|software|it|digital|platform)\b/i.test(
        normalized
      ) ||
      /\bengineering manager\b/i.test(normalized) ||
      /\bvp\b[^|]{0,30}\b(product|platform)\b/i.test(normalized)
    );
  }

  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isUnknownTitle(contactTitle: string): boolean {
  return UNKNOWN_TITLES.has(normalizeTitle(contactTitle));
}

function isOperationalManagerTitle(normalized: string, targetTitles: string[]): boolean {
  if (!targetTitles.some((title) => normalizeTitle(title) === "manager")) {
    return false;
  }
  if (EXECUTIVE_MANAGER_PATTERN.test(normalized)) return false;
  if (OPERATIONAL_MANAGER_REJECT.test(normalized)) return true;
  if (/\bmanager\b/i.test(normalized) && !EXECUTIVE_MANAGER_PATTERN.test(normalized)) {
    return true;
  }
  return false;
}

function isNonExecutiveTitle(normalized: string): boolean {
  if (NON_DECISION_MAKER_REJECT.test(normalized)) return true;
  if (!NON_EXECUTIVE_REJECT.test(normalized)) return false;
  return !/\b(chief|founder|president|director|owner|vp|head of)\b/i.test(normalized);
}

function allowedExecutiveTitles(targetTitles: string[]): Set<string> {
  const effective =
    targetTitles.length > 0 ? targetTitles : [...DEFAULT_LEADERSHIP_TITLES];
  const allowed = new Set<string>();

  for (const target of effective) {
    const key = normalizeTitle(target);
    const aliases = EXECUTIVE_ROLE_ALIASES[key] ?? [key];
    for (const alias of aliases) {
      allowed.add(alias);
    }
  }

  return allowed;
}

function titleContainsRole(normalizedTitle: string, role: string): boolean {
  if (!role) return false;

  if (role.includes(" ")) {
    return normalizedTitle.includes(role);
  }

  return new RegExp(`\\b${escapeRegExp(role)}\\b`, "i").test(normalizedTitle);
}

export function isLeadershipTitle(title: string): boolean {
  return matchesJobTitle(title, [...DEFAULT_LEADERSHIP_TITLES]);
}

/** Executive / decision-maker titles scraped from a company website. */
export function isWebsiteDecisionMakerTitle(title: string | null | undefined): boolean {
  return isExecutiveFallbackTitle(title);
}

/**
 * Broad executive fallback when the searched job title is not on the team page.
 * Includes CEO, CFO, COO, Owner, Director, Manager, Founder, Co-Founder, President, etc.
 */
export function isExecutiveFallbackTitle(title: string | null | undefined): boolean {
  if (!title?.trim() || isUnknownTitle(title)) return false;

  const normalized = normalizeTitle(title);
  if (NON_DECISION_MAKER_REJECT.test(normalized)) return false;
  if (isNonExecutiveTitle(normalized)) return false;

  if (/\bchief\s+[\w\s]{0,24}\s+officer\b/i.test(normalized)) return true;

  for (const role of EXECUTIVE_FALLBACK_TITLES) {
    const key = normalizeTitle(role);
    if (key === "manager") {
      if (/\bmanager\b/i.test(normalized) && !OPERATIONAL_MANAGER_REJECT.test(normalized)) {
        return true;
      }
      continue;
    }
    if (titleContainsRole(normalized, key)) return true;
  }

  return (
    isLeadershipTitle(title) ||
    matchesJobTitle(title, [...WEBSITE_DECISION_MAKER_TITLES])
  );
}

/** Match contact titles against the job titles selected in the search. */
export function matchesJobTitle(
  contactTitle: string | null | undefined,
  targetTitles: string[]
): boolean {
  if (!contactTitle?.trim()) return false;
  if (isUnknownTitle(contactTitle)) return false;

  const normalized = normalizeTitle(contactTitle);
  if (isNonExecutiveTitle(normalized)) return false;
  if (isOperationalManagerTitle(normalized, targetTitles)) return false;

  if (searchTargetsVpEngineering(targetTitles) && matchesVpEngineeringTitle(normalized)) {
    return true;
  }

  const allowed = allowedExecutiveTitles(targetTitles);
  const roles = [...allowed].sort((a, b) => b.length - a.length);

  return roles.some((role) => titleContainsRole(normalized, role));
}

function contactDedupKey(contact: DiscoveredContact): string {
  return `${contact.companyId}|${contact.fullName.toLowerCase()}`;
}

function mergeLeaderTiers(
  plausible: DiscoveredContact[],
  jobTitles: string[]
): DiscoveredContact[] {
  const exact = plausible.filter((contact) => matchesJobTitle(contact.title, jobTitles));
  const exactKeys = new Set(exact.map(contactDedupKey));

  const related = plausible.filter(
    (contact) =>
      !exactKeys.has(contactDedupKey(contact)) &&
      isRelatedDecisionMakerForJobTitles(contact.title, jobTitles)
  );
  const relatedKeys = new Set(related.map(contactDedupKey));

  const executives = plausible.filter(
    (contact) =>
      !exactKeys.has(contactDedupKey(contact)) &&
      !relatedKeys.has(contactDedupKey(contact)) &&
      isExecutiveFallbackTitle(contact.title)
  );

  const seen = new Set<string>();
  const merged: DiscoveredContact[] = [];

  for (const contact of sortByDecisionMakerRank([...exact, ...related, ...executives])) {
    const key = contactDedupKey(contact);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(contact);
    if (merged.length >= MAX_CONTACTS_PER_COMPANY) break;
  }

  return merged;
}

export function applyTitleFilter(
  contacts: DiscoveredContact[],
  jobTitles: string[]
): {
  contacts: DiscoveredContact[];
  filteredCount: number;
  relaxedMatch: boolean;
} {
  const plausible = contacts.filter((contact) => isPlausiblePersonName(contact.fullName));
  const enriched = enrichContactTitles(plausible);
  let selected = mergeLeaderTiers(enriched, jobTitles);

  if (selected.length === 0 && jobTitles.length > 0) {
    selected = mergeLeaderTiers(
      enriched.map((contact) => {
        if (!isUnknownTitle(contact.title)) return contact;
        const fromContext = inferExecutiveTitleFromText(
          [contact.titleContext, contact.fullName, contact.sourceUrl].filter(Boolean).join(" ")
        );
        return fromContext ? { ...contact, title: fromContext } : contact;
      }),
      jobTitles
    );
  }

  if (selected.length === 0 && enriched.length > 0) {
    const executives = sortByDecisionMakerRank(
      enriched.filter(
        (contact) =>
          isExecutiveFallbackTitle(contact.title) ||
          isRelatedDecisionMakerForJobTitles(contact.title, jobTitles)
      )
    );
    selected = executives.slice(0, MAX_CONTACTS_PER_COMPANY);
  }

  if (selected.length === 0) {
    return {
      contacts: [],
      filteredCount: contacts.length,
      relaxedMatch: false,
    };
  }

  const relaxedMatch = selected.some(
    (contact) => !matchesJobTitle(contact.title, jobTitles)
  );

  return {
    contacts: selected,
    filteredCount: contacts.length - selected.length,
    relaxedMatch,
  };
}
