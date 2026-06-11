export class FollowUpBlockedError extends Error {
  readonly code = "FOLLOW_UPS_STOPPED";
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "FollowUpBlockedError";
  }
}

export function isFollowUpBlockedError(
  error: unknown
): error is FollowUpBlockedError {
  return error instanceof FollowUpBlockedError;
}
