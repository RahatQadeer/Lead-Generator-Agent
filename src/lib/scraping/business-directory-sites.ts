import * as cheerio from "cheerio";
import { countryToIsoCode } from "@/lib/search/jurisdiction-codes";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import { sanitizeCompanyLinkedInUrl } from "@/lib/scraping/data-quality";
import {
  parseCompanyMetadata,
  type ParsedCompanyMetadata,
} from "@/lib/scraping/parse-html";

export type BusinessDirectoryId =
  | "hotfrog"
  | "manta"
  | "brownbook"
  | "cylex"
  | "kompass"
  | "clutch"
  | "chamber"
  | "goodfirms"
  | "europages";

export interface BusinessDirectorySite {
  id: BusinessDirectoryId;
  label: string;
  domains: string[];
  /** Match listing/profile URLs (not search-index pages). */
  profilePathPattern: RegExp;
  /** Paths to skip even when they match the host. */
  excludePathPattern?: RegExp;
}

export const BUSINESS_DIRECTORY_SITES: BusinessDirectorySite[] = [
  {
    id: "hotfrog",
    label: "Hotfrog",
    domains: [
      "hotfrog.com",
      "hotfrog.co.uk",
      "hotfrog.com.au",
      "hotfrog.ie",
      "hotfrog.ca",
      "hotfrog.in",
    ],
    profilePathPattern: /\/(company|biz)\/[^/?#]+/i,
    excludePathPattern: /\/(search|category|login|register)\b/i,
  },
  {
    id: "manta",
    label: "Manta",
    domains: ["manta.com"],
    profilePathPattern: /\/c\/[a-z0-9]+\/[^/?#]+/i,
    excludePathPattern: /\/(search|sb)\b/i,
  },
  {
    id: "brownbook",
    label: "Brownbook",
    domains: ["brownbook.net"],
    profilePathPattern: /\/business\/\d+/i,
    excludePathPattern: /\/(search|add-business)\b/i,
  },
  {
    id: "cylex",
    label: "Cylex",
    domains: ["cylex.us", "cylex-uk.co.uk", "cylex-locale.fr", "cylex.de", "cylex.ca"],
    profilePathPattern: /\/company\/[^/?#]+/i,
    excludePathPattern: /\/(search|suche)\b/i,
  },
  {
    id: "kompass",
    label: "Kompass",
    domains: ["kompass.com", "us.kompass.com", "gb.kompass.com"],
    profilePathPattern: /\/c\/[^/?#]+/i,
    excludePathPattern: /\/(search|directory)\b/i,
  },
  {
    id: "clutch",
    label: "Clutch",
    domains: ["clutch.co"],
    profilePathPattern: /\/profile\/[^/?#]+/i,
    excludePathPattern: /\/(search|agencies|directory)\b/i,
  },
  {
    id: "chamber",
    label: "Chamber of Commerce",
    domains: [
      "uschamber.com",
      "britishchambers.org.uk",
      "chamberofcommerce.com",
      "cochamber.org",
      "uschamber.com",
    ],
    profilePathPattern:
      /\/(member|members|business|company|directory|listing|profile)\/[^/?#]+/i,
    excludePathPattern: /\/(news|blog|events|about|join|login)\b/i,
  },
  {
    id: "goodfirms",
    label: "GoodFirms",
    domains: ["goodfirms.co"],
    profilePathPattern:
      /\/(profile|[a-z-]+-companies|[a-z-]+-agencies|[a-z-]+-developers)\/[^/?#]+/i,
    excludePathPattern: /\/(search|blog|research|press|login|register)\b/i,
  },
  {
    id: "europages",
    label: "Europages",
    domains: ["europages.co.uk", "europages.com", "europages.de", "europages.fr", "europages.es"],
    profilePathPattern: /\/en\/(companies|suppliers|company)\/[^/?#]+/i,
    excludePathPattern: /\/(search|blog|login|register|news)\b/i,
  },
];

const SOCIAL_HOSTS = [
  "linkedin.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "youtube.com",
  "pinterest.com",
];

export interface BusinessDirectorySocialLinks {
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  instagram: string | null;
}

export interface BusinessDirectoryListing {
  name: string;
  website: string | null;
  phone: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
  socialLinks: BusinessDirectorySocialLinks;
  domain: string | null;
  profileUrl: string;
  source: BusinessDirectoryId;
  completenessScore: number;
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function matchBusinessDirectorySite(url: string): BusinessDirectorySite | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = normalizeHost(parsed.hostname);
    const path = parsed.pathname;

    for (const site of BUSINESS_DIRECTORY_SITES) {
      const hostMatch = site.domains.some(
        (domain) => host === domain || host.endsWith(`.${domain}`)
      );
      if (!hostMatch) continue;
      if (site.excludePathPattern?.test(path)) continue;
      if (site.profilePathPattern.test(path)) return site;
    }
  } catch {
    return null;
  }
  return null;
}

/** Chamber listings often live on local chamber subdomains. */
export function isChamberProfileUrl(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = normalizeHost(parsed.hostname);
    const path = parsed.pathname;
    if (!host.includes("chamber")) return false;
    if (/(news|blog|events|login|join)\b/i.test(path)) return false;
    return /\/(member|members|business|company|directory|listing|profile)\//i.test(path);
  } catch {
    return false;
  }
}

export function isBusinessDirectoryProfileUrl(url: string): boolean {
  return matchBusinessDirectorySite(url) !== null || isChamberProfileUrl(url);
}

function parseJsonLdBlocks(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const blocks: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html()?.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") blocks.push(item as Record<string, unknown>);
        }
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>);
        const graph = (parsed as { "@graph"?: unknown[] })["@graph"];
        if (Array.isArray(graph)) {
          for (const item of graph) {
            if (item && typeof item === "object") blocks.push(item as Record<string, unknown>);
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  return blocks;
}

function isOrganizationType(typeValue: unknown): boolean {
  const types = Array.isArray(typeValue) ? typeValue : [typeValue];
  return types.some((type) =>
    /^(Organization|LocalBusiness|Corporation|ProfessionalService)$/i.test(String(type))
  );
}

function readJsonLdString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

function readJsonLdAddress(block: Record<string, unknown>): string | null {
  const address = block.address;
  if (typeof address === "string" && address.trim()) return address.trim();
  if (!address || typeof address !== "object") return null;

  const parts = [
    (address as { streetAddress?: string }).streetAddress,
    (address as { addressLocality?: string }).addressLocality,
    (address as { addressRegion?: string }).addressRegion,
    (address as { postalCode?: string }).postalCode,
    (address as { addressCountry?: string }).addressCountry,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function extractFromJsonLd(html: string): {
  name: string | null;
  website: string | null;
  phone: string | null;
  location: string | null;
  city: string | null;
  description: string | null;
} {
  for (const block of parseJsonLdBlocks(html)) {
    if (!isOrganizationType(block["@type"])) continue;

    const name = readJsonLdString(block.name);
    const website = readJsonLdString(block.url);
    const phone = readJsonLdString(block.telephone);
    const location = readJsonLdAddress(block);
    const city =
      block.address && typeof block.address === "object"
        ? readJsonLdString((block.address as { addressLocality?: string }).addressLocality)
        : null;
    const description = readJsonLdString(block.description);

    if (name || website || phone || location || description) {
      return { name, website, phone, location, city, description };
    }
  }

  return {
    name: null,
    website: null,
    phone: null,
    location: null,
    city: null,
    description: null,
  };
}

function isSocialUrl(url: string): boolean {
  try {
    const host = normalizeHost(new URL(url).hostname);
    return SOCIAL_HOSTS.some((social) => host === social || host.endsWith(`.${social}`));
  } catch {
    return false;
  }
}

function extractWebsiteFromPage(html: string, directoryHost: string): string | null {
  const $ = cheerio.load(html);
  const blockedHosts = new Set([
    directoryHost,
    ...BUSINESS_DIRECTORY_SITES.flatMap((site) => site.domains),
    ...SOCIAL_HOSTS,
  ]);

  const candidates: string[] = [];

  const pushCandidate = (href: string | undefined) => {
    if (!href?.trim()) return;
    if (!/^https?:\/\//i.test(href)) return;
    const domain = extractDomainFromUrl(href);
    if (!domain || blockedHosts.has(domain)) return;
    if (isSocialUrl(href)) return;
    candidates.push(href);
  };

  $('a[itemprop="url"], link[itemprop="url"]').each((_, el) => {
    pushCandidate($(el).attr("href"));
  });

  $("a[href^='http']").each((_, el) => {
    const href = $(el).attr("href");
    const label = $(el).text().trim().toLowerCase();
    const cls = ($(el).attr("class") ?? "").toLowerCase();
    if (
      label.includes("website") ||
      label.includes("visit") ||
      cls.includes("website") ||
      cls.includes("web-site")
    ) {
      pushCandidate(href);
    }
  });

  $("a[href^='http']").each((_, el) => {
    pushCandidate($(el).attr("href"));
  });

  return candidates[0] ?? null;
}

function extractPhoneFromPage(html: string): string | null {
  const $ = cheerio.load(html);
  const tel = $("a[href^='tel:']").first().attr("href");
  if (tel) {
    const digits = tel.replace(/^tel:/i, "").trim();
    if (digits) return digits;
  }

  const itemprop = $("[itemprop='telephone']").first().text().trim();
  if (itemprop) return itemprop;

  return null;
}

function extractLocationFromPage(html: string): string | null {
  const $ = cheerio.load(html);
  const address =
    $("[itemprop='address']").text().trim() ||
    $("[itemprop='streetAddress']").text().trim() ||
    $(".address").first().text().trim() ||
    $(".location").first().text().trim();

  return address ? address.replace(/\s+/g, " ").slice(0, 200) : null;
}

function extractNameFromPage(html: string, fallbackTitle: string | null): string | null {
  const $ = cheerio.load(html);
  const fromItemprop = $("[itemprop='name']").first().text().trim();
  if (fromItemprop) return fromItemprop;

  const h1 = $("h1").first().text().trim();
  if (h1 && h1.length <= 120) return h1;

  const ogTitle = $("meta[property='og:title']").attr("content")?.trim();
  if (ogTitle) return ogTitle.split("|")[0]?.trim() ?? ogTitle;

  return fallbackTitle;
}

function mergeSocialLinks(
  fromMeta: ParsedCompanyMetadata["socialLinks"],
  html: string
): BusinessDirectorySocialLinks {
  const $ = cheerio.load(html);
  const instagram =
    $("a[href*='instagram.com']").first().attr("href")?.trim() ?? null;

  return {
    linkedin: sanitizeCompanyLinkedInUrl(fromMeta.linkedin),
    twitter: fromMeta.twitter,
    facebook: fromMeta.facebook,
    instagram,
  };
}

/** Score how complete a directory listing is (0–100). */
export function scoreListingCompleteness(listing: {
  name: string;
  website: string | null;
  phone: string | null;
  location: string | null;
  description: string | null;
  socialLinks: BusinessDirectorySocialLinks;
}): number {
  let score = 10;
  if (listing.name.trim().length >= 2) score += 10;
  if (listing.website) score += 20;
  if (listing.phone) score += 15;
  if (listing.location) score += 15;
  if (listing.description && listing.description.length > 40) score += 20;
  else if (listing.description) score += 8;

  const socialCount = Object.values(listing.socialLinks).filter(Boolean).length;
  score += Math.min(15, socialCount * 5);

  return Math.min(100, score);
}

export function parseBusinessDirectoryProfile(
  html: string,
  profileUrl: string,
  source: BusinessDirectoryId,
  fallbackTitle: string | null
): BusinessDirectoryListing | null {
  let directoryHost = "";
  try {
    directoryHost = normalizeHost(new URL(profileUrl).hostname);
  } catch {
    return null;
  }

  const jsonLd = extractFromJsonLd(html);
  const website =
    jsonLd.website ??
    extractWebsiteFromPage(html, directoryHost);
  const domain = website ? extractDomainFromUrl(website) : null;
  const metadata = domain ? parseCompanyMetadata(html, domain) : parseCompanyMetadata(html, directoryHost);

  const name =
    jsonLd.name ??
    extractNameFromPage(html, fallbackTitle) ??
    metadata.title ??
    fallbackTitle;

  if (!name?.trim()) return null;

  const phone = jsonLd.phone ?? extractPhoneFromPage(html) ?? metadata.phones[0] ?? null;
  const location = jsonLd.location ?? extractLocationFromPage(html);
  const city = jsonLd.city;
  const ogDescription = cheerio.load(html)("meta[property='og:description']").attr("content")?.trim();
  const description =
    jsonLd.description ??
    metadata.description ??
    ogDescription ??
    null;

  const socialLinks = mergeSocialLinks(metadata.socialLinks, html);

  const listing: BusinessDirectoryListing = {
    name: name.trim(),
    website: website?.trim() ?? null,
    phone: phone?.trim() ?? null,
    location: location?.trim() ?? null,
    city: city?.trim() ?? null,
    country: null,
    description: description?.trim().slice(0, 500) ?? null,
    socialLinks,
    domain,
    profileUrl,
    source,
    completenessScore: 0,
  };

  listing.completenessScore = scoreListingCompleteness(listing);
  return listing;
}

function normalizeDedupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Deduplicate listings by domain, then by normalized name + city. */
export function dedupeBusinessDirectoryListings(
  listings: BusinessDirectoryListing[]
): BusinessDirectoryListing[] {
  const byDomain = new Map<string, BusinessDirectoryListing>();
  const byNameCity = new Map<string, BusinessDirectoryListing>();

  for (const listing of listings) {
    if (listing.domain) {
      const existing = byDomain.get(listing.domain);
      if (!existing || listing.completenessScore > existing.completenessScore) {
        byDomain.set(listing.domain, listing);
      }
      continue;
    }

    const key = `${normalizeDedupKey(listing.name)}|${(listing.city ?? listing.location ?? "").toLowerCase()}`;
    const existing = byNameCity.get(key);
    if (!existing || listing.completenessScore > existing.completenessScore) {
      byNameCity.set(key, listing);
    }
  }

  const merged = new Map<string, BusinessDirectoryListing>();
  for (const listing of [...byDomain.values(), ...byNameCity.values()]) {
    const key = listing.domain ?? `${normalizeDedupKey(listing.name)}|${listing.profileUrl}`;
    const existing = merged.get(key);
    if (!existing || listing.completenessScore > existing.completenessScore) {
      merged.set(key, listing);
    }
  }

  return [...merged.values()];
}

/** Rank listings by data completeness (highest first). */
export function rankListingsByCompleteness(
  listings: BusinessDirectoryListing[]
): BusinessDirectoryListing[] {
  return [...listings].sort((a, b) => {
    if (b.completenessScore !== a.completenessScore) {
      return b.completenessScore - a.completenessScore;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Prefer regional Hotfrog domains when the target country has a local listing site. */
export function pickHotfrogDomainsForCountry(country: string): string[] {
  const iso = countryToIsoCode(country.trim())?.toLowerCase();
  const byIso: Record<string, string[]> = {
    pk: ["hotfrog.com", "hotfrog.in"],
    in: ["hotfrog.in", "hotfrog.com"],
    gb: ["hotfrog.co.uk", "hotfrog.com"],
    au: ["hotfrog.com.au", "hotfrog.com"],
    ca: ["hotfrog.ca", "hotfrog.com"],
    ie: ["hotfrog.ie", "hotfrog.com"],
  };
  if (iso && byIso[iso]) return byIso[iso];
  return ["hotfrog.com", "hotfrog.co.uk", "hotfrog.in"];
}

export function buildDirectorySearchQuery(
  site: BusinessDirectorySite,
  industry: string,
  country: string,
  keywords: string[],
  domainOverride?: string
): string {
  const domain =
    domainOverride ??
    (site.id === "hotfrog" ? pickHotfrogDomainsForCountry(country)[0] : site.domains[0]);
  const terms = [industry, ...keywords.slice(0, 2), country].filter(Boolean);
  return `site:${domain} ${terms.join(" ")}`.trim();
}

/** Hotfrog runs multiple regional site: queries to improve coverage outside the US. */
export function buildDirectorySearchQueries(
  site: BusinessDirectorySite,
  industry: string,
  country: string,
  keywords: string[]
): string[] {
  if (site.id !== "hotfrog") {
    return [buildDirectorySearchQuery(site, industry, country, keywords)];
  }

  const domains = pickHotfrogDomainsForCountry(country).slice(0, 2);
  return domains.map((domain) =>
    buildDirectorySearchQuery(site, industry, country, keywords, domain)
  );
}
