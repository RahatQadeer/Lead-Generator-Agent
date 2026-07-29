import type * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { personNameParts } from "@/lib/scraping/data-quality";
import type { PersonSocialProfiles, SocialNetwork } from "@/types/contact";

/**
 * Person-scoped contact channels (phone, X, Facebook, Instagram).
 *
 * The hard problem here is attribution, not extraction. A team page reliably carries
 * the company's switchboard number in its footer and the company's own social accounts
 * in its header — copying those onto every person listed on the page produces data that
 * looks full and is wrong. So every channel below needs evidence tying it to the
 * individual, mirroring the identity gate LinkedIn URLs already go through:
 *
 * - phone: exactly one `tel:` link inside the person's own card. Free text is never
 *   scanned — a phone regex over page text matches dates, prices, and zip codes.
 * - socials: the handle has to look like the person's name. A company account
 *   (`@acmecorp`) can never match a person's name, so this rejects it for free.
 */

const SOCIAL_URL_PATTERNS: Record<SocialNetwork, RegExp> = {
  twitter: /^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(@?[^/?#]+)/i,
  facebook: /^(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\/(@?[^/?#]+)/i,
  instagram: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/(@?[^/?#]+)/i,
};

const SOCIAL_LINK_SELECTORS: Record<SocialNetwork, string> = {
  twitter: "a[href*='twitter.com'], a[href*='x.com']",
  facebook: "a[href*='facebook.com'], a[href*='fb.com']",
  instagram: "a[href*='instagram.com']",
};

/** Platform routes and app pages that are never a person's profile. */
const RESERVED_SOCIAL_HANDLES = new Set([
  "share",
  "sharer",
  "intent",
  "home",
  "login",
  "signup",
  "search",
  "explore",
  "hashtag",
  "pages",
  "groups",
  "events",
  "profile.php",
  "people",
  "help",
  "about",
  "privacy",
  "terms",
  "tos",
  "settings",
  "i",
  "p",
  "reel",
  "reels",
  "stories",
  "watch",
  "video",
  "photo",
  "permalink.php",
  "dialog",
  "plugins",
  "tr",
]);

/**
 * A person card, not a page section. Blocks larger than this tend to be whole
 * "our team" containers, where a single `tel:` cannot be pinned to one individual.
 */
const MAX_PERSON_BLOCK_CHARS = 1000;

/** E.164 allows at most 15 digits; anything shorter than 7 is not dialable. */
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

/** Below this length, a name token appears inside unrelated handles by chance. */
const MIN_SUBSTRING_TOKEN_CHARS = 3;

/** Normalize a `tel:` value to `+<digits>` / `<digits>`; null when not a real number. */
export function sanitizePersonPhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  const cleaned = raw
    .replace(/^tel:/i, "")
    .split(/[?#]/)[0]
    .replace(/^\s*(?:phone|tel|mobile|call)\s*[:.]?\s*/i, "")
    .trim();

  const hasPlus = cleaned.startsWith("+") || cleaned.startsWith("00");
  const digits = cleaned.replace(/\D/g, "");

  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) return null;
  // 000000000 / 1111111111 — placeholder rows and tracking pixels, not numbers.
  if (/^(\d)\1+$/.test(digits)) return null;

  return hasPlus ? `+${digits.replace(/^00/, "")}` : digits;
}

export function socialHandleFromUrl(
  url: string | null | undefined,
  network: SocialNetwork
): string | null {
  if (!url?.trim()) return null;

  const match = url.trim().match(SOCIAL_URL_PATTERNS[network]);
  const handle = match?.[1]?.replace(/^@/, "").trim().toLowerCase();
  if (!handle || handle.length < 2) return null;
  if (RESERVED_SOCIAL_HANDLES.has(handle)) return null;

  return handle;
}

/**
 * True when a social handle looks like it belongs to this person.
 * Accepts `johnsmith`, `john_smith`, `jsmith`, `john.smith.7`; rejects `acmecorp`.
 */
export function personHandleMatchesName(handle: string, fullName: string): boolean {
  const normalized = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.length < 3) return false;

  const { first, last } = personNameParts(fullName);
  if (!first) return false;

  // Single-token names are too weak to attribute a public handle to.
  if (!last) return false;

  const variants = new Set(
    [
      `${first}${last}`,
      `${last}${first}`,
      `${first[0]}${last}`,
      `${first}${last[0]}`,
    ].filter((variant) => variant.length >= 3)
  );

  // Trailing digits are a disambiguator, not part of the name (john.smith.7).
  const withoutTrailingDigits = normalized.replace(/\d+$/, "");
  if (variants.has(normalized) || variants.has(withoutTrailingDigits)) return true;

  // Substring matching only holds up for long tokens. With short ones it fires on
  // coincidence — "charlotte" contains both halves of "Lo Te" — so short names get
  // the exact-variant check above and nothing looser.
  if (first.length < MIN_SUBSTRING_TOKEN_CHARS || last.length < MIN_SUBSTRING_TOKEN_CHARS) {
    return false;
  }

  return normalized.includes(first) && normalized.includes(last);
}

/** Keep a social URL only when its handle matches the person's name. */
export function sanitizePersonSocialUrl(
  url: string | null | undefined,
  network: SocialNetwork,
  fullName: string
): string | null {
  const handle = socialHandleFromUrl(url, network);
  if (!handle) return null;
  if (!personHandleMatchesName(handle, fullName)) return null;

  const host =
    network === "twitter" ? "x.com" : network === "facebook" ? "facebook.com" : "instagram.com";

  return `https://${host}/${handle}`;
}

export function emptySocialProfiles(): PersonSocialProfiles {
  return { twitter: null, facebook: null, instagram: null };
}

export function hasAnySocialProfile(profiles: PersonSocialProfiles | null | undefined): boolean {
  if (!profiles) return false;
  return Boolean(profiles.twitter || profiles.facebook || profiles.instagram);
}

/** Prefer an existing profile, else take the incoming one. */
export function mergeSocialProfiles(
  base: PersonSocialProfiles | null | undefined,
  incoming: PersonSocialProfiles | null | undefined
): PersonSocialProfiles {
  return {
    twitter: base?.twitter ?? incoming?.twitter ?? null,
    facebook: base?.facebook ?? incoming?.facebook ?? null,
    instagram: base?.instagram ?? incoming?.instagram ?? null,
  };
}

export interface PersonContactChannels {
  phone: string | null;
  socialProfiles: PersonSocialProfiles;
}

/**
 * Pull phone + socials out of one person's block on a page.
 * Anything that cannot be tied to `fullName` is dropped rather than guessed.
 */
export function extractPersonContactChannels(
  block: cheerio.Cheerio<AnyNode>,
  fullName: string
): PersonContactChannels {
  const socialProfiles = emptySocialProfiles();

  for (const network of Object.keys(SOCIAL_LINK_SELECTORS) as SocialNetwork[]) {
    const hrefs = block
      .find(SOCIAL_LINK_SELECTORS[network])
      .map((_, element) => (element as { attribs?: Record<string, string> }).attribs?.href ?? "")
      .get();

    for (const href of hrefs) {
      const sanitized = sanitizePersonSocialUrl(href, network, fullName);
      if (sanitized) {
        socialProfiles[network] = sanitized;
        break;
      }
    }
  }

  return { phone: extractPersonPhone(block), socialProfiles };
}

function extractPersonPhone(block: cheerio.Cheerio<AnyNode>): string | null {
  if (block.text().length > MAX_PERSON_BLOCK_CHARS) return null;

  const telLinks = block
    .find("a[href^='tel:']")
    .map((_, element) => (element as { attribs?: Record<string, string> }).attribs?.href ?? "")
    .get()
    .map((href) => sanitizePersonPhone(href))
    .filter((phone): phone is string => Boolean(phone));

  // Two numbers in one block means the block covers more than one person (or mixes in
  // a company line). There is no way to tell whose is whose, so take neither.
  const distinct = [...new Set(telLinks)];
  return distinct.length === 1 ? distinct[0] : null;
}
