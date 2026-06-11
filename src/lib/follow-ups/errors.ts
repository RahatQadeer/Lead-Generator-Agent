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

export class FollowUpNotFoundError extends Error {
  readonly code = "FOLLOW_UP_NOT_FOUND";
  readonly statusCode = 404;

  constructor(message = "Follow-up not found.") {
    super(message);
    this.name = "FollowUpNotFoundError";
  }
}

export function isFollowUpNotFoundError(
  error: unknown
): error is FollowUpNotFoundError {
  return error instanceof FollowUpNotFoundError;
}
