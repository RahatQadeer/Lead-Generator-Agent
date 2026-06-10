export type CompanyDiscoveryErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "PLAN_RESTRICTED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "SEARCH_NOT_FOUND";

export class CompanyDiscoveryError extends Error {
  readonly code: CompanyDiscoveryErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: CompanyDiscoveryErrorCode,
    message: string,
    options: { statusCode?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "CompanyDiscoveryError";
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
  }
}

export function isCompanyDiscoveryError(
  error: unknown
): error is CompanyDiscoveryError {
  return error instanceof CompanyDiscoveryError;
}
