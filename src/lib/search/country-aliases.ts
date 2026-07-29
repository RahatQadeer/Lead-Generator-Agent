/** Normalize country names and common abbreviations for filter matching. */

const COUNTRY_ALIASES: Record<string, string> = {
  us: "united states",
  usa: "united states",
  "u.s.": "united states",
  "u.s.a.": "united states",
  america: "united states",
  uk: "united kingdom",
  "u.k.": "united kingdom",
  britain: "united kingdom",
  england: "united kingdom",
  uae: "united arab emirates",
  emirates: "united arab emirates",
  pk: "pakistan",
  aus: "australia",
  nz: "new zealand",
  de: "germany",
  fr: "france",
  es: "spain",
  it: "italy",
  nl: "netherlands",
  br: "brazil",
  mx: "mexico",
  ca: "canada",
  in: "india",
  cn: "china",
  jp: "japan",
  kr: "south korea",
  sg: "singapore",
  sa: "saudi arabia",
  za: "south africa",
  ng: "nigeria",
  ke: "kenya",
  bd: "bangladesh",
  lk: "sri lanka",
  np: "nepal",
};

// Only registration-gated ccTLDs belong here — this is treated as strong evidence
// of location. Generic-use TLDs (.co, .io, .ai, .me) are deliberately absent: they
// are sold worldwide and say nothing about where a company actually is.
const TLD_COUNTRY_HINTS: Record<string, string> = {
  us: "united states",
  pk: "pakistan",
  uk: "united kingdom",
  de: "germany",
  fr: "france",
  au: "australia",
  nz: "new zealand",
  in: "india",
  br: "brazil",
  mx: "mexico",
  ca: "canada",
  sg: "singapore",
  ae: "united arab emirates",
  sa: "saudi arabia",
  za: "south africa",
  ng: "nigeria",
  ke: "kenya",
  bd: "bangladesh",
  lk: "sri lanka",
  np: "nepal",
  ie: "ireland",
  nl: "netherlands",
  es: "spain",
  it: "italy",
  ch: "switzerland",
  se: "sweden",
  no: "norway",
  dk: "denmark",
  pl: "poland",
  tr: "turkey",
  eg: "egypt",
  id: "indonesia",
  my: "malaysia",
  ph: "philippines",
  th: "thailand",
  vn: "vietnam",
  ar: "argentina",
  cl: "chile",
  ao: "angola",
};

export function normalizeCountryName(country: string): string {
  const normalized = country.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return COUNTRY_ALIASES[normalized] ?? normalized;
}

export function countryHintFromDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const host = domain.toLowerCase().replace(/^www\./, "");
  const parts = host.split(".");
  if (parts.length < 2) return null;

  const tld = parts[parts.length - 1];
  if (tld.length === 2 && TLD_COUNTRY_HINTS[tld]) {
    return TLD_COUNTRY_HINTS[tld];
  }

  if (tld === "uk" && parts[parts.length - 2] === "co") {
    return "united kingdom";
  }

  return null;
}

/**
 * Aliases safe to search for inside free-form prose. Deliberately excludes the
 * short ISO codes in COUNTRY_ALIASES: as substrings they match ordinary English
 * ("business"/"industry" contain "us"; "in", "it", "ca", "de" and "sa" are worse),
 * and even as whole words they collide with common copy ("about us", "contact us",
 * "IT services"). Those codes stay usable for normalizing a dedicated country
 * field, where the whole string is known to be a country.
 */
const TEXT_SAFE_ALIASES: Record<string, string> = {
  usa: "united states",
  "u.s.": "united states",
  "u.s.a.": "united states",
  america: "united states",
  american: "united states",
  uk: "united kingdom",
  "u.k.": "united kingdom",
  britain: "united kingdom",
  british: "united kingdom",
  england: "united kingdom",
  uae: "united arab emirates",
  emirates: "united arab emirates",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word (not substring) match, tolerating dotted forms like "u.s.". */
function mentionsToken(lowerText: string, token: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}([^a-z0-9]|$)`, "i").test(lowerText);
}

/** True when company location text refers to the target country. */
export function textMentionsCountry(text: string, targetCountry: string): boolean {
  const target = normalizeCountryName(targetCountry);
  if (!target) return false;

  const lower = text.toLowerCase();
  if (mentionsToken(lower, target)) return true;

  for (const [alias, canonical] of Object.entries(TEXT_SAFE_ALIASES)) {
    if (canonical === target && mentionsToken(lower, alias)) return true;
  }

  return false;
}

export function countriesMatch(
  companyCountry: string | null | undefined,
  targetCountry: string,
  hints?: { domain?: string | null; description?: string | null }
): boolean {
  if (!targetCountry.trim()) return true;

  const target = normalizeCountryName(targetCountry);
  const normalizedCompany = normalizeCountryName(companyCountry ?? "");

  const sameCountry = (candidate: string) =>
    candidate === target || candidate.includes(target) || target.includes(candidate);

  // A known country is authoritative — decide on it alone. Falling through to the
  // fuzzier signals below let a Pakistani company match a US search because its
  // homepage copy happened to mention America.
  if (normalizedCompany) return sameCountry(normalizedCompany);

  // Country-code TLDs are registration-gated, so they're the next best evidence.
  const domainHint = countryHintFromDomain(hints?.domain ?? null);
  if (domainHint) return sameCountry(domainHint);

  // Last resort: prose. Weakest signal, so only consulted when nothing else knows.
  const combined = [hints?.description, hints?.domain].filter(Boolean).join(" ");
  if (combined && textMentionsCountry(combined, targetCountry)) return true;

  // Nothing locates this company. Treat unknown as "not contradicted" rather than
  // a mismatch — the same convention as unknown industry/size — and let the fit
  // score down-rank it. Rejecting here would drop most web-search seeds, whose
  // country is only ever inferred.
  return true;
}
