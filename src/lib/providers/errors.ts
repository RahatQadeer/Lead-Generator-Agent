/**
 * One error type for the whole provider layer.
 *
 * Providers fail in vendor-specific ways — an HTTP 429, a thrown TypeError from
 * a dropped socket, a `{ error: "quota" }` body. The pipeline needs exactly two
 * facts: is it worth retrying, and should this provider be skipped for the rest
 * of the run. Normalizing at the boundary means the retry policy has a single
 * rule to apply instead of one per vendor.
 */
export type ProviderErrorCode =
  | "NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "UNAUTHORIZED"
  | "TIMEOUT"
  | "NETWORK"
  | "BAD_RESPONSE"
  | "ABORTED"
  | "UNKNOWN";

export interface ProviderErrorOptions {
  provider: string;
  code: ProviderErrorCode;
  message: string;
  cause?: unknown;
  /** Honour a server-supplied Retry-After, in ms. */
  retryAfterMs?: number;
}

export class ProviderError extends Error {
  readonly provider: string;
  readonly code: ProviderErrorCode;
  readonly retryAfterMs?: number;

  constructor(options: ProviderErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ProviderError";
    this.provider = options.provider;
    this.code = options.code;
    this.retryAfterMs = options.retryAfterMs;
  }

  /** Transient conditions worth another attempt. */
  get retryable(): boolean {
    return (
      this.code === "RATE_LIMITED" ||
      this.code === "TIMEOUT" ||
      this.code === "NETWORK"
    );
  }

  /**
   * Conditions that will not improve within this run, so the provider should be
   * dropped rather than retried on every subsequent company. Retrying an
   * exhausted quota 500 times is how a run turns a rate limit into an outage.
   */
  get fatalForRun(): boolean {
    return (
      this.code === "QUOTA_EXCEEDED" ||
      this.code === "UNAUTHORIZED" ||
      this.code === "NOT_CONFIGURED"
    );
  }
}

/** Wrap an unknown thrown value as a ProviderError, inferring the code. */
export function toProviderError(provider: string, error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;

  if (error instanceof DOMException && error.name === "AbortError") {
    return new ProviderError({ provider, code: "ABORTED", message: "Aborted", cause: error });
  }

  // fetch() rejects with TypeError for DNS failures, refused connections and
  // dropped sockets — all transient at this layer.
  if (error instanceof TypeError) {
    return new ProviderError({
      provider,
      code: "NETWORK",
      message: error.message,
      cause: error,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ProviderError({ provider, code: "UNKNOWN", message, cause: error });
}

/** Map an HTTP status onto a provider error code. */
export function providerErrorFromStatus(
  provider: string,
  status: number,
  body?: string,
  retryAfterMs?: number
): ProviderError {
  const message = `${provider} responded ${status}${body ? `: ${body.slice(0, 200)}` : ""}`;

  if (status === 401 || status === 403) {
    return new ProviderError({ provider, code: "UNAUTHORIZED", message });
  }
  if (status === 402) {
    return new ProviderError({ provider, code: "QUOTA_EXCEEDED", message });
  }
  if (status === 429) {
    return new ProviderError({ provider, code: "RATE_LIMITED", message, retryAfterMs });
  }
  if (status === 408 || status === 504) {
    return new ProviderError({ provider, code: "TIMEOUT", message });
  }
  if (status >= 500) {
    return new ProviderError({ provider, code: "NETWORK", message });
  }
  return new ProviderError({ provider, code: "BAD_RESPONSE", message });
}
