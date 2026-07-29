/**
 * The single call path into any provider.
 *
 * Every provider invocation goes through `callProvider`, which applies rate
 * limiting, retry with jittered backoff, timing, structured logging and error
 * normalization. Providers themselves contain none of this, so a new integration
 * is just the vendor call — and cross-cutting behaviour cannot drift between
 * providers, which is what happened with the two separate retry.ts copies this
 * replaces.
 */
import { createLogger } from "@/lib/logger";
import { ProviderError, toProviderError } from "@/lib/providers/errors";
import { getRateLimiter } from "@/lib/providers/rate-limiter";
import { resolveRateLimit, resolveRetry } from "@/lib/providers/policy";
import type { Provider } from "@/lib/providers/types";

const log = createLogger("providers");

/** Providers disabled for the remainder of this run, keyed by run id. */
const RUN_DISABLED = new Map<string, Set<string>>();

function disabledSet(jobId: string): Set<string> {
  let set = RUN_DISABLED.get(jobId);
  if (!set) {
    set = new Set();
    RUN_DISABLED.set(jobId, set);
  }
  return set;
}

/** True when a provider has hit a fatal condition earlier in this run. */
export function isProviderDisabledForRun(jobId: string, providerId: string): boolean {
  return RUN_DISABLED.get(jobId)?.has(providerId) ?? false;
}

/** Drop per-run provider state once a job finishes. */
export function clearRunProviderState(jobId: string): void {
  RUN_DISABLED.delete(jobId);
}

function jitter(delayMs: number): number {
  // Full jitter. Without it, N companies failing together retry in lockstep and
  // reproduce the burst that caused the rate limit.
  return Math.round(Math.random() * delayMs);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export interface CallProviderOptions {
  /** Label for logs, e.g. "findPeople". */
  operation: string;
  jobId: string;
  signal: AbortSignal;
}

/**
 * Invoke one provider operation under the full policy stack.
 *
 * Throws {@link ProviderError}. Callers that treat a failure as "no data" should
 * use {@link tryProvider} instead of catching here.
 */
export async function callProvider<T>(
  provider: Provider,
  options: CallProviderOptions,
  fn: () => Promise<T>
): Promise<T> {
  const { operation, jobId, signal } = options;

  if (isProviderDisabledForRun(jobId, provider.id)) {
    throw new ProviderError({
      provider: provider.id,
      code: "QUOTA_EXCEEDED",
      message: `${provider.id} was disabled earlier in this run`,
    });
  }

  const retry = resolveRetry(provider);
  const limiter = getRateLimiter(provider.id, resolveRateLimit(provider));
  const startedAt = Date.now();

  let lastError: ProviderError | null = null;

  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    if (signal.aborted) {
      throw new ProviderError({
        provider: provider.id,
        code: "ABORTED",
        message: "Run aborted",
      });
    }

    try {
      const value = await limiter.run(fn, signal);
      log.debug("Provider call succeeded", {
        provider: provider.id,
        operation,
        attempt,
        ms: Date.now() - startedAt,
      });
      return value;
    } catch (error) {
      const normalized = toProviderError(provider.id, error);
      lastError = normalized;

      if (normalized.code === "ABORTED") throw normalized;

      if (normalized.fatalForRun) {
        // Stop asking. Every later company would hit the same wall.
        disabledSet(jobId).add(provider.id);
        log.warn("Provider disabled for this run", {
          provider: provider.id,
          operation,
          code: normalized.code,
          error: normalized.message,
        });
        throw normalized;
      }

      const isLast = attempt === retry.maxAttempts;
      if (!normalized.retryable || isLast) {
        log.warn("Provider call failed", {
          provider: provider.id,
          operation,
          attempt,
          code: normalized.code,
          error: normalized.message,
        });
        throw normalized;
      }

      const backoff = Math.min(
        retry.maxDelayMs,
        retry.baseDelayMs * 2 ** (attempt - 1)
      );
      const delay = normalized.retryAfterMs ?? jitter(backoff);

      log.debug("Retrying provider call", {
        provider: provider.id,
        operation,
        attempt,
        delayMs: delay,
        code: normalized.code,
      });
      await sleep(delay, signal);
    }
  }

  throw (
    lastError ??
    new ProviderError({
      provider: provider.id,
      code: "UNKNOWN",
      message: "Provider call failed without an error",
    })
  );
}

/**
 * Like {@link callProvider} but resolves to `fallback` instead of throwing.
 *
 * This is the right default for the pipeline: one provider going down must
 * degrade the result, never fail the user's search. Aborts still propagate,
 * because a stopped job should stop.
 */
export async function tryProvider<T>(
  provider: Provider,
  options: CallProviderOptions,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await callProvider(provider, options, fn);
  } catch (error) {
    if (error instanceof ProviderError && error.code === "ABORTED") throw error;
    return fallback;
  }
}
