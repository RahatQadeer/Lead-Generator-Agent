import { createLogger } from "@/lib/logger";
import { companyNamesMatch } from "@/lib/scraping/company-affiliation";
import { sanitizeCompanyLinkedInForCompany } from "@/lib/scraping/data-quality";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";

const log = createLogger("scraping.linkedin-company-search");

interface SearxngResult {
  title?: string;
  url?: string;
  content?: string;
}

interface SearxngResponse {
  results?: SearxngResult[];
}

function linkedInCompanyMatches(
  title: string,
  content: string,
  companyName: string,
  domain?: string | null
): boolean {
  const combined = `${title} ${content}`.toLowerCase();
  const normalizedName = companyName.trim().toLowerCase();
  if (normalizedName.length >= 2 && combined.includes(normalizedName)) return true;

  const domainRoot = domain?.replace(/^www\./, "").split(".")[0]?.toLowerCase();
  if (domainRoot && domainRoot.length >= 3 && combined.includes(domainRoot)) {
    return true;
  }

  return companyNamesMatch(title, companyName);
}

export interface CompanyLinkedInDiscovery {
  linkedinUrl: string;
  snippet: string;
}

/**
 * Discover a company's LinkedIn page via SearXNG (linkedin.com/company only).
 */
export async function discoverCompanyLinkedIn(
  companyName: string,
  domain?: string | null
): Promise<string | null> {
  const result = await discoverCompanyLinkedInWithSnippet(companyName, domain);
  return result?.linkedinUrl ?? null;
}

export async function discoverCompanyLinkedInWithSnippet(
  companyName: string,
  domain?: string | null
): Promise<CompanyLinkedInDiscovery | null> {
  const baseUrl = getSearxngBaseUrl();
  if (!baseUrl) return null;

  const queries = [
    `site:linkedin.com/company "${companyName}"`,
    domain ? `site:linkedin.com/company ${domain.replace(/^www\./, "")}` : null,
  ].filter(Boolean) as string[];

  for (const query of queries) {
    const searchUrl = new URL("/search", baseUrl);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("categories", "general");

    try {
      const response = await fetch(searchUrl.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "LeadForge/1.0 (company research)",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) continue;

      const body = (await response.json()) as SearxngResponse;

      for (const item of body.results ?? []) {
        const rawUrl = item.url?.trim();
        if (!rawUrl || !/\/company\//i.test(rawUrl) || /\/school\//i.test(rawUrl)) {
          continue;
        }

        if (!linkedInCompanyMatches(item.title ?? "", item.content ?? "", companyName, domain)) {
          continue;
        }

        const linkedin = sanitizeCompanyLinkedInForCompany(rawUrl, companyName, domain);
        if (linkedin) {
          log.info("Company LinkedIn discovered", { company: companyName, linkedin });
          return {
            linkedinUrl: linkedin,
            snippet: [item.title, item.content].filter(Boolean).join(" "),
          };
        }
      }
    } catch (error) {
      log.warn("Company LinkedIn search failed", { query, error: String(error) });
    }
  }

  return null;
}
