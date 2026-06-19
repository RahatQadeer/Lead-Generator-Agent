import { createLogger } from "@/lib/logger";
import { canFetchUrl } from "@/lib/scraping/robots";
import { waitForRateLimit } from "@/lib/scraping/rate-limiter";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";
import type { FetchPageResult } from "@/lib/scraping/http-client";

const log = createLogger("scraping.playwright");

const USER_AGENT =
  "LeadForgeBot/1.0 (+https://righttail.com; ethical business research)";

let browserPromise: Promise<import("playwright").Browser | null> | null = null;
let lastUsedAt = 0;
const IDLE_CLOSE_MS = 60_000;

function isPlaywrightEnabled(): boolean {
  const flag = process.env.SCRAPING_PLAYWRIGHT_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
}

async function getBrowser(): Promise<import("playwright").Browser | null> {
  if (!isPlaywrightEnabled()) return null;
  if (!isScrapingToolAvailable("playwright")) return null;

  if (browserPromise) {
    return browserPromise;
  }

  browserPromise = (async () => {
    try {
      const { chromium } = await import("playwright");
      // await so launch rejections (e.g. missing browser binary) hit this catch
      return await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    } catch (error) {
      log.warn("Playwright unavailable — install with: npx playwright install chromium", {
        error: String(error),
      });
      recordScrapingToolFailure("playwright");
      return null;
    }
  })();

  return browserPromise;
}

async function scheduleIdleClose(): Promise<void> {
  lastUsedAt = Date.now();
  setTimeout(async () => {
    if (Date.now() - lastUsedAt < IDLE_CLOSE_MS) return;
    const browser = await browserPromise;
    if (browser) {
      await browser.close().catch(() => undefined);
      browserPromise = null;
    }
  }, IDLE_CLOSE_MS + 100);
}

export async function fetchPageWithPlaywright(
  url: string,
  options: { timeoutMs?: number; respectRobots?: boolean; minIntervalMs?: number } = {}
): Promise<FetchPageResult | null> {
  const {
    timeoutMs = 12_000,
    respectRobots = true,
    minIntervalMs = 1000,
  } = options;

  let parsed: URL;
  try {
    parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return null;
  }

  if (respectRobots) {
    const allowed = await canFetchUrl(parsed.toString());
    if (!allowed) {
      log.info("Playwright blocked by robots.txt", { url: parsed.toString() });
      return null;
    }
  }

  await waitForRateLimit(parsed.hostname, minIntervalMs);

  const browser = await getBrowser();
  if (!browser) return null;

  let page: import("playwright").Page | null = null;

  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();

    const response = await page.goto(parsed.toString(), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    if (!response || !response.ok()) {
      await context.close();
      return null;
    }

    // Allow client-side hydration for React/Next.js team pages
    await page.waitForTimeout(1_500);

    const html = await page.content();
    await context.close();
    await scheduleIdleClose();

    recordScrapingToolSuccess("playwright");
    return {
      url: page.url(),
      html,
      status: response.status(),
    };
  } catch (error) {
    log.warn("Playwright fetch failed", { url: parsed.toString(), error: String(error) });
    if (page) await page.context().close().catch(() => undefined);
    return null;
  }
}

/** Close browser — for tests and graceful shutdown. */
export async function closePlaywrightBrowser(): Promise<void> {
  const browser = browserPromise ? await browserPromise : null;
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  browserPromise = null;
}
