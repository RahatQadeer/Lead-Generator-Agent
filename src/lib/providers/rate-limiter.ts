/**
 * Per-provider token bucket + concurrency gate.
 *
 * One limiter instance per provider id, held for the process lifetime, so two
 * concurrent jobs hitting the same vendor share one budget. A per-run limiter
 * would let N parallel searches each spend the full quota and trip the vendor's
 * limit N times over.
 *
 * A token bucket rather than a fixed delay: bursts are what real usage looks
 * like (20 companies arrive at once, then nothing for a minute), and a bucket
 * absorbs them while still holding the sustained rate.
 */
import type { RateLimitPolicy } from "@/lib/providers/types";

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;

  constructor(private readonly policy: RateLimitPolicy) {
    this.capacity = Math.max(1, policy.burst ?? Math.ceil(policy.requestsPerSecond));
    this.tokens = this.capacity;
    this.refillPerMs = policy.requestsPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  /** Milliseconds until a token is available (0 when one is ready now). */
  private waitMs(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillPerMs);
  }

  async take(signal?: AbortSignal): Promise<void> {
    for (;;) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const wait = this.waitMs();
      if (wait === 0) {
        this.tokens -= 1;
        return;
      }
      await sleep(wait, signal);
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Bounds how many calls to one provider are in flight simultaneously. */
class ConcurrencyGate {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active += 1;
  }

  release(): void {
    this.active -= 1;
    const next = this.waiting.shift();
    if (next) next();
  }
}

export class ProviderRateLimiter {
  private readonly bucket: TokenBucket;
  private readonly gate: ConcurrencyGate | null;

  constructor(policy: RateLimitPolicy) {
    this.bucket = new TokenBucket(policy);
    this.gate = policy.maxConcurrent ? new ConcurrencyGate(policy.maxConcurrent) : null;
  }

  /** Run `fn` once a token and a concurrency slot are both available. */
  async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.bucket.take(signal);
    if (!this.gate) return fn();

    await this.gate.acquire();
    try {
      return await fn();
    } finally {
      this.gate.release();
    }
  }
}

const LIMITERS = new Map<string, ProviderRateLimiter>();

/** The shared limiter for a provider id, created on first use. */
export function getRateLimiter(
  providerId: string,
  policy: RateLimitPolicy
): ProviderRateLimiter {
  let limiter = LIMITERS.get(providerId);
  if (!limiter) {
    limiter = new ProviderRateLimiter(policy);
    LIMITERS.set(providerId, limiter);
  }
  return limiter;
}

/** Test helper — drops all limiter state. */
export function resetRateLimiters(): void {
  LIMITERS.clear();
}
