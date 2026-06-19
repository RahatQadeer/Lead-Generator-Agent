type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level === "debug" || level === "info" || level === "warn" || level === "error") {
    return level;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[getMinLevel()];
}

function formatMessage(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>
): string {
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta ? { meta } : {}),
  };
  return JSON.stringify(payload);
}

export function createLogger(scope: string) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (shouldLog("debug")) console.debug(formatMessage("debug", scope, message, meta));
    },
    info(message: string, meta?: Record<string, unknown>) {
      if (shouldLog("info")) console.info(formatMessage("info", scope, message, meta));
    },
    warn(message: string, meta?: Record<string, unknown>) {
      if (shouldLog("warn")) console.warn(formatMessage("warn", scope, message, meta));
    },
    error(message: string, meta?: Record<string, unknown>) {
      if (shouldLog("error")) console.error(formatMessage("error", scope, message, meta));
    },
  };
}
