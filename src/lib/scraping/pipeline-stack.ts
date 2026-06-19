/**
 * Apollo/Clay-style discovery stack — priority order for the free pipeline.
 *
 * 🥇 Search scraping (SearXNG / Brave / DuckDuckGo)
 * 🥈 Website scraping (Cheerio → Playwright → optional AI extraction)
 * 🥉 Public profiles (LinkedIn search, Wikidata, Crunchbase, Wellfound)
 * 🏅 Email patterns + DNS/SMTP verification
 */

import { isApifyEnabled } from "@/lib/apify/config";
import { getConfiguredEmailProviderName } from "@/lib/email-generation/factory";
import { getConfiguredEmailVerificationProviderName } from "@/lib/email-verification/factory";
import { getSearxngBaseUrl, isSearxngAvailable } from "@/lib/scraping/searxng-search";

export type PipelineTier = "search" | "website" | "profiles" | "email";

export interface PipelineTierStatus {
  tier: PipelineTier;
  label: string;
  priority: number;
  enabled: boolean;
  detail: string;
}

function isPlaywrightEnabled(): boolean {
  const flag = process.env.SCRAPING_PLAYWRIGHT_ENABLED?.toLowerCase();
  return flag !== "false" && flag !== "0";
}

function isAiExtractionEnabled(): boolean {
  const flag = process.env.SCRAPING_AI_EXTRACTION_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function getPipelineStackConfig(): PipelineTierStatus[] {
  const searxngUrl = getSearxngBaseUrl();

  return [
    {
      tier: "search",
      label: "Search scraping",
      priority: 1,
      enabled: Boolean(searxngUrl),
      detail: searxngUrl
        ? `SearXNG at ${searxngUrl} (Brave, DuckDuckGo, Wikipedia engines)`
        : "Set SEARXNG_URL — run docker compose up searxng",
    },
    {
      tier: "website",
      label: "Website scraping",
      priority: 2,
      enabled: isPlaywrightEnabled(),
      detail: isApifyEnabled()
        ? "Cheerio + Playwright + Apify website crawler + optional AI"
        : isAiExtractionEnabled()
          ? "Cheerio + Playwright + OpenRouter AI extraction"
          : isPlaywrightEnabled()
            ? "Cheerio + Playwright (set OPENROUTER_API_KEY for AI extraction)"
            : "Disabled — set SCRAPING_PLAYWRIGHT_ENABLED=true",
    },
    {
      tier: "profiles",
      label: "LinkedIn / public profiles",
      priority: 3,
      enabled: Boolean(searxngUrl),
      detail: "SearXNG LinkedIn search + Wikidata leadership fallback",
    },
    {
      tier: "email",
      label: "Email generation + verification",
      priority: 4,
      enabled: true,
      detail: `${getConfiguredEmailProviderName()} generation, ${getConfiguredEmailVerificationProviderName()} verification`,
    },
  ];
}

export async function getPipelineStackHealth(): Promise<{
  tiers: PipelineTierStatus[];
  searxngLive: boolean;
}> {
  const tiers = getPipelineStackConfig();
  const searxngLive = await isSearxngAvailable();

  return { tiers, searxngLive };
}
