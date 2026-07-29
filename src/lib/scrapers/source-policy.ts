import type { ScraperSourceId } from "@/lib/scrapers/types";

/**
 * Sources that require explicit opt-in before they run. Two reasons:
 *  - Cloudflare / anti-bot protection blocks datacenter IPs, so they only
 *    produce results behind residential proxies or a challenge-solving fetch
 *    service.
 *  - Their Terms of Service restrict automated access.
 *
 * These are DISABLED by default. Enable them deliberately (and only where you
 * have the right to) via the SCRAPER_ENABLE_RESTRICTED env var. robots.txt is
 * still honored by the shared fetchers regardless of this flag.
 */
export const RESTRICTED_SOURCES: ReadonlySet<ScraperSourceId> = new Set<ScraperSourceId>([
  "startupranking",
  "seedtable",
  "openvc",
  "f6s",
  "indiehackers",
  // VC portfolios + accelerator grids: JS-rendered (Playwright) and unverified
  // from datacenter IPs. Modular and runnable, but opt-in so they don't slow or
  // pollute every search until you've confirmed they yield in your environment.
  "techstars",
  "500global",
  "antler",
  "sequoia-portfolio",
  "a16z-portfolio",
  "accel-portfolio",
  "lightspeed-portfolio",
  "general-catalyst-portfolio",
  "bessemer-portfolio",
  "index-ventures-portfolio",
]);

export function isRestrictedSource(source: ScraperSourceId): boolean {
  return RESTRICTED_SOURCES.has(source);
}

/**
 * Opt-in via SCRAPER_ENABLE_RESTRICTED:
 *   - "all" | "true" | "1"      → enable every restricted source
 *   - "f6s,indiehackers"        → enable a specific comma-separated subset
 *   - unset / empty             → all restricted sources stay disabled
 */
export function isRestrictedSourceEnabled(source: ScraperSourceId): boolean {
  const raw = process.env.SCRAPER_ENABLE_RESTRICTED?.trim().toLowerCase();
  if (!raw) return false;
  if (raw === "all" || raw === "true" || raw === "1") return true;
  return raw
    .split(",")
    .map((value) => value.trim())
    .includes(source);
}
