const abortControllers = new Map<string, AbortController>();

export function registerScraperAbortController(jobId: string): AbortController {
  const existing = abortControllers.get(jobId);
  if (existing) return existing;

  const controller = new AbortController();
  abortControllers.set(jobId, controller);
  return controller;
}

export function getScraperAbortController(jobId: string): AbortController | null {
  return abortControllers.get(jobId) ?? null;
}

export function stopScraperJob(jobId: string): boolean {
  const controller = abortControllers.get(jobId);
  if (!controller) return false;
  controller.abort();
  abortControllers.delete(jobId);
  return true;
}

export function clearScraperAbortController(jobId: string): void {
  abortControllers.delete(jobId);
}
