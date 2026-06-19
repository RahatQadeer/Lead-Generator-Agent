import type { WebSearchResult } from "@/lib/scraping/web-search";
import type { CompanyDirectorySeed } from "@/lib/scraping/company-directory-seeds";
import type { BusinessDirectorySocialLinks } from "@/lib/scraping/business-directory-sites";

const DIRECTORY_HOSTS = new Set([
  "opencorporates.com",
  "www.opencorporates.com",
  "wikidata.org",
  "www.wikidata.org",
  "wikipedia.org",
  "hotfrog.com",
  "manta.com",
  "brownbook.net",
  "clutch.co",
  "kompass.com",
  "cylex.us",
]);

export interface MergedCompanySeed extends WebSearchResult {
  country: string | null;
  city: string | null;
  seedSource: "directory" | "web";
  directorySource?: CompanyDirectorySeed["source"];
  socialLinks?: BusinessDirectorySocialLinks;
  completenessScore?: number;
  industryHint?: string | null;
  phone?: string | null;
}

function isDirectoryHost(domain: string | null): boolean {
  if (!domain) return true;
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  return DIRECTORY_HOSTS.has(normalized) || normalized.endsWith(".opencorporates.com");
}

/**
 * Merge directory registry seeds with web search results.
 * Directory seeds are preferred when the same domain appears in both.
 */
export function mergeCompanySeeds(
  directorySeeds: CompanyDirectorySeed[],
  webResults: WebSearchResult[],
  maxResults: number
): MergedCompanySeed[] {
  const byDomain = new Map<string, MergedCompanySeed>();

  for (const seed of directorySeeds) {
    if (!seed.domain || isDirectoryHost(seed.domain)) continue;

    byDomain.set(seed.domain, {
      title: seed.title,
      url: seed.url,
      snippet: seed.snippet,
      domain: seed.domain,
      country: seed.country,
      city: seed.city,
      seedSource: "directory",
      directorySource: seed.source,
      socialLinks: seed.socialLinks,
      completenessScore: seed.completenessScore,
      industryHint: seed.industryHint ?? null,
      phone: seed.phone ?? null,
    });
  }

  for (const result of webResults) {
    if (!result.domain || isDirectoryHost(result.domain)) continue;

    const existing = byDomain.get(result.domain);
    if (existing) {
      if (!existing.snippet && result.snippet) {
        existing.snippet = result.snippet;
      }
      continue;
    }

    byDomain.set(result.domain, {
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      domain: result.domain,
      country: null,
      city: null,
      seedSource: "web",
    });
  }

  const directoryFirst = [...byDomain.values()].sort((a, b) => {
    if (a.seedSource === b.seedSource) return 0;
    return a.seedSource === "directory" ? -1 : 1;
  });

  return directoryFirst.slice(0, maxResults);
}
