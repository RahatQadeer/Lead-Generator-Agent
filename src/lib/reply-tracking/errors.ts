export type ReplyTrackingErrorCode =
  | "AUTH_ERROR"
  | "PROVIDER_NOT_CONNECTED"
  | "PROVIDER_NOT_CONFIGURED"
  | "DETECTION_FAILED"
  | "NETWORK_ERROR";

export class ReplyTrackingError extends Error {
  readonly code: ReplyTrackingErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: ReplyTrackingErrorCode,
    message: string,
    options: { statusCode?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "ReplyTrackingError";
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
  }
}

export function isReplyTrackingError(
  error: unknown
): error is ReplyTrackingError {
  return error instanceof ReplyTrackingError;
}
