import type { CompanySource } from "@/lib/company-discovery/company-verification";
import type {
  DirectoryProfilePayload,
  ScrapedCompanyProfile,
  ScraperSourceId,
} from "@/lib/scrapers/types";
import { normalizeDomain } from "@/lib/scrapers/utils/normalize";
import type { DiscoveredCompany } from "@/types/company";

const SOURCE_LABELS: Record<ScraperSourceId, string> = {
  ycombinator: "Y Combinator",
  techstars: "Techstars",
  "500global": "500 Global",
  antler: "Antler",
  f6s: "F6S",
  openvc: "OpenVC",
  seedtable: "Seedtable",
  "sequoia-portfolio": "Sequoia Capital Portfolio",
  "a16z-portfolio": "Andreessen Horowitz Portfolio",
  "accel-portfolio": "Accel Portfolio",
  "lightspeed-portfolio": "Lightspeed Portfolio",
  "general-catalyst-portfolio": "General Catalyst Portfolio",
  "bessemer-portfolio": "Bessemer Venture Partners Portfolio",
  "index-ventures-portfolio": "Index Ventures Portfolio",
  producthunt: "Product Hunt",
  betalist: "BetaList",
  indiehackers: "Indie Hackers",
  startupranking: "Startup Ranking",
  saashub: "SaaSHub",
  "github-organizations": "GitHub Organizations",
};

export function buildDirectoryProfile(
  profile: ScrapedCompanyProfile
): DirectoryProfilePayload {
  const sources: CompanySource[] = [
    {
      kind: "public_registry",
      label: SOURCE_LABELS[profile.source],
      url: profile.sourceUrl,
    },
  ];

  if (profile.websiteUrl) {
    sources.push({
      kind: "official_website",
      label: "Official website",
      url: profile.websiteUrl,
    });
  }

  return {
    source: profile.source,
    sourceUrl: profile.sourceUrl,
    category: profile.category,
    tags: profile.tags,
    founders: profile.founders,
    publicEmail: profile.publicEmail,
    publicPhone: profile.publicPhone,
    contactPageUrl: profile.contactPageUrl,
    careersPageUrl: profile.careersPageUrl,
    socialLinks: profile.socialLinks,
    fundingStage: profile.fundingStage,
    investors: profile.investors ?? [],
    teamSize: profile.teamSize,
    launchDate: profile.launchDate,
    websiteExtras: profile.websiteExtras,
    sources,
  };
}

export function toDiscoveredCompany(profile: ScrapedCompanyProfile): DiscoveredCompany {
  const domain = normalizeDomain(profile.domain ?? profile.websiteUrl);
  const directoryProfile = buildDirectoryProfile(profile);

  let confidenceScore = 50;
  if (domain) confidenceScore += 15;
  if (profile.description && profile.description.length > 40) confidenceScore += 15;
  if (profile.industry || profile.category) confidenceScore += 10;
  if (profile.socialLinks.linkedin) confidenceScore += 10;
  if (profile.teamSize) confidenceScore += 5;
  if (profile.publicEmail) confidenceScore += 5;

  return {
    id: `${profile.source}:${profile.sourceCompanyId}`,
    name: profile.name,
    domain,
    industry: profile.industry ?? profile.category,
    description: profile.description,
    employeeCount: profile.teamSize,
    country: profile.country,
    city: profile.city,
    state: profile.state,
    linkedinUrl: profile.socialLinks.linkedin ?? null,
    websiteUrl: profile.websiteUrl,
    technologies: profile.websiteExtras.technologies ?? profile.tags,
    confidenceScore: Math.min(100, confidenceScore),
    fundingStage: profile.fundingStage,
    sources: directoryProfile.sources,
    validationStatus: domain ? "needs_verification" : "needs_verification",
  };
}

export function providerNameForSource(source: ScraperSourceId): string {
  return `directory:${source}`;
}
