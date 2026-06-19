import { createLogger } from "@/lib/logger";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolMiss,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";
import type { WebSearchResult } from "@/lib/scraping/web-search";

const log = createLogger("scraping.searxng");

interface SearxngResult {
  title?: string;
  url?: string;
  content?: string;
}

interface SearxngResponse {
  results?: SearxngResult[];
}

export function getSearxngBaseUrl(): string | null {
  const url = process.env.SEARXNG_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

export async function searchSearxngCompanies(
  query: string,
  maxResults = 15,
  baseUrl = getSearxngBaseUrl()
): Promise<WebSearchResult[]> {
  if (!baseUrl || !isScrapingToolAvailable("searxng")) return [];

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
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      log.warn("SearXNG request failed", {
        status: response.status,
        baseUrl,
      });
      recordScrapingToolFailure("searxng");
      return [];
    }

    const body = (await response.json()) as SearxngResponse;
    const seen = new Set<string>();
    const results: WebSearchResult[] = [];

    for (const item of body.results ?? []) {
      if (!item.url || !item.title) continue;

      const domain = extractDomainFromUrl(item.url);
      if (!domain || seen.has(domain)) continue;

      seen.add(domain);
      results.push({
        title: item.title.trim(),
        url: item.url,
        snippet: item.content?.trim() ?? "",
        domain,
      });

      if (results.length >= maxResults) break;
    }

    log.info("SearXNG search completed", {
      query,
      count: results.length,
      baseUrl,
    });
    if (results.length > 0) {
      recordScrapingToolSuccess("searxng");
    } else {
      recordScrapingToolMiss("searxng");
    }
    return results;
  } catch (error) {
    log.warn("SearXNG search error", { baseUrl, error: String(error) });
    recordScrapingToolFailure("searxng");
    return [];
  }
}

export async function isSearxngAvailable(
  baseUrl = getSearxngBaseUrl()
): Promise<boolean> {
  if (!baseUrl) return false;

  try {
    const response = await fetch(`${baseUrl}/healthz`, {
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
