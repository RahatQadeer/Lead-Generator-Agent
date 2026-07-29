import { createLogger } from "@/lib/logger";

const log = createLogger("scrapers.retry");

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const label = options.label ?? "operation";

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new Error(`Aborted during ${label}`);
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;

      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      log.warn("Retrying scraper operation", {
        label,
        attempt,
        delayMs: delay,
        error: String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
