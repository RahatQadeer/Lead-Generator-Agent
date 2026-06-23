import { personNameAppearsInText } from "@/lib/scraping/contact-name-match";

const GENERIC_EMAIL_LOCALS = new Set([
  "info",
  "contact",
  "hello",
  "hi",
  "support",
  "help",
  "sales",
  "marketing",
  "press",
  "media",
  "admin",
  "office",
  "team",
  "careers",
  "jobs",
  "hr",
  "billing",
  "accounts",
  "enquiries",
  "inquiries",
  "noreply",
  "no-reply",
  "donotreply",
  "webmaster",
  "postmaster",
  "abuse",
  "feedback",
  "customerservice",
  "customer.service",
  "ceo",
  "cfo",
  "cto",
  "coo",
  "cmo",
  "cpo",
  "chro",
  "president",
  "founder",
  "chairman",
  "chairperson",
  "director",
  "executive",
  "management",
  "corporate",
  "general",
  "reception",
  "enquiry",
  "inquiry",
  "ir",
  "investor",
  "investors",
  "partners",
  "partner",
  "relations",
]);

const PLACEHOLDER_EMAIL_PATTERNS = [
  /example\.com$/i,
  /test\.com$/i,
  /domain\.com$/i,
  /yourcompany\.com$/i,
  /company\.com$/i,
  /email@/i,
  /name@/i,
  /user@/i,
  /@sentry\./i,
  /\.png$/i,
  /\.jpg$/i,
  /^xxx@/i,
  /^sample@/i,
];

export function isGenericCompanyEmail(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase().replace(/[._-]/g, "") ?? "";
  if (!local) return true;
  if (GENERIC_EMAIL_LOCALS.has(local)) return true;
  return GENERIC_EMAIL_LOCALS.has(local.replace(/\d/g, ""));
}

export function isPlaceholderEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return true;
  return PLACEHOLDER_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function nameParts(fullName: string): { first: string; last: string } {
  const parts = fullName
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z]/g, ""))
    .filter((part) => part.length > 1);

  return {
    first: parts[0] ?? "",
    last: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

/** True when the mailbox local-part looks like it belongs to this person. */
export function emailMatchesPersonName(email: string, fullName: string): boolean {
  const local = email.split("@")[0]?.toLowerCase().replace(/[._+-]/g, "") ?? "";
  if (!local || local.length < 2) return false;

  const { first, last } = nameParts(fullName);
  if (!first) return false;

  const variants = new Set<string>([
    first,
    last,
    `${first}${last}`,
    `${first[0]}${last}`,
    last ? `${first[0]}${last[0]}` : "",
  ].filter(Boolean));

  for (const variant of variants) {
    if (variant.length >= 2 && local === variant) return true;
  }

  if (last && local.includes(first) && local.includes(last)) return true;
  if (!last && local === first) return true;

  return false;
}

export interface PickPersonalEmailOptions {
  source?: "page" | "pattern" | "mailto";
  allowGuessed?: boolean;
}

/**
 * Accept only personal emails — never info@, contact@, or unrelated addresses.
 */
export function pickPersonalContactEmail(
  fullName: string,
  email: string | null | undefined,
  options: PickPersonalEmailOptions = {}
): { email: string | null; emailIsGuessed: boolean } {
  if (!email?.trim()) return { email: null, emailIsGuessed: false };

  const normalized = email.trim().toLowerCase();
  if (isPlaceholderEmail(normalized) || isGenericCompanyEmail(normalized)) {
    return { email: null, emailIsGuessed: false };
  }

  if (options.source === "mailto") {
    if (emailMatchesPersonName(normalized, fullName)) {
      return { email: normalized, emailIsGuessed: false };
    }
    return { email: null, emailIsGuessed: false };
  }

  if (options.allowGuessed || options.source === "pattern") {
    if (emailMatchesPersonName(normalized, fullName)) {
      return { email: normalized, emailIsGuessed: true };
    }
    return { email: null, emailIsGuessed: false };
  }

  if (emailMatchesPersonName(normalized, fullName)) {
    return { email: normalized, emailIsGuessed: false };
  }

  return { email: null, emailIsGuessed: false };
}

/** Pick the best personal email from scraped candidates for one person. */
export function pickBestPersonalEmail(
  fullName: string,
  mailto: string | null,
  candidates: string[]
): string | null {
  if (mailto) {
    const fromMailto = pickPersonalContactEmail(fullName, mailto, { source: "mailto" });
    if (fromMailto.email) return fromMailto.email;
  }

  for (const candidate of candidates) {
    const picked = pickPersonalContactEmail(fullName, candidate);
    if (picked.email) return picked.email;
  }

  return null;
}

const NON_PERSON_NAME_PATTERNS = [
  /^our (mission|vision|values|journey|legacy|team|people|story|history|culture)$/i,
  /^(corporate office|advertise|subscribe|follow us|know more|insights|how we|work at|featured episode)$/i,
  /^(courage|collaboration|growth|innovation|agility|leadership|upcoming events)$/i,
  /^(redefining|revolutionizing|enabling|entering|innovating|conversations with)/i,
  /unlocking brand/i,
  /^are you looking/i,
  /^(fever fm|punjabi fever|radio nasha|radio one)$/i,
  /^(linkedin|profile|unknown|team|staff|contact us|get in touch|read more)$/i,
  /^(privacy policy|terms of service|cookie policy)$/i,
  /^(partner|sales|customer|technical|general|media|press)\s+(enquiry|inquiry|request|information)$/i,
  /^your\b/i,
  /^our\b.+\b(partner|solutions|services)\b/i,
  /\b(product modernization|digital transformation|trusted partner)\b/i,
];

/** Website hero copy and taglines — not person names. */
export function looksLikeMarketingTagline(value: string): boolean {
  const cleaned = value.trim();
  if (!cleaned) return false;
  if (/^(your|our|we are|the leading)\b/i.test(cleaned)) return true;
  if (/\b(modernization|transformation)\b/i.test(cleaned) && /\bpartner\b/i.test(cleaned)) {
    return true;
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;

  const marketingWord =
    /\b(your|product|modernization|digital|transformation|trusted|leading|innovation|solutions|services|partner|provider|empowering|delivering|technology)\b/i;
  const hits = words.filter((word) => marketingWord.test(word)).length;
  return hits >= 2;
}

const COMPANY_SUFFIX_TOKENS =
  /^(inc|llc|ltd|corp|company|solutions|services|team|department|gmbh|ag|sa|bv)$/i;

/** Reject page headings and junk parsed as person names. */
export function isPlausiblePersonName(value: string): boolean {
  const cleaned = value
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/^(?:prof(?:essor)?\.?|dr\.?|mr\.?|mrs\.?|ms\.?|miss)\s+/gi, "")
    .trim();
  if (cleaned.length < 3 || cleaned.length > 60) return false;
  if (NON_PERSON_NAME_PATTERNS.some((pattern) => pattern.test(cleaned))) return false;
  if (looksLikeMarketingTagline(cleaned)) return false;

  const titleCased = cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

  if (!/^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3}$/.test(titleCased)) {
    return false;
  }

  return !/(inc|llc|ltd|corp|company|solutions|services|team|department)$/i.test(cleaned);
}

export function linkedinSlugFromUrl(url: string): string | null {
  const match = url.match(/\/in\/([a-z0-9_-]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function linkedinCompanySlugFromUrl(url: string): string | null {
  const match = url.match(/\/company\/([a-z0-9_-]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function linkedinCompanySlugMatches(
  slug: string,
  companyName: string,
  domain?: string | null
): boolean {
  const slugNorm = slug.toLowerCase().replace(/-/g, "");
  const tokens = companyName
    .toLowerCase()
    .split(/[\s,.-]+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 3 && !COMPANY_SUFFIX_TOKENS.test(token));

  if (
    tokens.some(
      (token) =>
        slugNorm === token || slugNorm.includes(token) || token.includes(slugNorm)
    )
  ) {
    return true;
  }

  const domainRoot = domain?.replace(/^www\./, "").split(".")[0]?.toLowerCase();
  if (
    domainRoot &&
    domainRoot.length >= 3 &&
    (slugNorm === domainRoot || slugNorm.includes(domainRoot))
  ) {
    return true;
  }

  return false;
}

/** Reject LinkedIn /in/ slugs that are clearly a company brand, not a person. */
export function isLinkedInSlugLikelyCompany(slug: string, companyName: string): boolean {
  const normalizedSlug = slug.toLowerCase().replace(/-/g, "");
  const tokens = companyName
    .toLowerCase()
    .split(/[\s,.-]+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 4 && !/^(inc|llc|ltd|corp|company|group|the|and)$/i.test(token));

  return tokens.some(
    (token) => normalizedSlug === token || normalizedSlug.startsWith(token) || token.startsWith(normalizedSlug)
  );
}

/** Personal /in/ URL should relate to the contact name, not the company brand. */
export function linkedinProfileMatchesPerson(
  url: string,
  fullName: string,
  companyName?: string
): boolean {
  if (!isValidPersonLinkedInUrl(url)) return false;

  const slug = linkedinSlugFromUrl(url);
  if (!slug) return false;

  if (companyName && isLinkedInSlugLikelyCompany(slug, companyName)) {
    return false;
  }

  const { first, last } = nameParts(fullName);
  if (!first) return false;

  const slugNorm = slug.replace(/-/g, "");
  const lastNorm = last.replace(/\s+/g, "");

  const tokens = fullName
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z]/g, ""))
    .filter((part) => part.length > 1);

  if (tokens.length >= 2 && tokens.every((token) => slugNorm.includes(token))) {
    return true;
  }

  if (last) {
    if (slug.includes(`${first}-${last}`) || slug.includes(`${first}-${lastNorm}`)) {
      return true;
    }
    if (slugNorm.includes(first) && slugNorm.includes(lastNorm)) return true;
    return false;
  }

  return slugNorm === first || slug === first;
}

export function sanitizePersonLinkedInForContact(
  url: string | null | undefined,
  fullName: string,
  companyName?: string
): string | null {
  const sanitized = sanitizePersonLinkedInUrl(url);
  if (!sanitized) return null;
  if (!linkedinProfileMatchesPerson(sanitized, fullName, companyName)) return null;
  return sanitized;
}

/** Keep a LinkedIn URL when search results already confirm the person's name. */
export function sanitizePersonLinkedInFromSearchHit(
  url: string | null | undefined,
  fullName: string,
  companyName: string,
  hitText: string
): string | null {
  const sanitized = sanitizePersonLinkedInUrl(url);
  if (!sanitized) return null;

  if (personNameAppearsInText(fullName, hitText)) {
    if (linkedinProfileMatchesPerson(sanitized, fullName, companyName)) {
      return sanitized;
    }

    const companyToken = companyName
      .toLowerCase()
      .split(/[\s,.-]+/)
      .map((part) => part.replace(/[^a-z0-9]/g, ""))
      .find((part) => part.length >= 4);

    if (companyToken && hitText.toLowerCase().includes(companyToken)) {
      return sanitized;
    }
  }

  return sanitizePersonLinkedInForContact(sanitized, fullName, companyName);
}

export function isValidPersonLinkedInUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, "");
    if (!host.endsWith("linkedin.com")) return false;
    return /\/in\/[a-z0-9_-]+/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isValidCompanyLinkedInUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, "");
    if (!host.endsWith("linkedin.com")) return false;
    if (/\/school\//i.test(parsed.pathname)) return false;
    return /\/company\/[a-z0-9_-]+/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function sanitizePersonLinkedInUrl(url: string | null | undefined): string | null {
  if (!isValidPersonLinkedInUrl(url)) return null;
  try {
    const parsed = new URL(url!.startsWith("http") ? url! : `https://${url}`);
    const match = parsed.pathname.match(/\/in\/[a-z0-9_-]+/i);
    if (!match) return null;
    return `https://www.linkedin.com${match[0].toLowerCase()}`;
  } catch {
    return null;
  }
}

export function sanitizeCompanyLinkedInUrl(url: string | null | undefined): string | null {
  if (!isValidCompanyLinkedInUrl(url)) return null;
  try {
    const parsed = new URL(url!.startsWith("http") ? url! : `https://${url}`);
    const match = parsed.pathname.match(/\/company\/[a-z0-9_-]+/i);
    if (!match) return null;
    return `https://www.linkedin.com${match[0].toLowerCase()}`;
  } catch {
    return null;
  }
}

/** Company /company/ URL must match the business name or domain — not a random footer link. */
export function sanitizeCompanyLinkedInForCompany(
  url: string | null | undefined,
  companyName: string,
  domain?: string | null
): string | null {
  const sanitized = sanitizeCompanyLinkedInUrl(url);
  if (!sanitized) return null;
  const slug = linkedinCompanySlugFromUrl(sanitized);
  if (!slug || !linkedinCompanySlugMatches(slug, companyName, domain)) return null;
  return sanitized;
}

/** Accept a public business mailbox from a company contact page (info@, sales@, etc.). */
export function pickPublicBusinessEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const normalized = email.trim().toLowerCase();
  if (isPlaceholderEmail(normalized)) return null;
  return normalized;
}

export function pickContactEmail(
  email: string | null | undefined,
  source: "page" | "pattern",
  fullName?: string
): { email: string | null; emailIsGuessed: boolean } {
  if (!fullName) {
    if (!email?.trim()) return { email: null, emailIsGuessed: false };
    const normalized = email.trim().toLowerCase();
    if (isPlaceholderEmail(normalized) || isGenericCompanyEmail(normalized)) {
      return { email: null, emailIsGuessed: false };
    }
    if (source === "pattern") return { email: null, emailIsGuessed: true };
    return { email: normalized, emailIsGuessed: false };
  }

  return pickPersonalContactEmail(fullName, email, {
    source,
    allowGuessed: source === "pattern",
  });
}

export type ContactQualityTier = "high" | "medium" | "low";

/** High = personal work email; medium = LinkedIn; low = generic inbox. */
export function classifyContactQuality(input: {
  email: string | null;
  fullName?: string;
  linkedinUrl?: string | null;
}): ContactQualityTier {
  if (input.email?.trim()) {
    const normalized = input.email.trim().toLowerCase();
    if (isPlaceholderEmail(normalized)) {
      return input.linkedinUrl ? "medium" : "low";
    }
    if (isGenericCompanyEmail(normalized)) {
      return "low";
    }
    if (input.fullName && pickPersonalContactEmail(input.fullName, normalized).email) {
      return "high";
    }
    return "low";
  }

  if (input.linkedinUrl?.trim()) {
    return "medium";
  }

  return "low";
}
