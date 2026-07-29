import { isGenericCompanyEmail } from "@/lib/scraping/data-quality";
import { isLikelyCompanyDomain } from "@/lib/scraping/extract-domain";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";
import { normalizeDomain, normalizeText, normalizeUrl } from "@/lib/scrapers/utils/normalize";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function isValidEmail(email: string): boolean {
  if (!EMAIL_RE.test(email)) return false;
  if (isGenericCompanyEmail(email)) return false;
  return true;
}

export async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "LeadForgeBot/1.0 (+https://righttail.com)" },
    });
    return response.ok || response.status === 405 || response.status === 403;
  } catch {
    return false;
  }
}

export function validateScrapedProfile(profile: ScrapedCompanyProfile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!normalizeText(profile.name)) {
    errors.push("Missing company name");
  }

  if (profile.websiteUrl) {
    const normalized = normalizeUrl(profile.websiteUrl);
    if (!normalized) {
      errors.push("Invalid website URL");
    } else {
      const domain = normalizeDomain(normalized);
      if (!domain || !isLikelyCompanyDomain(domain)) {
        warnings.push("Website domain looks like a directory or blocked host");
      }
    }
  } else {
    warnings.push("Missing official website");
  }

  if (profile.publicEmail && !isValidEmail(profile.publicEmail)) {
    warnings.push("Public email failed validation");
  }

  if (!profile.description) {
    warnings.push("Missing description");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
