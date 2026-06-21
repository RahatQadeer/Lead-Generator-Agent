import { isDirectoryOrAggregatorDomain } from "@/lib/scraping/company-search-filter";
import { isNonCommercialDomain } from "@/lib/scraping/org-type-blockers";

const BLOCKED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
  "duckduckgo.com",
  "www.duckduckgo.com",
  "facebook.com",
  "www.facebook.com",
  "linkedin.com",
  "www.linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "wikipedia.org",
  "amazon.com",
]);

export function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(`www.${host}`)) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export function normalizeWebsiteUrl(domain: string): string {
  return `https://${domain.replace(/^www\./, "")}`;
}

export function isLikelyCompanyDomain(domain: string): boolean {
  if (!domain || domain.length < 4) return false;
  if (BLOCKED_HOSTS.has(domain) || BLOCKED_HOSTS.has(`www.${domain}`)) return false;
  if (isDirectoryOrAggregatorDomain(domain)) return false;
  if (isNonCommercialDomain(domain)) return false;
  return domain.includes(".") && !domain.endsWith(".pdf");
}
