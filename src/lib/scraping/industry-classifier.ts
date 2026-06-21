/**
 * Keyword-based industry classification for scraped companies.
 * Prevents cross-industry leakage (e.g. Hospitality search returning banks).
 */

import { INDUSTRY_SEARCH_ALIASES } from "@/lib/search/constants";

export interface IndustryProfile {
  id: string;
  label: string;
  aliases: string[];
  keywords: RegExp;
  /** Strong signals for a different industry — if matched, reject the company. */
  excludeKeywords: RegExp;
}

export const INDUSTRY_PROFILES: IndustryProfile[] = [
  {
    id: "hospitality",
    label: "Hospitality",
    aliases: ["hotels", "hotel", "lodging", "tourism", "travel", "restaurant"],
    keywords:
      /\b(hotel|resort|hospitality|lodging|motel|inn\b|restaurant|dining|catering|banquet|spa\b|casino|travel|tourism|airline|cruise|hostel|bed and breakfast|b&b|food service|accommodation)\b/i,
    excludeKeywords:
      /\b(bank|banking|financial services|insurance|petroleum|oil and gas|oilfield|mining|investment bank|credit union|mortgage|lending)\b/i,
  },
  {
    id: "healthcare",
    label: "Healthcare",
    aliases: ["health", "medical", "pharma", "pharmaceutical", "biotech", "healthtech", "medtech"],
    keywords:
      /\b(healthcare|health care|healthtech|health tech|digital health|hospital|clinic|medical|physician|pharma|pharmaceutical|biotech|life sciences|diagnostic|patient|nursing|dental|telehealth|medtech)\b/i,
    excludeKeywords:
      /\b(bank|oil and gas|petroleum|mining|hospitality|hotel|restaurant|casino)\b/i,
  },
  {
    id: "technology",
    label: "Technology",
    aliases: ["tech", "software", "saas", "it", "information technology"],
    keywords:
      /\b(software|saas|software company|technology company|tech startup|tech company|cloud platform|cloud software|cybersecurity|devops|artificial intelligence|\bai\b|machine learning|data platform|it services|developer tools|enterprise software|b2b software|software platform|api platform|\btech\b|\btechnology\b)\b/i,
    excludeKeywords:
      /\b(bank\b|insurance carrier|oil and gas|petroleum refinery|mining company|hotel chain|restaurant chain|magazine|publisher|publishing|newspaper|media group|broadcasting|television network|entertainment company|retail chain|supermarket chain|conglomerate|holding company|fortune 500 list|business media|news organization|hardware|semiconductor|telecom|telecommunications|mobile operator|wireless carrier|network equipment|chip maker|foundry)\b/i,
  },
  {
    id: "finance",
    label: "Finance",
    aliases: ["banking", "financial", "fintech", "insurance"],
    keywords:
      /\b(bank|banking|financial services|investment|asset management|wealth management|insurance|fintech|credit union|capital markets|private equity|venture capital|lending|mortgage)\b/i,
    excludeKeywords:
      /\b(hotel|resort|restaurant|hospitality|petroleum|oilfield|mining|hospital|clinic)\b/i,
  },
  {
    id: "oil_gas",
    label: "Oil & Gas",
    aliases: ["energy", "petroleum", "oil", "gas"],
    keywords:
      /\b(oil and gas|petroleum|oilfield|upstream|downstream|refinery|drilling|energy company|natural gas|lng\b|pipeline|offshore rig)\b/i,
    excludeKeywords:
      /\b(bank|hotel|restaurant|hospitality|hospital|software company|saas)\b/i,
  },
  {
    id: "retail",
    label: "Retail",
    aliases: ["ecommerce", "e-commerce", "consumer"],
    keywords:
      /\b(retail|ecommerce|e-commerce|consumer goods|fashion|apparel|grocery|supermarket|merchandise|store chain|marketplace)\b/i,
    excludeKeywords:
      /\b(bank|investment bank|private equity|venture capital|accelerator|incubator|oil and gas|petroleum|hospital)\b/i,
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    aliases: ["industrial", "factory"],
    keywords:
      /\b(manufacturing|industrial|factory|production plant|assembly|machinery|automotive|aerospace|semiconductor|fabrication)\b/i,
    excludeKeywords:
      /\b(bank|hotel|restaurant|hospital|software-only)\b/i,
  },
  {
    id: "real_estate",
    label: "Real Estate",
    aliases: ["property", "proptech"],
    keywords:
      /\b(real estate|property management|proptech|commercial real estate|reit\b|landlord|leasing|brokerage)\b/i,
    excludeKeywords:
      /\b(bank|oil and gas|hospital|software saas)\b/i,
  },
  {
    id: "media",
    label: "Media & Entertainment",
    aliases: ["media", "entertainment", "streaming", "gaming", "film", "publishing", "broadcast"],
    keywords:
      /\b(media|entertainment|streaming|broadcast|broadcasting|television|tv network|film|movie|production studio|production company|gaming|game studio|publisher|publishing|newsroom|magazine|ott\b|video platform|content studio|music label|theatre|theater)\b/i,
    excludeKeywords:
      /\b(bank|oil and gas|petroleum|mining company|insurance carrier)\b/i,
  },
];

function normalizeIndustryInput(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function resolveIndustryProfile(targetIndustry: string): IndustryProfile | null {
  const normalized = normalizeIndustryInput(targetIndustry);
  if (!normalized) return null;

  const labelAliases: Record<string, string> = {
    saas: "technology",
    edtech: "technology",
    cybersecurity: "technology",
    telecommunications: "technology",
    biotechnology: "healthcare",
    pharmaceuticals: "healthcare",
    healthtech: "healthcare",
    medtech: "healthcare",
    insurance: "finance",
    "financial services": "finance",
    "e-commerce": "retail",
    ecommerce: "retail",
    "oil & gas": "oil_gas",
    "oil and gas": "oil_gas",
    energy: "oil_gas",
    "media & entertainment": "media",
    automotive: "manufacturing",
    aerospace: "manufacturing",
    construction: "manufacturing",
    agriculture: "manufacturing",
    other: "technology",
  };

  const mappedId = labelAliases[normalized];
  if (mappedId) {
    const mapped = INDUSTRY_PROFILES.find((profile) => profile.id === mappedId);
    if (mapped) return mapped;
  }

  return (
    INDUSTRY_PROFILES.find(
      (profile) =>
        normalizeIndustryInput(profile.label) === normalized ||
        profile.id === normalized ||
        profile.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
    ) ?? null
  );
}

export function buildCompanyIndustryText(input: {
  name?: string | null;
  domain?: string | null;
  industry?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
}): string {
  return [
    input.name,
    input.domain,
    input.industry,
    input.description,
    input.websiteUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function classifyIndustryFromText(text: string): string | null {
  const normalized = text.toLowerCase();
  let best: { label: string; score: number } | null = null;

  for (const profile of INDUSTRY_PROFILES) {
    if (profile.excludeKeywords.test(normalized)) continue;

    const matches = normalized.match(profile.keywords);
    if (!matches) continue;

    const score = matches.length;
    if (!best || score > best.score) {
      best = { label: profile.label, score };
    }
  }

  return best?.label ?? null;
}

export const MIN_INDUSTRY_MATCH_SCORE = 0.5;

export interface IndustryMatchResult {
  matches: boolean;
  score: number;
  detectedIndustry: string | null;
  conflictingIndustry: boolean;
}

/**
 * Check whether a company belongs to the target industry.
 */
export function companyMatchesIndustry(
  company: {
    name?: string | null;
    domain?: string | null;
    industry?: string | null;
    description?: string | null;
    websiteUrl?: string | null;
  },
  targetIndustry: string
): IndustryMatchResult {
  if (!targetIndustry.trim()) {
    return { matches: true, score: 1, detectedIndustry: null, conflictingIndustry: false };
  }

  const text = buildCompanyIndustryText(company);
  const profile = resolveIndustryProfile(targetIndustry);
  const detected = classifyIndustryFromText(text);

  if (!profile) {
    const target = normalizeIndustryInput(targetIndustry);
    const companyIndustry = normalizeIndustryInput(company.industry ?? "");
    const aliasTerms =
      INDUSTRY_SEARCH_ALIASES[targetIndustry as keyof typeof INDUSTRY_SEARCH_ALIASES] ?? [];
    const aliasHit = aliasTerms.some((term) => text.includes(term.toLowerCase()));
    const looseMatch =
      companyIndustry === target ||
      companyIndustry.includes(target) ||
      target.includes(companyIndustry) ||
      text.includes(target) ||
      aliasHit;
    return {
      matches: looseMatch,
      score: looseMatch ? 0.7 : 0,
      detectedIndustry: company.industry ?? null,
      conflictingIndustry: false,
    };
  }

  if (profile.excludeKeywords.test(text)) {
    return {
      matches: false,
      score: 0,
      detectedIndustry: detected,
      conflictingIndustry: true,
    };
  }

  const keywordHit = profile.keywords.test(text);
  const industryField = normalizeIndustryInput(company.industry ?? "");
  const targetNorm = normalizeIndustryInput(profile.label);
  const fieldMatch =
    industryField === targetNorm ||
    profile.aliases.some((alias) => industryField.includes(alias));

  if (detected && detected !== profile.label && !keywordHit && !fieldMatch) {
    if (
      profile.id === "healthcare" &&
      detected === "Technology" &&
      /\b(healthtech|health tech|digital health|medtech|telehealth|patient|clinical|medical software|healthcare software|health platform)\b/i.test(
        text
      )
    ) {
      return {
        matches: true,
        score: 0.85,
        detectedIndustry: profile.label,
        conflictingIndustry: false,
      };
    }

    return {
      matches: false,
      score: 0.1,
      detectedIndustry: detected,
      conflictingIndustry: true,
    };
  }

  let score = 0;
  if (fieldMatch) score += 0.5;
  if (keywordHit) score += 0.5;
  if (detected === profile.label) score = Math.max(score, 0.9);

  if (!keywordHit && !fieldMatch) {
    return {
      matches: false,
      score: 0,
      detectedIndustry: detected ?? company.industry ?? null,
      conflictingIndustry: Boolean(detected && detected !== profile.label),
    };
  }

  const matches = score >= MIN_INDUSTRY_MATCH_SCORE;

  return {
    matches,
    score: matches ? Math.min(1, score) : 0,
    detectedIndustry: detected ?? company.industry ?? null,
    conflictingIndustry: false,
  };
}

export function inferIndustryFromContent(
  description: string | null,
  companyName: string | null,
  _industryHint: string
): string | null {
  const classified = classifyIndustryFromText(
    buildCompanyIndustryText({ name: companyName, description })
  );
  if (classified) return classified;

  if (!description) return null;
  return description.split(".")[0]?.trim().slice(0, 80) ?? null;
}
