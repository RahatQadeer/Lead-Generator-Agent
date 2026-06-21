export type LeadEnrichmentErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "PLAN_RESTRICTED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "NO_CONTACTS";

export class LeadEnrichmentError extends Error {
  readonly code: LeadEnrichmentErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LeadEnrichmentErrorCode,
    message: string,
    options: { statusCode?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "LeadEnrichmentError";
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
  }
}

export function isLeadEnrichmentError(
  error: unknown
): error is LeadEnrichmentError {
  return error instanceof LeadEnrichmentError;
}
