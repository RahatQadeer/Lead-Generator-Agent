import * as cheerio from "cheerio";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import { sanitizeCompanyLinkedInUrl } from "@/lib/scraping/data-quality";

export type PublicDatabaseId = "crunchbase" | "wellfound";

export interface PublicDatabaseSite {
  id: PublicDatabaseId;
  label: string;
  domains: string[];
  profilePathPattern: RegExp;
}

export const PUBLIC_DATABASE_SITES: PublicDatabaseSite[] = [
  {
    id: "crunchbase",
    label: "Crunchbase",
    domains: ["crunchbase.com"],
    profilePathPattern: /\/organization\/[^/?#]+/i,
  },
  {
    id: "wellfound",
    label: "Wellfound",
    domains: ["wellfound.com", "angel.co"],
    profilePathPattern: /\/(company|companies)\/[^/?#]+/i,
  },
];

export interface PublicDatabaseListing {
  name: string;
  website: string | null;
  domain: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
  linkedinUrl: string | null;
  profileUrl: string;
  source: PublicDatabaseId;
  completenessScore: number;
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function matchPublicDatabaseSite(url: string): PublicDatabaseSite | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = normalizeHost(parsed.hostname);
    const path = parsed.pathname;

    for (const site of PUBLIC_DATABASE_SITES) {
      const hostMatch = site.domains.some(
        (domain) => host === domain || host.endsWith(`.${domain}`)
      );
      if (!hostMatch) continue;
      if (site.profilePathPattern.test(path)) return site;
    }
  } catch {
    return null;
  }
  return null;
}

export function isPublicDatabaseProfileUrl(url: string): boolean {
  return matchPublicDatabaseSite(url) !== null;
}

function extractWebsiteFromProfile(html: string, blockedHosts: Set<string>): string | null {
  const $ = cheerio.load(html);

  const jsonLdWebsite = $('script[type="application/ld+json"]')
    .toArray()
    .map((node) => $(node).html())
    .filter(Boolean)
    .map((raw) => {
      try {
        return JSON.parse(raw!) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .find((block) => block && typeof block.url === "string")?.url;

  if (typeof jsonLdWebsite === "string") {
    const domain = extractDomainFromUrl(jsonLdWebsite);
    if (domain && !blockedHosts.has(domain)) return jsonLdWebsite;
  }

  const candidates: string[] = [];
  $("a[href^='http']").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;
    const label = $(el).text().trim().toLowerCase();
    const domain = extractDomainFromUrl(href);
    if (!domain || blockedHosts.has(domain)) return;
    if (
      label.includes("website") ||
      label.includes("visit") ||
      href.includes("utm_source=crunchbase")
    ) {
      candidates.push(href);
    }
  });

  $("a[href^='http']").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;
    const domain = extractDomainFromUrl(href);
    if (!domain || blockedHosts.has(domain)) return;
    candidates.push(href);
  });

  return candidates[0] ?? null;
}

export function scorePublicListingCompleteness(listing: {
  name: string;
  website: string | null;
  location: string | null;
  description: string | null;
  linkedinUrl: string | null;
}): number {
  let score = 15;
  if (listing.name.trim().length >= 2) score += 10;
  if (listing.website) score += 30;
  if (listing.location) score += 15;
  if (listing.description && listing.description.length > 40) score += 20;
  if (listing.linkedinUrl) score += 10;
  return Math.min(100, score);
}

export function parsePublicDatabaseProfile(
  html: string,
  profileUrl: string,
  source: PublicDatabaseId,
  fallbackTitle: string | null
): PublicDatabaseListing | null {
  const $ = cheerio.load(html);
  const blockedHosts = new Set([
    ...PUBLIC_DATABASE_SITES.flatMap((site) => site.domains),
    "linkedin.com",
    "twitter.com",
    "x.com",
    "facebook.com",
  ]);

  const name =
    $("h1").first().text().trim() ||
    $("meta[property='og:title']").attr("content")?.split("|")[0]?.trim() ||
    fallbackTitle?.trim() ||
    null;

  if (!name) return null;

  const website = extractWebsiteFromProfile(html, blockedHosts);
  const domain = website ? extractDomainFromUrl(website) : null;
  const description =
    $("meta[property='og:description']").attr("content")?.trim() ||
    $("meta[name='description']").attr("content")?.trim() ||
    null;
  const location =
    $("[data-test='overview-location']").text().trim() ||
    $(".location").first().text().trim() ||
    null;
  const linkedinUrl = sanitizeCompanyLinkedInUrl(
    $("a[href*='linkedin.com/company']").first().attr("href") ?? null
  );

  const listing: PublicDatabaseListing = {
    name,
    website,
    domain,
    location: location ? location.replace(/\s+/g, " ").slice(0, 200) : null,
    city: null,
    country: null,
    description: description?.slice(0, 500) ?? null,
    linkedinUrl,
    profileUrl,
    source,
    completenessScore: 0,
  };

  listing.completenessScore = scorePublicListingCompleteness(listing);
  return listing;
}

export function buildPublicDatabaseSearchQuery(
  site: PublicDatabaseSite,
  industry: string,
  country: string,
  keywords: string[]
): string {
  const domain = site.domains[0];
  const terms = [industry, ...keywords.slice(0, 2), country].filter(Boolean);
  return `site:${domain} ${terms.join(" ")}`.trim();
}
