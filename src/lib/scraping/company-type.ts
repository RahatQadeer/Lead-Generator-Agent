import type { DiscoveredCompany } from "@/types/company";

export type CompanyType =
  | "saas"
  | "ecommerce"
  | "marketplace"
  | "fintech"
  | "agency"
  | "vc"
  | "accelerator"
  | "investment_firm"
  | "news_media"
  | "community"
  | "service_provider"
  | "operating_company"
  | "unknown";

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  saas: "SaaS",
  ecommerce: "E-commerce",
  marketplace: "Marketplace",
  fintech: "FinTech",
  agency: "Agency",
  vc: "Venture capital",
  accelerator: "Accelerator",
  investment_firm: "Investment firm",
  news_media: "News / media",
  community: "Community",
  service_provider: "Service provider",
  operating_company: "Operating company",
  unknown: "Unknown",
};

const NON_OPERATING_TYPES = new Set<CompanyType>([
  "vc",
  "accelerator",
  "investment_firm",
  "news_media",
  "community",
]);

const ACCELERATOR_NAME_PATTERN =
  /\b(y combinator|techstars|500 global|500 startups|plug and play|startupbootcamp|masschallenge|antler\b|era\b accelerator|seedcamp)\b/i;

const INVESTMENT_FIRM_PATTERN =
  /\b(private equity|growth equity|buyout firm|investment firm|investment company|asset manager|venture fund|capital partners|growth investor|verdane|eqt\b|kinnevik|norrsken)\b/i;

const VC_PATTERN =
  /\b(venture capital|\bvc\b|seed fund|early[- ]stage fund|angel fund)\b/i;

const ACCELERATOR_PATTERN =
  /\b(startup accelerator|accelerator program|business incubator|startup incubator|incubator program|accelerator\b)\b/i;

const NEWS_MEDIA_PATTERN =
  /\b(newsroom|newspaper|magazine|publisher|publishing|journalism|media group|broadcasting)\b/i;

const COMMUNITY_PATTERN =
  /\b(community platform|membership community|professional network|forum for|nonprofit community)\b/i;

const ECOMMERCE_PATTERN =
  /\b(ecommerce|e-commerce|online store|online shop|webshop|direct[- ]to[- ]consumer|dtc brand|retail brand|fashion brand|sell(s|ing) online|checkout|shopping cart|shopify store)\b/i;

const MARKETPLACE_PATTERN =
  /\b(marketplace|two-sided platform|buyers and sellers|vendor platform|multi-vendor)\b/i;

const SAAS_PATTERN =
  /\b(saas|software as a service|subscription software|cloud software|software platform)\b/i;

const FINTECH_PATTERN =
  /\b(fintech|payment(s)? platform|digital bank|neobank|lending platform|insurtech)\b/i;

const AGENCY_PATTERN =
  /\b(digital agency|creative agency|consulting firm|professional services|dev shop|development agency)\b/i;

const KNOWN_ACCELERATOR_DOMAINS = new Set([
  "ycombinator.com",
  "techstars.com",
  "500.co",
  "plugandplaytechcenter.com",
  "seedcamp.com",
]);

const KNOWN_INVESTMENT_DOMAINS = new Set([
  "verdane.com",
  "eqtgroup.com",
  "kinnevik.com",
  "norrsken.org",
  "sequoiacap.com",
  "a16z.com",
  "accel.com",
]);

function companyText(company: Pick<DiscoveredCompany, "name" | "domain" | "description" | "industry">): string {
  return [company.name, company.domain, company.industry, company.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeDomain(domain: string | null | undefined): string {
  return (domain ?? "").toLowerCase().replace(/^www\./, "");
}

export function detectCompanyType(
  company: Pick<DiscoveredCompany, "name" | "domain" | "description" | "industry">
): { type: CompanyType; label: string } {
  const text = companyText(company);
  const domain = normalizeDomain(company.domain);

  if (KNOWN_ACCELERATOR_DOMAINS.has(domain) || ACCELERATOR_NAME_PATTERN.test(text)) {
    return { type: "accelerator", label: COMPANY_TYPE_LABELS.accelerator };
  }

  if (KNOWN_INVESTMENT_DOMAINS.has(domain) || INVESTMENT_FIRM_PATTERN.test(text)) {
    return { type: "investment_firm", label: COMPANY_TYPE_LABELS.investment_firm };
  }

  if (ACCELERATOR_PATTERN.test(text)) {
    return { type: "accelerator", label: COMPANY_TYPE_LABELS.accelerator };
  }

  if (VC_PATTERN.test(text) && !/\b(software company|saas|our product)\b/i.test(text)) {
    return { type: "vc", label: COMPANY_TYPE_LABELS.vc };
  }

  if (NEWS_MEDIA_PATTERN.test(text)) {
    return { type: "news_media", label: COMPANY_TYPE_LABELS.news_media };
  }

  if (COMMUNITY_PATTERN.test(text)) {
    return { type: "community", label: COMPANY_TYPE_LABELS.community };
  }

  if (ECOMMERCE_PATTERN.test(text)) {
    return { type: "ecommerce", label: COMPANY_TYPE_LABELS.ecommerce };
  }

  if (MARKETPLACE_PATTERN.test(text)) {
    return { type: "marketplace", label: COMPANY_TYPE_LABELS.marketplace };
  }

  if (SAAS_PATTERN.test(text)) {
    return { type: "saas", label: COMPANY_TYPE_LABELS.saas };
  }

  if (FINTECH_PATTERN.test(text)) {
    return { type: "fintech", label: COMPANY_TYPE_LABELS.fintech };
  }

  if (AGENCY_PATTERN.test(text)) {
    return { type: "agency", label: COMPANY_TYPE_LABELS.agency };
  }

  if (/\b(outsourcing|staff augmentation|it services provider)\b/i.test(text)) {
    return { type: "service_provider", label: COMPANY_TYPE_LABELS.service_provider };
  }

  return { type: "operating_company", label: COMPANY_TYPE_LABELS.operating_company };
}

export function isNonOperatingCompanyType(type: CompanyType): boolean {
  return NON_OPERATING_TYPES.has(type);
}

/** Map search industry to company types that may proceed to people discovery. */
export function allowedTypesForIndustry(targetIndustry: string): Set<CompanyType> | null {
  const industry = targetIndustry.trim().toLowerCase();
  if (!industry) return null;

  if (industry.includes("e-commerce") || industry.includes("ecommerce")) {
    return new Set(["ecommerce", "marketplace", "operating_company"]);
  }

  if (industry === "saas" || industry.includes("software")) {
    return new Set(["saas", "operating_company"]);
  }

  if (industry.includes("fintech") || industry.includes("financial")) {
    return new Set(["fintech", "operating_company"]);
  }

  if (industry.includes("technology") || industry.includes("tech")) {
    return new Set(["saas", "operating_company", "agency"]);
  }

  if (industry.includes("consulting") || industry.includes("agency")) {
    return new Set(["agency", "service_provider", "operating_company"]);
  }

  if (
    industry.includes("health") ||
    industry.includes("medical") ||
    industry.includes("pharma") ||
    industry.includes("biotech")
  ) {
    return new Set(["saas", "service_provider", "operating_company", "agency"]);
  }

  if (industry.includes("media") || industry.includes("entertainment")) {
    return new Set(["operating_company", "service_provider"]);
  }

  return new Set([
    "ecommerce",
    "marketplace",
    "saas",
    "fintech",
    "agency",
    "operating_company",
  ]);
}

export function companyTypeMatchesTargetIndustry(
  type: CompanyType,
  targetIndustry: string
): boolean {
  const industry = targetIndustry.trim().toLowerCase();
  const mediaTarget = industry.includes("media") || industry.includes("entertainment");

  if (isNonOperatingCompanyType(type)) {
    if (mediaTarget && type === "news_media") return true;
    return false;
  }

  const allowed = allowedTypesForIndustry(targetIndustry);
  if (!allowed) return true;

  if (allowed.has(type)) return true;

  if (type === "service_provider") {
    const industry = targetIndustry.trim().toLowerCase();
    if (
      industry.includes("health") ||
      industry.includes("medical") ||
      industry.includes("consulting") ||
      industry.includes("technology")
    ) {
      return true;
    }
  }

  // Unknown type: require strong industry field signal elsewhere — fail type check
  if (type === "unknown") return false;

  return false;
}
