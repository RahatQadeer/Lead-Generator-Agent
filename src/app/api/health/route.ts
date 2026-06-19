import { NextResponse } from "next/server";
import { validateServerEnv } from "@/lib/env";
import { getConfiguredProviderName } from "@/lib/company-discovery/factory";
import { getConfiguredEmailVerificationProviderName } from "@/lib/email-verification/factory";
import { getConfiguredEmailProviderName } from "@/lib/email-generation/factory";
import { getConfiguredSendingProviderName } from "@/lib/email-sending/factory";
import { getConfiguredReplyTrackingProvider } from "@/lib/reply-tracking/factory";
import { isGooglePlacesConfigured } from "@/lib/scraping/google-places-search";
import { isOverpassConfigured } from "@/lib/scraping/overpass-search";
import { isOpenCorporatesConfigured } from "@/lib/scraping/opencorporates-search";
import { getPipelineStackHealth } from "@/lib/scraping/pipeline-stack";
import { isAiPageExtractionEnabled } from "@/lib/scraping/ai-page-extraction";
import { isApifyEnabled } from "@/lib/apify/config";
import { getScrapingToolHealth } from "@/lib/scraping/tool-health";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";

function isBusinessDirectoryConfigured(): boolean {
  const flag = process.env.BUSINESS_DIRECTORY_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return Boolean(getSearxngBaseUrl()) || isGooglePlacesConfigured();
}

export async function GET() {
  const envCheck = validateServerEnv();
  const directoryEnabled = process.env.COMPANY_DIRECTORY_ENABLED?.toLowerCase() !== "false";
  const stack = await getPipelineStackHealth();

  return NextResponse.json({
    status: envCheck.valid ? "ok" : "degraded",
    service: "lead-generator-agent",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
    pipeline: {
      tiers: stack.tiers,
      searxngLive: stack.searxngLive,
      searxngUrl: getSearxngBaseUrl(),
      aiExtraction: isAiPageExtractionEnabled(),
      apify: isApifyEnabled(),
      toolHealth: getScrapingToolHealth(),
    },
    providers: {
      companyDiscovery: getConfiguredProviderName(),
      emailVerification: getConfiguredEmailVerificationProviderName(),
      emailGeneration: getConfiguredEmailProviderName(),
      emailSending: getConfiguredSendingProviderName(),
      replyTracking: getConfiguredReplyTrackingProvider(),
      directorySeeds: {
        enabled: directoryEnabled,
        businessDirectory: isBusinessDirectoryConfigured(),
        googlePlaces: isGooglePlacesConfigured(),
        overpass: isOverpassConfigured(),
        openCorporates: isOpenCorporatesConfigured(),
        wikidata: true,
      },
    },
    environment: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      valid: envCheck.valid,
      warnings: envCheck.warnings,
      errors: envCheck.errors,
    },
  });
}
