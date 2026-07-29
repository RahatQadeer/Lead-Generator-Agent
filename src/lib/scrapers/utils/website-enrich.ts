import { enrichCompanyFromWebsite } from "@/lib/scraping/enrich-company";
import { createLogger } from "@/lib/logger";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";
import { normalizeDomain, normalizeText, normalizeUrl } from "@/lib/scrapers/utils/normalize";
import { toDiscoveredCompany } from "@/lib/scrapers/utils/to-discovered-company";
import { isValidEmail } from "@/lib/scrapers/utils/validate";
import {
  extractLeadership,
  findLeadershipPageUrl,
} from "@/lib/scrapers/utils/extract-leadership";
import { scrapePageHtml } from "@/lib/scraping/scrape-page";
import * as cheerio from "cheerio";
import type { ScraperFounder } from "@/lib/scrapers/types";

const log = createLogger("scrapers.website-enrich");

function extractPublicLinks(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const links = $("a[href]")
    .map((_, el) => $(el).attr("href") ?? "")
    .get()
    .filter(Boolean);

  const resolve = (href: string) => {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  };

  const findByPattern = (patterns: RegExp[]) => {
    for (const href of links) {
      const resolved = resolve(href);
      if (!resolved) continue;
      if (patterns.some((pattern) => pattern.test(resolved))) {
        return resolved;
      }
    }
    return null;
  };

  return {
    contactPageUrl: findByPattern([/\/contact/i, /\/get-in-touch/i]),
    careersPageUrl: findByPattern([/\/careers/i, /\/jobs/i]),
    pricingPageUrl: findByPattern([/\/pricing/i, /\/plans/i]),
    demoUrl: findByPattern([/\/demo/i, /\/request-demo/i]),
    documentationUrl: findByPattern([/\/docs/i, /\/documentation/i]),
    blogUrl: findByPattern([/\/blog/i, /\/news/i]),
  };
}

function mergeFounders(
  existing: ScraperFounder[],
  discovered: ScraperFounder[]
): ScraperFounder[] {
  const byName = new Map<string, ScraperFounder>();
  for (const person of [...existing, ...discovered]) {
    const key = person.name.trim().toLowerCase();
    if (!key) continue;
    const prev = byName.get(key);
    byName.set(key, {
      name: prev?.name ?? person.name,
      title: prev?.title ?? person.title ?? null,
      linkedinUrl: prev?.linkedinUrl ?? person.linkedinUrl ?? null,
    });
  }
  return [...byName.values()];
}

/**
 * Collect publicly listed leadership from the company's own site: the homepage
 * first, then a linked about/team/leadership page if the homepage yields none.
 * At most one extra page is fetched to keep the run cheap.
 */
async function discoverFounders(
  homepageHtml: string,
  baseUrl: string
): Promise<ScraperFounder[]> {
  const fromHome = extractLeadership(homepageHtml);
  if (fromHome.length > 0) return fromHome;

  const teamUrl = findLeadershipPageUrl(homepageHtml, baseUrl);
  if (!teamUrl || normalizeUrl(teamUrl) === normalizeUrl(baseUrl)) return fromHome;

  try {
    const teamPage = await scrapePageHtml(teamUrl);
    if (teamPage?.html) return extractLeadership(teamPage.html);
  } catch {
    // best-effort — a missing team page is not an error
  }
  return fromHome;
}

function extractPublicEmail(html: string, domain: string | null): string | null {
  if (!domain) return null;
  const matches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  for (const email of matches) {
    if (!email.toLowerCase().endsWith(`@${domain}`)) continue;
    if (isValidEmail(email)) return email.toLowerCase();
  }
  return null;
}

export async function enrichProfileFromWebsite(
  profile: ScrapedCompanyProfile,
  options: { respectRobots?: boolean } = {}
): Promise<ScrapedCompanyProfile> {
  const domain = normalizeDomain(profile.domain ?? profile.websiteUrl);
  if (!domain) return profile;

  try {
    const seedCompany = toDiscoveredCompany(profile);
    const enriched = await enrichCompanyFromWebsite(
      seedCompany,
      profile.industry ?? profile.category ?? ""
    );

    const websiteUrl = normalizeUrl(enriched.websiteUrl ?? profile.websiteUrl) ?? profile.websiteUrl;
    const page = websiteUrl ? await scrapePageHtml(websiteUrl) : null;
    const pageLinks = page ? extractPublicLinks(page.html, page.url) : null;
    const publicEmail =
      profile.publicEmail ??
      (page ? extractPublicEmail(page.html, domain) : null);

    // Publicly listed founders / leadership from the company's own site.
    const founders =
      page && websiteUrl
        ? mergeFounders(profile.founders, await discoverFounders(page.html, websiteUrl))
        : profile.founders;

    return {
      ...profile,
      // Directory data (YC/PH/etc.) is authoritative and clean — enrichment only
      // FILLS gaps, it must not overwrite a good name/industry with the website's
      // SEO <title> or meta-description blob.
      name: profile.name ?? enriched.name,
      founders,
      websiteUrl,
      domain: normalizeDomain(websiteUrl) ?? domain,
      description: profile.description ?? enriched.description,
      industry: profile.industry ?? enriched.industry,
      country: profile.country ?? enriched.country,
      city: profile.city ?? enriched.city,
      state: profile.state ?? enriched.state,
      publicEmail,
      contactPageUrl: profile.contactPageUrl ?? pageLinks?.contactPageUrl ?? null,
      careersPageUrl: profile.careersPageUrl ?? pageLinks?.careersPageUrl ?? null,
      socialLinks: {
        ...profile.socialLinks,
        linkedin: profile.socialLinks.linkedin ?? enriched.linkedinUrl ?? null,
      },
      teamSize: profile.teamSize ?? enriched.employeeCount,
      websiteExtras: {
        ...profile.websiteExtras,
        technologies:
          enriched.technologies?.length
            ? enriched.technologies
            : profile.websiteExtras.technologies,
        pricingPageUrl: profile.websiteExtras.pricingPageUrl ?? pageLinks?.pricingPageUrl ?? null,
        demoUrl: profile.websiteExtras.demoUrl ?? pageLinks?.demoUrl ?? null,
        documentationUrl:
          profile.websiteExtras.documentationUrl ?? pageLinks?.documentationUrl ?? null,
        blogUrl: profile.websiteExtras.blogUrl ?? pageLinks?.blogUrl ?? null,
      },
      errors: profile.errors,
    };
  } catch (error) {
    log.warn("Website enrichment failed", {
      company: profile.name,
      domain,
      error: String(error),
    });
    return {
      ...profile,
      errors: [...profile.errors, `Website enrichment failed: ${String(error)}`],
    };
  }
}

export function mergeProfileWarnings(
  profile: ScrapedCompanyProfile,
  warnings: string[]
): ScrapedCompanyProfile {
  if (warnings.length === 0) return profile;
  return {
    ...profile,
    errors: [...profile.errors, ...warnings.map((warning) => `Warning: ${warning}`)],
  };
}

export function cleanProfileText(profile: ScrapedCompanyProfile): ScrapedCompanyProfile {
  return {
    ...profile,
    name: normalizeText(profile.name) ?? profile.name,
    description: normalizeText(profile.description),
    industry: normalizeText(profile.industry),
    category: normalizeText(profile.category),
  };
}
