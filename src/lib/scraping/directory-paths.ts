import * as cheerio from "cheerio";
import { createLogger } from "@/lib/logger";
import { FAST_FETCH, fetchPage } from "@/lib/scraping/http-client";
import { normalizeWebsiteUrl } from "@/lib/scraping/extract-domain";
import {
  directoryPathsCacheKey,
  getScrapeCache,
  setScrapeCache,
} from "@/lib/scraping/scrape-cache";

const log = createLogger("scraping.directory-paths");

/** Leadership paths — scraped first for people discovery. */
export const DIRECTORY_LEADERSHIP_PATHS = [
  "/about",
  "/about-us",
  "/about/team",
  "/about/leadership",
  "/about/management",
  "/about/our-team",
  "/about/our-leadership",
  "/team",
  "/our-team",
  "/leadership",
  "/management",
  "/staff",
  "/department/key-management",
  "/key-management",
  "/people",
  "/our-people",
  "/board",
  "/board-of-directors",
  "/board-of-management",
  "/directors",
  "/executives",
  "/executive-team",
  "/senior-management",
  "/senior-leadership",
  "/governance",
  "/who-we-are",
  "/about-us/our-story",
  "/company/about",
  "/company/about-us",
  "/who-we-are/team",
  "/who-we-are/leadership",
  "/our-company",
  "/our-company/leadership",
  "/company/team",
  "/company/leadership",
  "/company/management",
  "/about-us/team",
  "/about-us/leadership",
  "/about-us/management",
  "/investors/leadership",
  "/investors/management",
  "/om-oss",
  "/om-oss/team",
  "/ledning",
  "/vara-team",
  "/medarbetare",
  "/organisation",
] as const;

/** Contact pages — deprioritized; used for public emails in step 3. */
export const DIRECTORY_CONTACT_PATHS = ["/contact", "/contact-us"] as const;

/** @deprecated Use DIRECTORY_LEADERSHIP_PATHS + DIRECTORY_CONTACT_PATHS */
export const DIRECTORY_CONTACT_PATHS_LEGACY = [
  ...DIRECTORY_LEADERSHIP_PATHS,
  ...DIRECTORY_CONTACT_PATHS,
] as const;

const DIRECTORY_LINK_PATTERN =
  /(team|people|staff|leadership|management|key-management|board|director|executive|governance|our-people|senior|about-us|about|who-we-are|awards|news|press|speakers|events|blog|announcements)/i;

const MAX_DISCOVERED_PATHS = 22;

function normalizePath(href: string, origin: string): string | null {
  try {
    const base = new URL(origin);
    const resolved = new URL(href, base);
    if (resolved.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) {
      return null;
    }
    const path = resolved.pathname.replace(/\/$/, "") || "/";
    if (path === "/" || path.length > 120) return null;
    if (/\.(pdf|zip|png|jpg|jpeg|gif|svg|css|js)$/i.test(path)) return null;
    return path;
  } catch {
    return null;
  }
}

async function discoverPathsFromHomepage(origin: string): Promise<string[]> {
  const page = await fetchPage(origin, FAST_FETCH);
  if (!page?.html) return [];

  const $ = cheerio.load(page.html);
  const paths = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;

    const path = normalizePath(href, origin);
    if (!path) return;

    const linkText = $(element).text().trim().toLowerCase();
    const combined = `${path} ${linkText}`;
    if (DIRECTORY_LINK_PATTERN.test(combined)) {
      paths.add(path);
    }
  });

  return Array.from(paths);
}

async function discoverPathsFromSitemap(origin: string): Promise<string[]> {
  const sitemapUrl = `${origin}/sitemap.xml`;
  const page = await fetchPage(sitemapUrl, { ...FAST_FETCH, respectRobots: false });
  if (!page?.html || !page.html.includes("<url")) return [];

  const paths: string[] = [];
  const locMatches = page.html.matchAll(/<loc>([^<]+)<\/loc>/gi);

  for (const match of locMatches) {
    const loc = match[1]?.trim();
    if (!loc) continue;
    const path = normalizePath(loc, origin);
    if (!path || path === "/") continue;
    if (DIRECTORY_LINK_PATTERN.test(path)) {
      paths.push(path);
    }
    if (paths.length >= MAX_DISCOVERED_PATHS) break;
  }

  return paths;
}

async function buildDirectoryPathList(domain: string): Promise<string[]> {
  const origin = normalizeWebsiteUrl(domain);
  const leadershipUrls = DIRECTORY_LEADERSHIP_PATHS.map((path) => `${origin}${path}`);
  const contactUrls = DIRECTORY_CONTACT_PATHS.map((path) => `${origin}${path}`);

  const [fromHomepage, fromSitemap] = await Promise.all([
    discoverPathsFromHomepage(origin).catch(() => [] as string[]),
    discoverPathsFromSitemap(origin).catch(() => [] as string[]),
  ]);

  const dynamicUrls = [...fromHomepage, ...fromSitemap].map((path) => `${origin}${path}`);

  const seen = new Set<string>();
  const ordered: string[] = [];

  const append = (url: string) => {
    const key = url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(url);
  };

  append(origin);
  for (const url of dynamicUrls) append(url);
  for (const url of leadershipUrls) append(url);
  for (const url of contactUrls) append(url);

  if (ordered.length > MAX_DISCOVERED_PATHS + DIRECTORY_LEADERSHIP_PATHS.length) {
    return ordered.slice(0, MAX_DISCOVERED_PATHS + DIRECTORY_LEADERSHIP_PATHS.length);
  }

  log.info("Directory paths discovered", {
    domain,
    total: ordered.length,
    homepage: fromHomepage.length,
    sitemap: fromSitemap.length,
  });

  return ordered;
}

/** Build prioritized list of directory URLs to scrape for people data. */
export async function discoverDirectoryPaths(domain: string): Promise<string[]> {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const cacheKey = directoryPathsCacheKey(normalized);
  const cached = await getScrapeCache<string[]>(cacheKey);
  if (cached?.length) {
    return cached;
  }

  const ordered = await buildDirectoryPathList(normalized);
  if (ordered.length > 0) {
    await setScrapeCache(cacheKey, "page", ordered);
  }
  return ordered;
}
