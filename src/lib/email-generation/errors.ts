export type EmailGenerationErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "CONTACT_NOT_FOUND"
  | "NO_EMAIL";

export class EmailGenerationError extends Error {
  readonly code: EmailGenerationErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: EmailGenerationErrorCode,
    message: string,
    options: { statusCode?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "EmailGenerationError";
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
  }
}

export function isEmailGenerationError(
  error: unknown
): error is EmailGenerationError {
  return error instanceof EmailGenerationError;
}
