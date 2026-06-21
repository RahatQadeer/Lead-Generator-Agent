/**
 * Parse user search criteria into structured business intent for discovery queries.
 * Semantic expansion — not exact keyword matching.
 */

import { isUsefulSearchName } from "@/lib/search/search-name-utils";

export type BusinessModel =
  | "saas"
  | "b2b"
  | "b2c"
  | "marketplace"
  | "ai"
  | "agency"
  | "consulting"
  | "ecommerce"
  | "fintech"
  | "healthtech"
  | "general";

export interface SearchIntent {
  searchName: string;
  industry: string;
  country: string;
  keywords: string[];
  businessModels: BusinessModel[];
  /** Expanded terms for web search (semantic, not literal). */
  semanticTerms: string[];
  /** Multiple query variants for better recall. */
  queryVariants: string[];
}

const BUSINESS_MODEL_PATTERNS: Array<{ model: BusinessModel; pattern: RegExp }> = [
  { model: "saas", pattern: /\b(saas|software as a service|subscription software|cloud software)\b/i },
  { model: "b2b", pattern: /\b(b2b|business to business|enterprise|b2b software)\b/i },
  { model: "b2c", pattern: /\b(b2c|consumer|retail app|direct to consumer)\b/i },
  { model: "marketplace", pattern: /\b(marketplace|platform|two-sided|aggregator)\b/i },
  { model: "ai", pattern: /\b(ai|artificial intelligence|machine learning|ml|llm|genai)\b/i },
  { model: "agency", pattern: /\b(agency|digital agency|creative agency|dev shop)\b/i },
  { model: "consulting", pattern: /\b(consulting|advisory|professional services)\b/i },
  { model: "ecommerce", pattern: /\b(ecommerce|e-commerce|online store|shopify)\b/i },
  { model: "fintech", pattern: /\b(fintech|payments|banking|financial technology)\b/i },
  { model: "healthtech", pattern: /\b(healthtech|health tech|medtech|digital health)\b/i },
];

const MODEL_SEARCH_PHRASES: Record<BusinessModel, string[]> = {
  saas: ["B2B SaaS software company", "cloud software platform"],
  b2b: ["B2B technology company", "enterprise software provider"],
  b2c: ["consumer technology company", "consumer app startup"],
  marketplace: ["online marketplace platform", "two-sided marketplace company"],
  ai: ["AI software company", "machine learning startup"],
  agency: ["technology agency", "software development company"],
  consulting: ["IT consulting firm", "technology consulting company"],
  ecommerce: ["e-commerce technology company", "online retail platform"],
  fintech: ["fintech company", "financial technology startup"],
  healthtech: ["health technology company", "healthtech startup"],
  general: ["technology company", "software company"],
};

const INDUSTRY_PHRASES: Record<string, string> = {
  technology: "software technology company",
  saas: "B2B SaaS company",
  healthcare: "healthcare technology company",
  "media & entertainment": "media entertainment company",
  "financial services": "fintech company",
  logistics: "logistics technology company",
  hospitality: "hospitality technology company",
  cybersecurity: "cybersecurity company",
  edtech: "education technology company",
  "e-commerce": "e-commerce company",
  consulting: "technology consulting firm",
};

function detectBusinessModels(text: string): BusinessModel[] {
  const found = BUSINESS_MODEL_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ model }) => model
  );
  return found.length > 0 ? [...new Set(found)] : ["general"];
}

function industryPhrase(industry: string): string {
  const key = industry.trim().toLowerCase();
  return INDUSTRY_PHRASES[key] ?? `${industry} company`;
}

export function parseSearchIntent(input: {
  searchName?: string;
  industry: string;
  country: string;
  keywords: string[];
  companySizeMin?: number | null;
  companySizeMax?: number | null;
}): SearchIntent {
  const searchName = (input.searchName ?? "").trim();
  const usefulName = isUsefulSearchName(searchName) ? searchName : "";
  const combined = [searchName, input.industry, input.country, ...input.keywords]
    .filter(Boolean)
    .join(" ");

  const businessModels = detectBusinessModels(combined);
  const primaryModel = businessModels[0] ?? "general";

  const semanticTerms = [
    ...input.keywords,
    ...MODEL_SEARCH_PHRASES[primaryModel].flatMap((p) => p.split(" ")),
    input.industry,
  ]
    .map((t) => t.trim().toLowerCase())
    .filter((t, i, arr) => t.length > 2 && arr.indexOf(t) === i);

  const country = input.country.trim();
  const industry = input.industry.trim();
  const smbSearch =
    input.companySizeMax !== null &&
    input.companySizeMax !== undefined &&
    input.companySizeMax <= 250;
  const healthIndustry = industry.toLowerCase().includes("health");
  const engineeringLeadSearch = /\b(cto|vp engineering|vice president engineering|engineering leader)\b/i.test(
    combined
  );

  const queryVariants: string[] = [];

  if (country) {
    if (industry.toLowerCase().includes("e-commerce") || industry.toLowerCase().includes("ecommerce")) {
      queryVariants.push(
        `e-commerce online store ${country}`,
        `online retailer ${country}`,
        `ecommerce company ${country}`
      );
    }
    if (usefulName) {
      queryVariants.push(
        `${usefulName} ${country}`,
        `${usefulName} ${industry} ${country}`.trim()
      );
    }
  } else if (usefulName) {
    queryVariants.push(usefulName);
  }

  for (const phrase of MODEL_SEARCH_PHRASES[primaryModel].slice(0, 1)) {
    if (country) {
      queryVariants.push(`${phrase} ${country}`);
    } else {
      queryVariants.push(phrase);
    }
  }

  if (industry) {
    const phrase = industryPhrase(industry);
    queryVariants.push(country ? `${phrase} ${country}` : phrase);
  }

  if (input.keywords.length > 0) {
    const kw = input.keywords.slice(0, 2).join(" ");
    queryVariants.push(country ? `${kw} company ${country}` : `${kw} company`);
  }

  if (healthIndustry && country) {
    queryVariants.push(
      smbSearch
        ? `healthcare startup ${country}`
        : `healthcare technology company ${country}`,
      `digital health company ${country}`,
      `health IT company ${country}`,
      `health information technology ${country}`,
      `medical technology company ${country}`,
      `healthcare IT services ${country}`
    );
    if (smbSearch) {
      queryVariants.push(`healthcare software SMB ${country}`, `small healthtech ${country}`);
    }
    if (engineeringLeadSearch || usefulName || smbSearch) {
      queryVariants.push(`healthtech software company ${country}`);
    }
  }

  if (smbSearch && industry && country) {
    queryVariants.push(`small ${industry.toLowerCase()} company ${country}`);
  }

  const uniqueQueries = [...new Set(queryVariants.map((q) => q.trim()).filter(Boolean))];

  return {
    searchName: usefulName,
    industry,
    country,
    keywords: input.keywords,
    businessModels,
    semanticTerms,
    queryVariants: uniqueQueries.length > 0 ? uniqueQueries : [combined || "technology company"],
  };
}
