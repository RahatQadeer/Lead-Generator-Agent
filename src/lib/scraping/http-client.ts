import { createLogger } from "@/lib/logger";
import { canFetchUrl } from "@/lib/scraping/robots";
import { waitForRateLimit } from "@/lib/scraping/rate-limiter";

const log = createLogger("scraping.http");

const DEFAULT_HEADERS = {
  "User-Agent":
    "LeadForgeBot/1.0 (+https://righttail.com; ethical business research)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface FetchPageOptions {
  timeoutMs?: number;
  respectRobots?: boolean;
  minIntervalMs?: number;
}

/** Fast scraping profile for discovery/contact steps */
export const FAST_FETCH: FetchPageOptions = {
  timeoutMs: 12_000,
  minIntervalMs: 200,
  respectRobots: true,
};

export interface FetchPageResult {
  url: string;
  html: string;
  status: number;
}

export async function fetchPage(
  url: string,
  options: FetchPageOptions = {}
): Promise<FetchPageResult | null> {
  const {
    timeoutMs = 12_000,
    respectRobots = true,
    minIntervalMs = 1000,
  } = options;

  let parsed: URL;
  try {
    parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return null;
  }

  if (respectRobots) {
    const allowed = await canFetchUrl(parsed.toString());
    if (!allowed) {
      log.info("Blocked by robots.txt", { url: parsed.toString() });
      return null;
    }
  }

  await waitForRateLimit(parsed.hostname, minIntervalMs);

  try {
    const response = await fetch(parsed.toString(), {
      headers: DEFAULT_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      log.debug("Non-OK response", { url: parsed.toString(), status: response.status });
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const html = await response.text();
    return {
      url: response.url,
      html,
      status: response.status,
    };
  } catch (error) {
    log.warn("Fetch failed", { url: parsed.toString(), error: String(error) });
    return null;
  }
}
