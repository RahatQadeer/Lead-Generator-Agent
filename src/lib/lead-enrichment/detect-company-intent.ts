import { createLogger } from "@/lib/logger";
import {
  detectCompanyIntentSignals,
  type CompanyIntentInput,
} from "@/lib/lead-enrichment/intent-signals";
import { normalizeWebsiteUrl } from "@/lib/scraping/extract-domain";
import { FAST_FETCH, fetchPage } from "@/lib/scraping/http-client";
import type { IntentAnalysis } from "@/types/intent-signals";

const log = createLogger("lead-enrichment.detect-intent");

const CAREERS_PATHS = ["/careers", "/jobs", "/join-us", "/work-with-us"];

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchCareersSnippet(domain: string | null | undefined): Promise<string | null> {
  if (!domain) return null;

  const origin = normalizeWebsiteUrl(domain.replace(/^www\./, ""));

  for (const path of CAREERS_PATHS) {
    const page = await fetchPage(`${origin}${path}`, FAST_FETCH);
    if (!page?.html || page.html.length < 200) continue;

    const text = htmlToText(page.html).slice(0, 2500);
    if (text.length > 80) {
      return text;
    }
  }

  return null;
}

export interface CompanyIntentTarget {
  companyId: string;
  name: string;
  domain?: string | null;
  description?: string | null;
  industry?: string | null;
  technologies?: string[] | null;
}

/** Detect buying-intent signals for one company (description + optional careers page). */
export async function detectIntentForCompany(
  company: CompanyIntentTarget
): Promise<IntentAnalysis> {
  const careersText = await fetchCareersSnippet(company.domain);
  const input: CompanyIntentInput = {
    name: company.name,
    description: company.description,
    industry: company.industry,
    technologies: company.technologies,
    websiteText: careersText,
  };

  const analysis = detectCompanyIntentSignals(input);

  if (analysis.signals.length > 0) {
    log.info("Intent signals detected", {
      company: company.name,
      score: analysis.score,
      signals: analysis.signals.map((signal) => signal.id),
    });
  }

  return analysis;
}

/** Batch intent detection — one scrape per company, applied to all its contacts. */
export async function detectIntentByCompany(
  companies: CompanyIntentTarget[]
): Promise<Map<string, IntentAnalysis>> {
  const results = new Map<string, IntentAnalysis>();

  for (const company of companies) {
    results.set(company.companyId, await detectIntentForCompany(company));
  }

  return results;
}
