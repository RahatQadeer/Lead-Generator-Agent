import IORedis from "ioredis";

let connection: IORedis | null = null;

export function getRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

export function isQueueEnabled(): boolean {
  return Boolean(getRedisUrl());
}

export function getQueueConnectionOptions(): { url: string; maxRetriesPerRequest: null } {
  const url = getRedisUrl();
  if (!url) {
    throw new Error("REDIS_URL is not configured.");
  }

  return {
    url,
    maxRetriesPerRequest: null,
  };
}

export function getRedisConnection(): IORedis {
  const url = getRedisUrl();
  if (!url) {
    throw new Error("REDIS_URL is not configured.");
  }

  if (!connection) {
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
    });
  }

  return connection;
}
