import type { CompanyCriteriaFilters } from "@/lib/company-discovery/apply-criteria";
import {
  matchesCountry,
  matchesIndustry,
  matchesSize,
} from "@/lib/company-discovery/apply-criteria-helpers";
import { passesHardRelevanceBlockers } from "@/lib/scraping/company-relevance";
import {
  classifyIndustryFromText,
  companyMatchesIndustry,
  MIN_INDUSTRY_MATCH_SCORE,
} from "@/lib/scraping/industry-classifier";
import {
  companyTypeMatchesTargetIndustry,
  detectCompanyType,
  isNonOperatingCompanyType,
} from "@/lib/scraping/company-type";
import { formatEmployeeRange } from "@/lib/scraping/firmographics";
import { applyKnownBrandToCompany, resolveKnownBrand } from "@/lib/scraping/known-brands";
import type { DiscoveredCompany } from "@/types/company";

export interface CompanyValidationResult {
  accepted: boolean;
  reasons: string[];
  warnings: string[];
  companyType: string;
  sizeStatus: "verified" | "unknown" | "out_of_range" | "not_required";
}

const STRONG_ECOMMERCE_SIGNALS =
  /\b(ecommerce|e-commerce|online store|online shop|webshop|dtc|direct[- ]to[- ]consumer|retail brand|fashion brand|sell(s|ing) (online|products)|shopify)\b/i;

function buildCompanyIndustryText(company: DiscoveredCompany): string {
  return [company.name, company.domain, company.industry, company.description, company.websiteUrl]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function validateIndustryCategory(
  company: DiscoveredCompany,
  targetIndustry: string
): string | null {
  if (!targetIndustry.trim()) return null;

  const text = buildCompanyIndustryText(company);
  const detected = classifyIndustryFromText(text);
  const match = companyMatchesIndustry(
    {
      name: company.name,
      domain: company.domain,
      industry: company.industry,
      description: company.description,
      websiteUrl: company.websiteUrl,
    },
    targetIndustry
  );

  const targetNorm = targetIndustry.toLowerCase();
  const isEcommerceTarget =
    targetNorm.includes("e-commerce") || targetNorm.includes("ecommerce");

  const knownBrand = resolveKnownBrand(company.domain);
  if (isEcommerceTarget && knownBrand) {
    return null;
  }

  if (isEcommerceTarget) {
    if (!STRONG_ECOMMERCE_SIGNALS.test(text) && !match.matches) {
      return `Required industry = ${targetIndustry}`;
    }
    if (
      detected &&
      !["Retail", "Technology"].includes(detected) &&
      match.score < MIN_INDUSTRY_MATCH_SCORE
    ) {
      return `Detected industry = ${detected}; required = ${targetIndustry}`;
    }
  }

  if (!matchesIndustry(company, targetIndustry)) {
    const detectedLabel = detected ?? company.industry ?? "unknown";
    const hasUnknownIndustry =
      !company.industry?.trim() &&
      !detected &&
      !/\b(bank|insurance|hospital|university|government|newspaper|magazine)\b/i.test(text);

    if (hasUnknownIndustry) {
      return null;
    }

    return `Industry mismatch (detected: ${detectedLabel}; required: ${targetIndustry})`;
  }

  if (match.conflictingIndustry) {
    return `Conflicting industry signal (detected: ${detected ?? "other"})`;
  }

  return null;
}

function validateSize(
  company: DiscoveredCompany,
  min: number | null,
  max: number | null
): { error: string | null; warning: string | null; status: CompanyValidationResult["sizeStatus"] } {
  if (min === null && max === null) {
    return { error: null, warning: null, status: "not_required" };
  }

  if (company.employeeCount === null) {
    return {
      error: null,
      warning: `Employee count unknown (filter: ${formatEmployeeRange(null, min, max) ?? `${min}-${max}`})`,
      status: "unknown",
    };
  }

  if (!matchesSize(company, min, max)) {
    return {
      error: `Size ${company.employeeCount} outside required range (${min ?? "—"}–${max ?? "—"})`,
      warning: null,
      status: "out_of_range",
    };
  }

  return { error: null, warning: null, status: "verified" };
}

/**
 * Strict validation before people discovery — rejects investors, accelerators,
 * and industry mismatches with human-readable reasons.
 */
export function validateCompanyForDiscovery(
  company: DiscoveredCompany,
  filters: CompanyCriteriaFilters
): CompanyValidationResult {
  const enriched = applyKnownBrandToCompany(company);
  const reasons: string[] = [];
  const warnings: string[] = [];
  const { type, label: companyType } = detectCompanyType(enriched);

  const search = {
    industry: filters.industry,
    keywords: filters.keywords ?? [],
  };

  const hardBlock = passesHardRelevanceBlockers(enriched, search);
  if (!hardBlock.relevant) {
    reasons.push(humanizeRejectionCode(hardBlock.reason));
  }

  const mediaTarget =
    filters.industry.toLowerCase().includes("media") ||
    filters.industry.toLowerCase().includes("entertainment");

  if (isNonOperatingCompanyType(type) && !(mediaTarget && type === "news_media")) {
    reasons.push(`Company type = ${companyType}`);
  } else if (
    filters.industry &&
    !companyTypeMatchesTargetIndustry(type, filters.industry) &&
    !resolveKnownBrand(enriched.domain)
  ) {
    reasons.push(`Company type = ${companyType}`);
  }

  const industryError = validateIndustryCategory(enriched, filters.industry);
  if (industryError && !reasons.includes(industryError)) {
    reasons.push(industryError);
  }

  if (filters.country.trim() && !matchesCountry(enriched, filters.country)) {
    reasons.push(`Country mismatch (required: ${filters.country})`);
  }

  const sizeCheck = validateSize(
    enriched,
    filters.companySizeMin,
    filters.companySizeMax
  );
  if (sizeCheck.error) {
    reasons.push(sizeCheck.error);
  } else if (sizeCheck.warning) {
    warnings.push(sizeCheck.warning);
  }

  return {
    accepted: reasons.length === 0,
    reasons: [...new Set(reasons)],
    warnings,
    companyType,
    sizeStatus: sizeCheck.status,
  };
}

function humanizeRejectionCode(code: string | null): string {
  switch (code) {
    case "investor_accelerator":
      return "Company type = Investor / accelerator";
    case "media_publishing":
      return "Company type = News / media";
    case "non_commercial_org":
      return "Non-commercial organization";
    case "historical_or_person":
      return "Historical or defunct entity";
    case "conflicting_industry":
      return "Conflicting industry";
    default:
      return code ? `Rejected: ${code.replace(/_/g, " ")}` : "Failed relevance check";
  }
}

export interface RejectedCompanyView {
  name: string;
  domain: string | null;
  companyType: string;
  reasons: string[];
}

export function toRejectedCompanyView(
  company: DiscoveredCompany,
  validation: CompanyValidationResult
): RejectedCompanyView {
  return {
    name: company.name,
    domain: company.domain,
    companyType: validation.companyType,
    reasons: validation.reasons,
  };
}
