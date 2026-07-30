/** YC website scraper is on by default; set ENABLE_YC_SCRAPER=false to disable. */
export function isYcScraperEnabled(): boolean {
  const raw = process.env.ENABLE_YC_SCRAPER?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}

function areOtherDirectoryScrapersEnabled(): boolean {
  const raw = process.env.ENABLE_DIRECTORY_SCRAPERS?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}

/**
 * When true, company discovery relies on the YC scraper instead of the heavy
 * Google Places / web-search primary provider. Defaults to on when YC is enabled
 * and other directory scrapers are off — set YC_FOCUSED_DISCOVERY=false to merge both.
 */
export function isYcFocusedDiscovery(): boolean {
  const raw = process.env.YC_FOCUSED_DISCOVERY?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  if (raw === "true" || raw === "1" || raw === "on") return true;
  return isYcScraperEnabled() && !areOtherDirectoryScrapersEnabled();
}

export function ycScraperMaxCompanies(): number {
  const raw = Number(process.env.YC_SCRAPER_MAX ?? process.env.DIRECTORY_SCRAPER_MAX);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 25;
}

/** YC Algolia returns up to 100 hits per page — paginate to reach {@link ycScraperMaxCompanies}. */
export function ycScraperMaxPages(): number {
  return Math.max(1, Math.ceil(ycScraperMaxCompanies() / 100));
}
