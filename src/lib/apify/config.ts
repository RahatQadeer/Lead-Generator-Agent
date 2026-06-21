import { isPaidApisDisabled } from "@/lib/providers/free-stack";

/** Apify actor id for API paths (`owner~actor-name`). */
export function formatApifyActorId(actor: string): string {
  const trimmed = actor.trim();
  if (trimmed.includes("~")) return trimmed;
  return trimmed.replace("/", "~");
}

export function getApifyApiToken(): string | null {
  const token = process.env.APIFY_API_TOKEN?.trim();
  return token || null;
}

export function isApifyEnabled(): boolean {
  if (isPaidApisDisabled()) return false;

  const token = getApifyApiToken();
  if (!token) return false;

  const flag = process.env.APIFY_ENABLED?.toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function getApifyGoogleMapsActorId(): string {
  return formatApifyActorId(
    process.env.APIFY_GOOGLE_MAPS_ACTOR?.trim() || "compass/crawler-google-places"
  );
}

export function getApifyWebsiteCrawlerActorId(): string {
  return formatApifyActorId(
    process.env.APIFY_WEBSITE_CRAWLER_ACTOR?.trim() || "apify/website-content-crawler"
  );
}

export function getApifyMaxPlacesPerSearch(): number {
  const raw = Number(process.env.APIFY_MAX_PLACES_PER_SEARCH);
  if (!Number.isFinite(raw) || raw < 1) return 25;
  return Math.min(100, Math.round(raw));
}

export function getApifyRunTimeoutSec(): number {
  const raw = Number(process.env.APIFY_RUN_TIMEOUT_SEC);
  if (!Number.isFinite(raw) || raw < 30) return 120;
  return Math.min(300, Math.round(raw));
}
