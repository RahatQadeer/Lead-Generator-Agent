export type ContactDiscoveryErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "PLAN_RESTRICTED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "SEARCH_NOT_FOUND"
  | "NO_COMPANIES";

export class ContactDiscoveryError extends Error {
  readonly code: ContactDiscoveryErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: ContactDiscoveryErrorCode,
    message: string,
    options: { statusCode?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "ContactDiscoveryError";
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
  }
}

export function isContactDiscoveryError(
  error: unknown
): error is ContactDiscoveryError {
  return error instanceof ContactDiscoveryError;
}
