export type EmailSendingErrorCode =
  | "AUTH_ERROR"
  | "VALIDATION_ERROR"
  | "EMAIL_NOT_FOUND"
  | "ALREADY_SENT"
  | "NO_RECIPIENT"
  | "GMAIL_NOT_CONNECTED"
  | "GMAIL_NOT_CONFIGURED"
  | "SEND_FAILED"
  | "NETWORK_ERROR";

export class EmailSendingError extends Error {
  readonly code: EmailSendingErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: EmailSendingErrorCode,
    message: string,
    options: { statusCode?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "EmailSendingError";
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
  }
}

export function isEmailSendingError(error: unknown): error is EmailSendingError {
  return error instanceof EmailSendingError;
}
