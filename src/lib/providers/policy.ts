/**
 * Layer-wide defaults for retry and rate limiting, plus the enablement rules.
 *
 * Defaults are deliberately conservative: a provider that declares nothing gets
 * a polite rate and few retries. Vendors with published limits override on the
 * class, and an operator can override either via env without a code change.
 */
import { isPaidApisDisabled } from "@/lib/providers/free-stack";
import type { Provider, RateLimitPolicy, RetryPolicy } from "@/lib/providers/types";

const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
};

/**
 * 2 rps with a small burst. Slow enough to be a good citizen against a scraped
 * site, and every real API allows far more — those override it.
 */
const DEFAULT_RATE_LIMIT: RateLimitPolicy = {
  requestsPerSecond: 2,
  burst: 4,
  maxConcurrent: 4,
};

function envInt(key: string): number | null {
  const raw = process.env[key]?.trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Per-provider env overrides, e.g. PROVIDER_GOOGLE_PLACES_RPS=10.
 * Non-alphanumerics become underscores so ids like "google-places" map cleanly.
 */
function envKey(providerId: string, suffix: string): string {
  return `PROVIDER_${providerId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${suffix}`;
}

export function resolveRetry(provider: Provider): RetryPolicy {
  const base = provider.retry ?? DEFAULT_RETRY;
  const attempts = envInt(envKey(provider.id, "MAX_ATTEMPTS"));
  return attempts ? { ...base, maxAttempts: attempts } : base;
}

export function resolveRateLimit(provider: Provider): RateLimitPolicy {
  const base = provider.rateLimit ?? DEFAULT_RATE_LIMIT;
  const rps = envInt(envKey(provider.id, "RPS"));
  const maxConcurrent = envInt(envKey(provider.id, "CONCURRENCY"));

  if (!rps && !maxConcurrent) return base;
  return {
    ...base,
    ...(rps ? { requestsPerSecond: rps, burst: base.burst ?? rps } : {}),
    ...(maxConcurrent ? { maxConcurrent } : {}),
  };
}

/**
 * Whether a provider may run.
 *
 * Three gates, in order of precedence:
 *   1. An explicit disable list always wins (PROVIDERS_DISABLED=apollo,apify).
 *   2. Paid providers stay off under the free-stack policy.
 *   3. The provider's own isConfigured() — credentials, flags, unimplemented
 *      integration points.
 */
export function isProviderEnabled(provider: Provider): boolean {
  if (disabledIds().has(provider.id)) return false;
  if (provider.tier === "paid" && isPaidApisDisabled()) return false;
  return provider.isConfigured();
}

/** Why a provider is not running — surfaced in /api/health and the UI. */
export function providerDisabledReason(provider: Provider): string | null {
  if (disabledIds().has(provider.id)) return "disabled by PROVIDERS_DISABLED";
  if (provider.tier === "paid" && isPaidApisDisabled()) {
    return "paid provider; DISABLE_PAID_APIS is on";
  }
  if (!provider.isConfigured()) return "not configured";
  return null;
}

function disabledIds(): ReadonlySet<string> {
  const raw = process.env.PROVIDERS_DISABLED?.trim();
  if (!raw) return EMPTY;
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean)
  );
}

const EMPTY: ReadonlySet<string> = new Set();
