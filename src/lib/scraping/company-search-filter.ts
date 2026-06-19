import {
  isInvestorOrAcceleratorOrganization,
  isNonCommercialDomain,
  isNonCommercialOrganization,
  isNonCommercialTitle,
} from "@/lib/scraping/org-type-blockers";
import type { WebSearchResult } from "@/lib/scraping/web-search";

/** Directories, listicles, startup trackers, and aggregators — not target companies. */
const DIRECTORY_DOMAINS = new Set([
  "techbehemoths.com",
  "clutch.co",
  "goodfirms.co",
  "goodfirms.com",
  "designrush.com",
  "sortlist.com",
  "themanifest.com",
  "crunchbase.com",
  "opencorporates.com",
  "zoominfo.com",
  "glassdoor.com",
  "indeed.com",
  "yelp.com",
  "trustpilot.com",
  "g2.com",
  "capterra.com",
  "softwaresuggest.com",
  "extract.co",
  "topdevelopers.co",
  "itfirms.co",
  "selectedfirms.co",
  "tracxn.com",
  "bouncewatch.com",
  "startupill.com",
  "startuppakistan.com.pk",
  "edtechhub.org",
  "katalystlabs.pk",
  "nicpeshawar.pk",
  "f6s.com",
  "angel.co",
  "wellfound.com",
  "pitchbook.com",
  "dealroom.co",
  "seedtable.com",
  "failory.com",
  "feedspot.com",
  "meetfrank.com",
  "business-sweden.com",
  "linkedin.com",
  "greenhouse.io",
  "workable.com",
  "smartrecruiters.com",
  "teachable.com",
  "medium.com",
  "substack.com",
  "wordpress.com",
  "blogspot.com",
  "wixsite.com",
  "tumblr.com",
  "reddit.com",
  "quora.com",
  "pinterest.com",
  "instagram.com",
  "tiktok.com",
  "dawn.com",
  "tribune.com.pk",
  "geo.tv",
  "bbc.com",
  "cnn.com",
  "forbes.com",
  "fortune.com",
  "fortune500.com",
  "businessinsider.com",
  "techcrunch.com",
  "venturebeat.com",
]);

/** Hostname patterns for platforms, incubators, and list sites. */
const BLOCKED_DOMAIN_PATTERNS = [
  /\.teachable\.com$/i,
  /\.wordpress\.com$/i,
  /\.blogspot\.com$/i,
  /\.wixsite\.com$/i,
  /\.github\.io$/i,
  /^nic[a-z0-9-]+\.pk$/i,
  /^nic[a-z0-9-]+\.gov\.pk$/i,
  /tracxn\.com$/i,
  /startupill\.com$/i,
  /startuppakistan\./i,
  /edtechhub\./i,
  /bouncewatch\./i,
  /el-mouradia\./i,
  /\.gov\./i,
  /presidency\./i,
];

const ARTICLE_URL_SEGMENTS = [
  "/blog/",
  "/blogs/",
  "/article/",
  "/articles/",
  "/news/",
  "/press/",
  "/post/",
  "/posts/",
  "/story/",
  "/stories/",
  "/list/",
  "/lists/",
  "/top-",
  "/best-",
  "/guide/",
  "/guides/",
  "/companies/",
  "/company-list",
  "/directory/",
  "/ranking/",
  "/rankings/",
  "/category/",
  "/tag/",
  "/tags/",
  "/wiki/",
  "/startups/",
  "/startup/",
  "/ecosystem/",
  "/scenario/",
  "/reports/",
  "/insights/",
  "/resources/",
  "/jobs/",
  "/job/",
  "/careers/",
  "/vacancy/",
  "/vacancies/",
  "/hiring/",
  "/apply/",
];

const ARTICLE_TITLE_PATTERNS = [
  /\btop\s+\d*/i,
  /\btop\s+startups\b/i,
  /\bbest\s+\d+/i,
  /\bbest\s+.*startups\b/i,
  /\blist\s+of\b/i,
  /\bcompanies\s+in\b/i,
  /\bcompanies\s+of\b/i,
  /\bstartups\s+in\b/i,
  /\bstartups\s+of\b/i,
  /\bstartups\s+leading\b/i,
  /\bed-?tech\s+startups\b/i,
  /\beducation\s+startups\b/i,
  /\beducation\s+technology\s+in\b/i,
  /\bsoftware\s+companies\b/i,
  /\bit\s+companies\b/i,
  /\bgrowing\s+tech\b/i,
  /\bindustry\s+report\b/i,
  /\bcurrent\s+scenario\b/i,
  /\bleading\s+the\s+way\b/i,
  /\bhow\s+to\b/i,
  /\bwhat\s+is\b/i,
  /\bguide\s+to\b/i,
  /\bultimate\s+guide\b/i,
  /\(\d{4}\)/,
  /\b\d{4}\s+edition\b/i,
  /\bnews\b/i,
  /\bblog\b/i,
  /\barticle\b/i,
  /\breview\b/i,
  /\bcomparison\b/i,
  /\bvs\.?\b/i,
  /\branked\b/i,
  /\branking\b/i,
  /\becosystem\b/i,
  /\blandscape\b/i,
  /\boverview\s+of\b/i,
];

const GENERIC_PAGE_TITLES = /^(home|about(\s+us)?|welcome|contact(\s+us)?|overview|index)$/i;

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

export function isDirectoryOrAggregatorDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain);
  if (DIRECTORY_DOMAINS.has(normalized)) return true;

  for (const blocked of DIRECTORY_DOMAINS) {
    if (normalized.endsWith(`.${blocked}`)) return true;
  }

  return BLOCKED_DOMAIN_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isArticleUrl(url: string): boolean {
  try {
    const path = new URL(url.startsWith("http") ? url : `https://${url}`).pathname.toLowerCase();
    if (path === "/" || path === "") return false;
    return ARTICLE_URL_SEGMENTS.some((segment) => path.includes(segment));
  } catch {
    return false;
  }
}

export function isArticleLikeTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (trimmed.length > 72) return true;
  if (GENERIC_PAGE_TITLES.test(trimmed)) return false;
  return ARTICLE_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isListicleSnippet(snippet: string): boolean {
  const text = snippet.toLowerCase();
  if (!text) return false;
  return (
    /\b(top|best)\s+\d+/.test(text) ||
    /\blist\s+of\b/.test(text) ||
    /\bstartups\s+in\b/.test(text) ||
    /\bdiscover\s+the\s+best\b/.test(text) ||
    /\bcompanies\s+are\s+available\b/.test(text)
  );
}

const PERSON_NAME_PATTERN = /^[A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+){1,2}$/;
const COMPANY_NAME_MARKERS =
  /\b(inc|llc|ltd|corp|corporation|company|co\.|group|holdings|insurance|bank|technologies|tech|solutions|services|partners|consulting|media|labs|systems|software|ventures|capital|global|international|gmbh|plc|pty|cloud|data|digital|network|analytics|platform|studio|works|dynamics|interactive|security|robotics|automation)\b/i;

const HISTORICAL_TITLE_PATTERNS = [
  /\(\d{4}[–-]\d{4}\)/,
  /\(\d{4}[–-]present\)/i,
  /\bdefunct\b/i,
  /\bformer\b/i,
  /\bacquired by\b/i,
  /\bmerged into\b/i,
  /^(List of|Category:|Template:)/i,
];

const GEOGRAPHY_TITLE_PATTERN =
  /^(United States|United Kingdom|Canada|Australia|Germany|France|India|China|Japan|California|New York|Texas|Florida|London|Paris|Europe|Asia|Africa|Algeria|Sweden|Norway|Denmark|Finland|Pakistan|Spain|Italy|Brazil|Mexico)\b/i;

const WELCOME_TITLE_PATTERN = /^welcome\s+to\b/i;

export function isHistoricalOrDefunctName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (looksLikePersonName(trimmed)) return true;
  if (GEOGRAPHY_TITLE_PATTERN.test(trimmed)) return true;
  if (WELCOME_TITLE_PATTERN.test(trimmed)) return true;
  return HISTORICAL_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Reject search hits that look like individual people, not organizations. */
export function looksLikePersonName(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 48) return false;
  if (COMPANY_NAME_MARKERS.test(trimmed)) return false;
  if (/\d/.test(trimmed)) return false;
  return PERSON_NAME_PATTERN.test(trimmed);
}

export function isLikelyCompanySearchResult(result: WebSearchResult): boolean {
  if (!result.domain) return false;
  if (isNonCommercialDomain(result.domain)) return false;
  if (isDirectoryOrAggregatorDomain(result.domain)) return false;
  if (isArticleUrl(result.url)) return false;
  if (isArticleLikeTitle(result.title)) return false;
  if (looksLikePersonName(result.title)) return false;
  if (isHistoricalOrDefunctName(result.title)) return false;
  if (isNonCommercialTitle(result.title)) return false;
  if (
    isNonCommercialOrganization({
      name: result.title,
      description: result.snippet,
      domain: result.domain,
    }).blocked
  ) {
    return false;
  }
  if (
    isInvestorOrAcceleratorOrganization({
      name: result.title,
      description: result.snippet,
      domain: result.domain,
    }).blocked
  ) {
    return false;
  }
  if (isListicleSnippet(result.snippet)) return false;
  if (/\.pdf($|\?)/i.test(result.url)) return false;
  if (/\/in\/[a-z0-9_-]+/i.test(result.url)) return false;
  return true;
}

function brandNameFromDomain(domain: string): string {
  const slug = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  if (!slug) return domain;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Prefer a short brand name over a long search-result headline. */
export function cleanCompanyNameFromSearchTitle(title: string, domain: string): string {
  const trimmed = title.trim();

  if (!trimmed || GENERIC_PAGE_TITLES.test(trimmed)) {
    return brandNameFromDomain(domain);
  }

  let name = trimmed;

  if (WELCOME_TITLE_PATTERN.test(name)) {
    name = name.replace(/^welcome\s+to\s+/i, "").trim();
  }

  // "Acme Corp - Official Site" / "Acme | Home"
  const parts = name.split(/\s+[-|–—]\s+/);
  if (parts.length > 1) {
    const first = parts[0].trim();
    if (first.length >= 2 && first.length <= 60 && !isArticleLikeTitle(first)) {
      name = first;
    }
  }

  name = name
    .replace(/\s*[-|–—]\s*(home|homepage|official site|official website).*$/i, "")
    .trim();

  name = name.replace(/\s*\([^)]{0,40}\)\s*$/, "").trim();

  if (!name || isArticleLikeTitle(name) || looksLikePersonName(name)) {
    return brandNameFromDomain(domain);
  }

  return name.slice(0, 120);
}

export function filterCompanySearchResults(
  results: WebSearchResult[]
): WebSearchResult[] {
  return results.filter(isLikelyCompanySearchResult);
}
