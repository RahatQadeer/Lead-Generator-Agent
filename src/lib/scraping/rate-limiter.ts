const lastRequestByHost = new Map<string, number>();

export async function waitForRateLimit(
  host: string,
  minIntervalMs = 1000
): Promise<void> {
  const last = lastRequestByHost.get(host) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < minIntervalMs) {
    await new Promise((resolve) => setTimeout(resolve, minIntervalMs - elapsed));
  }
  lastRequestByHost.set(host, Date.now());
}

export function resetRateLimiterForTests(): void {
  lastRequestByHost.clear();
}
