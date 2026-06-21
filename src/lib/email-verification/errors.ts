export type EmailVerificationErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "NO_CONTACTS";

export class EmailVerificationError extends Error {
  readonly code: EmailVerificationErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: EmailVerificationErrorCode,
    message: string,
    options: { statusCode?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "EmailVerificationError";
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
  }
}

export function isEmailVerificationError(
  error: unknown
): error is EmailVerificationError {
  return error instanceof EmailVerificationError;
}
