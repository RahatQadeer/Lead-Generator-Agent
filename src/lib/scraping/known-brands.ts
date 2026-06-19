import type { CompanyType } from "@/lib/scraping/company-type";

export interface KnownBrandProfile {
  industry: string;
  companyType: CompanyType;
  descriptionHint: string;
}

const KNOWN_BRANDS: Record<string, KnownBrandProfile> = {
  "alibaba.com": {
    industry: "E-commerce",
    companyType: "marketplace",
    descriptionHint: "Global online marketplace and e-commerce platform",
  },
  "aliexpress.com": {
    industry: "E-commerce",
    companyType: "marketplace",
    descriptionHint: "Online retail marketplace",
  },
  "amazon.com": {
    industry: "E-commerce",
    companyType: "marketplace",
    descriptionHint: "E-commerce and online marketplace",
  },
  "ebay.com": {
    industry: "E-commerce",
    companyType: "marketplace",
    descriptionHint: "Online marketplace",
  },
  "etsy.com": {
    industry: "E-commerce",
    companyType: "marketplace",
    descriptionHint: "E-commerce marketplace for handmade goods",
  },
  "shopify.com": {
    industry: "E-commerce",
    companyType: "saas",
    descriptionHint: "E-commerce platform for online stores",
  },
  "zalando.com": {
    industry: "E-commerce",
    companyType: "ecommerce",
    descriptionHint: "European online fashion retailer",
  },
  "hm.com": {
    industry: "E-commerce",
    companyType: "ecommerce",
    descriptionHint: "Fashion retailer with online store",
  },
  "ikea.com": {
    industry: "E-commerce",
    companyType: "ecommerce",
    descriptionHint: "Furniture retailer with e-commerce",
  },
  "aldi.com": {
    industry: "E-commerce",
    companyType: "ecommerce",
    descriptionHint: "Grocery retailer with online shopping",
  },
};

export function resolveKnownBrand(domain: string | null | undefined): KnownBrandProfile | null {
  if (!domain) return null;
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  return KNOWN_BRANDS[normalized] ?? null;
}

export function applyKnownBrandToCompany<T extends {
  domain: string | null;
  industry?: string | null;
  description?: string | null;
}>(company: T): T {
  const brand = resolveKnownBrand(company.domain);
  if (!brand) return company;

  return {
    ...company,
    industry: company.industry ?? brand.industry,
    description: [company.description, brand.descriptionHint].filter(Boolean).join(" ").trim(),
  };
}
