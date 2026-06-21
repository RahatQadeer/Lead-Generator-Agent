import { createLogger } from "@/lib/logger";
import { getApifyApiToken, getApifyRunTimeoutSec } from "@/lib/apify/config";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolMiss,
  recordScrapingToolSuccess,
  type ScrapingToolId,
} from "@/lib/scraping/tool-health";

const log = createLogger("apify.client");

const API_BASE = "https://api.apify.com/v2";

export class ApifyError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApifyError";
  }
}

export interface RunApifyActorOptions {
  actorId: string;
  input: Record<string, unknown>;
  toolId: ScrapingToolId;
  maxItems?: number;
  timeoutSec?: number;
}

/**
 * Run an Apify actor synchronously and return dataset items.
 * @see https://docs.apify.com/api/v2/act-run-sync-get-dataset-items-post
 */
export async function runApifyActorSync<TItem extends object>(
  options: RunApifyActorOptions
): Promise<TItem[]> {
  const token = getApifyApiToken();
  if (!token || !isScrapingToolAvailable(options.toolId)) {
    return [];
  }

  const timeoutSec = options.timeoutSec ?? getApifyRunTimeoutSec();
  const params = new URLSearchParams({
    token,
    timeout: String(timeoutSec),
    clean: "true",
    format: "json",
  });
  if (options.maxItems) {
    params.set("maxItems", String(options.maxItems));
  }

  const url = `${API_BASE}/acts/${options.actorId}/run-sync-get-dataset-items?${params}`;

  log.info("Starting Apify actor run", {
    actorId: options.actorId,
    toolId: options.toolId,
    maxItems: options.maxItems,
    timeoutSec,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(options.input),
      signal: AbortSignal.timeout((timeoutSec + 15) * 1000),
    });

    if (!response.ok) {
      let message = `Apify actor failed (${response.status})`;
      try {
        const body = (await response.json()) as {
          error?: { message?: string; type?: string };
        };
        if (body.error?.message) message = body.error.message;
      } catch {
        // ignore parse errors
      }
      log.warn("Apify actor run failed", {
        actorId: options.actorId,
        status: response.status,
        message,
      });
      recordScrapingToolFailure(options.toolId);
      throw new ApifyError(message, response.status);
    }

    const items = (await response.json()) as TItem[];
    const list = Array.isArray(items) ? items : [];

    if (list.length > 0) {
      recordScrapingToolSuccess(options.toolId);
    } else {
      recordScrapingToolMiss(options.toolId);
    }

    log.info("Apify actor run completed", {
      actorId: options.actorId,
      itemCount: list.length,
    });

    return list;
  } catch (error) {
    if (error instanceof ApifyError) throw error;
    log.warn("Apify actor request error", {
      actorId: options.actorId,
      error: String(error),
    });
    recordScrapingToolFailure(options.toolId);
    throw error;
  }
}
