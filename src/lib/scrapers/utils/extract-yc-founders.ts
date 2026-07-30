import * as cheerio from "cheerio";
import type { ScraperFounder } from "@/lib/scrapers/types";
import { normalizeText, normalizeUrl } from "@/lib/scrapers/utils/normalize";

interface YcPageFounder {
  full_name?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  founder_bio?: string | null;
  avatar_thumb_url?: string | null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function mapYcFounder(raw: YcPageFounder): ScraperFounder | null {
  const name = normalizeText(raw.full_name);
  if (!name) return null;

  return {
    name,
    title: normalizeText(raw.title),
    linkedinUrl: normalizeUrl(raw.linkedin_url),
    twitterUrl: normalizeUrl(raw.twitter_url),
    bio: normalizeText(raw.founder_bio),
    avatarUrl: normalizeUrl(raw.avatar_thumb_url),
  };
}

/** Parse founder names from YC meta descriptions like "Founded in 2009 by A and B, Stripe has…". */
export function parseFoundersFromMetaDescription(
  description: string | null | undefined
): ScraperFounder[] {
  const text = normalizeText(description);
  if (!text) return [];

  const match = text.match(
    /Founded in [^,]+ by (.+?)(?:,\s*[A-Z][\w\s&.''-]+\s+has\b)/i
  );
  if (!match?.[1]) return [];

  const names = match[1]
    .replace(/\s+and\s+/gi, ", ")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 2);

  return names.map((name) => ({ name, title: "Founder" }));
}

/**
 * Extract founders / CEOs listed on a ycombinator.com/companies/* profile page.
 * YC embeds full founder cards in the page's `data-page` React payload; the meta
 * description is used as a fallback when that payload is missing.
 */
export function extractYcFoundersFromHtml(html: string): ScraperFounder[] {
  if (!html) return [];

  const $ = cheerio.load(html);
  const rawPage = $("[data-page]").first().attr("data-page");

  if (rawPage) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(rawPage)) as {
        props?: { company?: { founders?: YcPageFounder[] } };
      };
      const founders = parsed?.props?.company?.founders;
      if (Array.isArray(founders) && founders.length > 0) {
        return founders
          .map(mapYcFounder)
          .filter((founder): founder is ScraperFounder => founder !== null);
      }
    } catch {
      // Fall through to meta description parsing.
    }
  }

  const description = $("meta[name='description']").attr("content");
  return parseFoundersFromMetaDescription(description);
}
