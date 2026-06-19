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

const TLD_COUNTRY_HINTS: Record<string, string> = {
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
  co: "colombia",
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

/** True when company location text refers to the target country. */
export function textMentionsCountry(text: string, targetCountry: string): boolean {
  const target = normalizeCountryName(targetCountry);
  if (!target) return false;

  const lower = text.toLowerCase();
  if (lower.includes(target)) return true;

  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    if (canonical === target && lower.includes(alias)) return true;
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

  if (normalizedCompany) {
    if (normalizedCompany === target) return true;
    if (normalizedCompany.includes(target) || target.includes(normalizedCompany)) {
      return true;
    }
  }

  const combined = [hints?.description, hints?.domain].filter(Boolean).join(" ");
  if (combined && textMentionsCountry(combined, targetCountry)) return true;

  const domainHint = countryHintFromDomain(hints?.domain ?? null);
  if (domainHint && (domainHint === target || domainHint.includes(target) || target.includes(domainHint))) {
    return true;
  }

  return false;
}
