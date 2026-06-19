import { createLogger } from "@/lib/logger";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const log = createLogger("scraping.cache");

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** In-memory fallback when service role is unavailable (local dev). */
const memoryCache = new Map<string, { payload: unknown; expiresAt: number }>();

export type ScrapeCacheType = "company" | "contacts" | "page";

function isExpired(expiresAt: string | number): boolean {
  return Date.now() > new Date(expiresAt).getTime();
}

export async function getScrapeCache<T>(cacheKey: string): Promise<T | null> {
  const mem = memoryCache.get(cacheKey);
  if (mem) {
    if (Date.now() > mem.expiresAt) {
      memoryCache.delete(cacheKey);
      return null;
    }
    return mem.payload as T;
  }

  if (!hasAdminClient()) return null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("scrape_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error || !data) return null;
    if (isExpired(data.expires_at)) return null;

    memoryCache.set(cacheKey, {
      payload: data.payload,
      expiresAt: new Date(data.expires_at).getTime(),
    });

    return data.payload as T;
  } catch (error) {
    log.warn("Cache read failed", { cacheKey, error: String(error) });
    return null;
  }
}

export async function setScrapeCache(
  cacheKey: string,
  cacheType: ScrapeCacheType,
  payload: unknown,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  memoryCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + ttlMs,
  });

  if (!hasAdminClient()) return;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("scrape_cache").upsert(
      {
        cache_key: cacheKey,
        cache_type: cacheType,
        payload: payload as Json,
        scraped_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "cache_key" }
    );

    if (error) {
      log.warn("Cache write failed", { cacheKey, error: error.message });
    }
  } catch (error) {
    log.warn("Cache write failed", { cacheKey, error: String(error) });
  }
}

export function companyCacheKey(domain: string): string {
  return `company:${domain.toLowerCase().replace(/^www\./, "")}`;
}

export function contactsCacheKey(domain: string): string {
  return `contacts:${domain.toLowerCase().replace(/^www\./, "")}`;
}

export function directoryPathsCacheKey(domain: string): string {
  return `paths:${domain.toLowerCase().replace(/^www\./, "")}`;
}
