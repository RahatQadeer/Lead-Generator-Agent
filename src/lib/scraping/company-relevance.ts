import { isHistoricalOrDefunctName } from "@/lib/scraping/company-search-filter";
import {
  isInvestorOrAcceleratorOrganization,
  isNonCommercialOrganization,
} from "@/lib/scraping/org-type-blockers";
import {
  classifyIndustryFromText,
  resolveIndustryProfile,
} from "@/lib/scraping/industry-classifier";
import type { DiscoveredCompany } from "@/types/company";

/** Media, publishing, and news — not target B2B SaaS / tech companies. */
const MEDIA_PUBLISHING_DOMAINS = new Set([
  "fortune.com",
  "forbes.com",
  "bloomberg.com",
  "reuters.com",
  "wsj.com",
  "nytimes.com",
  "businessinsider.com",
  "techcrunch.com",
  "venturebeat.com",
  "theverge.com",
  "wired.com",
  "cnbc.com",
  "bbc.com",
  "cnn.com",
  "hbr.org",
  "economist.com",
  "ft.com",
  "time.com",
  "inc.com",
  "fastcompany.com",
  "entrepreneur.com",
]);

const MEDIA_PUBLISHING_SIGNALS =
  /\b(magazine|publisher|publishing|newspaper|newsroom|media group|broadcasting|television network|cable news|journalism|editorial|fortune 500 list|business media)\b/i;

const CONGLOMERATE_SIGNALS =
  /\b(conglomerate|diversified holdings|multinational corporation|fortune 500|global 500|s&p 500|holding company|parent company of|subsidiaries across)\b/i;

const HISTORICAL_ENTITY_SIGNALS =
  /\b(defunct|dissolved|former company|was acquired|merged into|bankruptcy|ceased operations|no longer operating|historical company|formerly known as)\b/i;

/** Hardware / telecom / semiconductor — excluded from SaaS/software searches. */
const NON_SAAS_TECH_SIGNALS =
  /\b(hardware|semiconductor|semiconductors|chip maker|chipmaker|telecom|telecommunications|telecommunication|mobile operator|wireless carrier|network equipment|networking equipment|fpga|foundry|router manufacturer|switch manufacturer|base station|handset|smartphone maker|device manufacturer|storage hardware|server hardware|optical networking|5g equipment)\b/i;

const STRONG_SAAS_SIGNALS =
  /\b(saas|software as a service|b2b software|cloud software|software platform|subscription software|enterprise software|software company|software product|api platform|devtools|developer tools|application software)\b/i;

const STRONG_TECH_SIGNALS =
  /\b(software|saas|cloud software|cloud platform|cybersecurity|devops|machine learning|artificial intelligence|\bai platform|data platform|it services|technology company|software company|software product|enterprise software)\b/i;

function normalizeDomain(domain: string | null | undefined): string {
  return (domain ?? "").toLowerCase().replace(/^www\./, "");
}

function companyText(company: {
  name?: string | null;
  domain?: string | null;
  industry?: string | null;
  description?: string | null;
}): string {
  return [company.name, company.domain, company.industry, company.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isHistoricalCompanyProfile(
  company: Pick<DiscoveredCompany, "name" | "domain" | "description" | "industry">
): boolean {
  if (isHistoricalOrDefunctName(company.name ?? "")) return true;
  return HISTORICAL_ENTITY_SIGNALS.test(companyText(company));
}

export function isMediaOrPublishingCompany(
  company: Pick<DiscoveredCompany, "name" | "domain" | "description" | "industry">
): boolean {
  const domain = normalizeDomain(company.domain);
  if (MEDIA_PUBLISHING_DOMAINS.has(domain)) return true;

  return MEDIA_PUBLISHING_SIGNALS.test(companyText(company));
}

export function isEnterpriseConglomerate(
  company: Pick<DiscoveredCompany, "name" | "domain" | "description" | "industry">
): boolean {
  return CONGLOMERATE_SIGNALS.test(companyText(company));
}

export function isNonSaasTechCompany(
  company: Pick<DiscoveredCompany, "name" | "domain" | "description" | "industry">
): boolean {
  return NON_SAAS_TECH_SIGNALS.test(companyText(company));
}

export function searchTargetsSaas(input: {
  industry: string;
  keywords: string[];
}): boolean {
  const industry = input.industry.toLowerCase();
  if (/\bsaas\b|software as a service|b2b software|cloud software/.test(industry)) {
    return true;
  }

  return input.keywords.some((keyword) =>
    /\b(saas|software as a service|b2b software|cloud software)\b/i.test(keyword.trim())
  );
}

export function searchTargetsTechnology(input: {
  industry: string;
  keywords: string[];
}): boolean {
  const profile = [input.industry, ...input.keywords].join(" ").toLowerCase();
  return /\btech(nology)?\b|software|saas|it services|startup/.test(profile);
}

export function searchTargetsMediaOrEntertainment(input: {
  industry: string;
  keywords?: string[];
}): boolean {
  const profile = [input.industry, ...(input.keywords ?? [])].join(" ").toLowerCase();
  return /\bmedia\b|entertainment|streaming|film production|broadcast|publishing|gaming/.test(
    profile
  );
}

const KEYWORD_SYNONYMS: Record<string, readonly string[]> = {
  b2b: ["b2b", "business to business", "business-to-business", "enterprise", "saas"],
  software: ["software", "saas", "application", "platform", "it services", "technology"],
  saas: ["saas", "software as a service", "cloud software", "subscription"],
  startup: ["startup", "start-up", "scale-up"],
  tech: ["tech", "technology"],
  healthtech: [
    "healthtech",
    "health tech",
    "digital health",
    "healthcare",
    "health care",
    "medtech",
    "medical",
    "telehealth",
  ],
  healthcare: [
    "healthcare",
    "health care",
    "healthtech",
    "health tech",
    "digital health",
    "medtech",
    "medical",
    "patient",
  ],
  medical: ["medical", "healthcare", "health care", "healthtech", "clinic", "hospital"],
};

const HEALTH_KEYWORD_CLUSTER =
  /\b(healthtech|health tech|healthcare|health care|digital health|medtech|medical|telehealth|patient|clinical)\b/i;

function keywordsShareCluster(keywords: string[]): boolean {
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  if (normalized.length <= 1) return false;
  return normalized.every(
    (keyword) =>
      HEALTH_KEYWORD_CLUSTER.test(keyword) ||
      KEYWORD_SYNONYMS.healthtech?.includes(keyword) ||
      KEYWORD_SYNONYMS.healthcare?.includes(keyword)
  );
}

function keywordAppearsInText(keyword: string, text: string): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;

  if (text.includes(normalized)) return true;

  const synonyms = KEYWORD_SYNONYMS[normalized];
  if (synonyms?.some((term) => text.includes(term))) return true;

  if (normalized.length >= 4) {
    return new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      text
    );
  }

  return false;
}

/** Query keywords — synonym-aware; B2B + software must not require literal "b2b" on every site. */
export function matchesSearchKeywords(
  company: Pick<DiscoveredCompany, "name" | "domain" | "description" | "industry">,
  keywords: string[]
): boolean {
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return true;

  const text = companyText(company);
  const requiresB2b = normalized.includes("b2b");
  const requiresSoftware = normalized.some((keyword) =>
    ["software", "saas", "cloud software", "b2b software"].includes(keyword)
  );
  const effectiveKeywords =
    requiresB2b && requiresSoftware ? normalized.filter((keyword) => keyword !== "b2b") : normalized;

  if (keywordsShareCluster(effectiveKeywords)) {
    return effectiveKeywords.some((keyword) => keywordAppearsInText(keyword, text));
  }

  return effectiveKeywords.every((keyword) => keywordAppearsInText(keyword, text));
}

export function hasStrongTechOrSaasSignal(
  company: Pick<DiscoveredCompany, "name" | "domain" | "description" | "industry">,
  saasMode: boolean
): boolean {
  const text = companyText(company);
  const industry = (company.industry ?? "").toLowerCase();

  if (saasMode) {
    return STRONG_SAAS_SIGNALS.test(text) || /\bsaas\b|\bsoftware\b/.test(industry);
  }

  return (
    STRONG_TECH_SIGNALS.test(text) ||
    /\btechnology\b|\bsoftware\b|\bsaas\b/.test(industry)
  );
}

export function hasConflictingIndustry(
  company: Pick<DiscoveredCompany, "name" | "domain" | "description" | "industry">,
  targetIndustry: string
): boolean {
  const profile = resolveIndustryProfile(targetIndustry);
  if (!profile) return false;

  const text = companyText(company);
  if (profile.excludeKeywords.test(text)) return true;

  const targetNorm = profile.label.toLowerCase();
  const companyIndustry = (company.industry ?? "").toLowerCase();
  if (
    companyIndustry === targetNorm ||
    companyIndustry.includes("technology") ||
    companyIndustry.includes("software")
  ) {
    if (profile.keywords.test(text) || /\bsoftware\b|\btechnology\b|\bsaas\b/i.test(text)) {
      return false;
    }
  }

  const detected = classifyIndustryFromText(text);
  if (detected && detected !== profile.label) {
    if (profile.keywords.test(text)) return false;
    if (
      profile.id === "healthcare" &&
      detected === "Technology" &&
      /\b(healthtech|health tech|digital health|medtech|telehealth|patient|clinical|medical software|healthcare software)\b/i.test(
        text
      )
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export interface CompanyRelevanceInput {
  industry: string;
  keywords: string[];
}

/** When the user explicitly targets nonprofits, government, etc., do not block those org types. */
export function allowsOrgTypeForTargetIndustry(
  blockReason: string | null,
  targetIndustry: string
): boolean {
  if (!blockReason) return false;
  const industry = targetIndustry.toLowerCase();

  if (blockReason === "nonprofit") {
    return /\b(nonprofit|non-profit|ngo|charity)\b/.test(industry);
  }
  if (blockReason === "government") {
    return /\b(government|public sector)\b/.test(industry);
  }
  if (blockReason === "university") {
    return /\b(education|edtech|university|academic)\b/.test(industry);
  }
  if (blockReason === "museum") {
    return /\b(museum|arts|culture|heritage)\b/.test(industry);
  }
  if (blockReason === "media_publishing") {
    return searchTargetsMediaOrEntertainment({ industry: targetIndustry });
  }

  return false;
}

export interface CompanyRelevanceResult {
  relevant: boolean;
  reason: string | null;
}

/** Hard rejects: media, historical, conflicting industry, non-SaaS tech for SaaS queries. */
export function passesHardRelevanceBlockers(
  company: DiscoveredCompany,
  search: CompanyRelevanceInput
): CompanyRelevanceResult {
  if (isHistoricalCompanyProfile(company)) {
    return { relevant: false, reason: "historical_or_person" };
  }

  if (
    isMediaOrPublishingCompany(company) &&
    !searchTargetsMediaOrEntertainment(search)
  ) {
    return { relevant: false, reason: "media_publishing" };
  }

  if (hasConflictingIndustry(company, search.industry)) {
    return { relevant: false, reason: "conflicting_industry" };
  }

  if (searchTargetsSaas(search) && isNonSaasTechCompany(company)) {
    return { relevant: false, reason: "non_saas_tech" };
  }

  const orgBlock = isNonCommercialOrganization({
    name: company.name ?? "",
    description: company.description,
    domain: company.domain,
  });
  if (orgBlock.blocked && !allowsOrgTypeForTargetIndustry(orgBlock.reason, search.industry)) {
    return { relevant: false, reason: "non_commercial_org" };
  }

  if (
    isInvestorOrAcceleratorOrganization({
      name: company.name ?? "",
      description: company.description,
      domain: company.domain,
    }).blocked
  ) {
    return { relevant: false, reason: "investor_accelerator" };
  }

  return { relevant: true, reason: null };
}

/** Strict relevance — exact keyword + industry signals; no scope expansion. */
export function assessCompanyRelevance(
  company: DiscoveredCompany,
  search: CompanyRelevanceInput
): CompanyRelevanceResult {
  const hard = passesHardRelevanceBlockers(company, search);
  if (!hard.relevant) return hard;

  if (!matchesSearchKeywords(company, search.keywords)) {
    return { relevant: false, reason: "keyword_mismatch" };
  }

  const techSearch = searchTargetsTechnology(search);
  const saasSearch = searchTargetsSaas(search);

  if (techSearch || saasSearch) {
    if (isEnterpriseConglomerate(company)) {
      return { relevant: false, reason: "enterprise_conglomerate" };
    }

    const text = companyText(company);
    const hasSoftwareKeyword = search.keywords.some((k) =>
      /\b(software|saas|b2b)\b/i.test(k)
    );

    if (
      !hasStrongTechOrSaasSignal(company, saasSearch) &&
      !(hasSoftwareKeyword && /\bsoftware\b/i.test(text))
    ) {
      return { relevant: false, reason: "weak_tech_signal" };
    }
  }

  return { relevant: true, reason: null };
}
