import * as cheerio from "cheerio";
import type { ScraperFounder } from "@/lib/scrapers/types";
import { normalizeText, normalizeUrl } from "@/lib/scrapers/utils/normalize";

/**
 * Leadership / founder roles we collect (per the product spec: founders + the
 * C-suite + top exec roles). Kept deliberately narrow to avoid pulling in
 * every "Head of X" or IC on a large team page.
 */
const LEADERSHIP_TITLE_RE =
  /\b(co[-\s]?founders?|founders?|chief\s+[a-z]+\s+officer|c[eotmfp]o|owner|president|managing\s+director|managing\s+partner|general\s+partner)\b/i;

/** A plausible human name: 2–3 capitalized words (allows accents, hyphens, apostrophes). */
const NAME_RE =
  /\b([A-ZÀ-Þ][a-zà-ÿ'’.-]+(?:\s+[A-ZÀ-Þ][a-zà-ÿ'’.-]+){1,2})\b/;

const MAX_PEOPLE = 12;

/** Tokens that signal a job title, not a personal name (used to reject "Chief Executive Officer" etc.). */
const ROLE_WORD_RE =
  /^(chief|officer|president|vice|director|board|founders?|co-?founders?|managing|partner|general|head|executive|technology|marketing|operating|financial|people|legal|business|communications|product|revenue|security|information|data|owner|ceo|cto|cmo|coo|cfo|cpo|cro|ciso)$/i;

function isLikelyName(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 4 || trimmed.length > 60) return false;
  // Must look like First Last, not a sentence or a single token.
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every((word) => /^[A-ZÀ-Þ]/.test(word))) return false;
  // Reject role phrases masquerading as names ("Chief Executive Officer",
  // "Managing Director", "Board Director", "Vice President").
  if (LEADERSHIP_TITLE_RE.test(trimmed)) return false;
  if (words.every((word) => ROLE_WORD_RE.test(word))) return false;
  return true;
}

/** Trim role words fused onto a name ("Alain Meier Chief" → "Alain Meier"). */
function cleanCandidateName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const words = raw.trim().split(/\s+/);
  while (words.length > 2 && ROLE_WORD_RE.test(words[words.length - 1])) words.pop();
  while (words.length > 2 && ROLE_WORD_RE.test(words[0])) words.shift();
  return words.join(" ") || null;
}

/** Drop a leading copy of the person's name from a title ("Jane DoeCEO" → "CEO"). */
function stripNameFromTitle(title: string | null, name: string): string | null {
  if (!title) return null;
  const lowerTitle = title.toLowerCase();
  const lowerName = name.toLowerCase();
  let cleaned = title;
  if (lowerTitle.startsWith(lowerName)) {
    cleaned = title.slice(name.length);
  }
  cleaned = cleaned.replace(/^[\s,·&/|–—-]+/, "").trim();
  return cleaned || null;
}

function normalizeTitle(raw: string | null | undefined): string | null {
  const text = normalizeText(raw);
  if (!text) return null;
  const match = text.match(LEADERSHIP_TITLE_RE);
  if (!match) return null;
  // Prefer the surrounding short title phrase over the whole blob.
  const clipped = text.length <= 60 ? text : match[0];
  return clipped
    .replace(/\s+/g, " ")
    .replace(/^[\s,–—-]+|[\s,–—-]+$/g, "")
    .trim();
}

/** Turn a LinkedIn /in/ slug into a display name, e.g. "jane-doe-1a2b" → "Jane Doe". */
function nameFromLinkedinSlug(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!match) return null;
  const slug = decodeURIComponent(match[1])
    .replace(/-[0-9a-f]{4,}$/i, "") // drop trailing id hash
    .replace(/[-_]+/g, " ")
    .replace(/\d+/g, " ")
    .trim();
  const titled = slug
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return isLikelyName(titled) ? titled : null;
}

function addPerson(
  out: Map<string, ScraperFounder>,
  person: ScraperFounder
): void {
  const key = person.name.toLowerCase();
  const existing = out.get(key);
  if (!existing) {
    out.set(key, person);
    return;
  }
  // Merge: fill in missing title / linkedin from either source.
  out.set(key, {
    name: existing.name,
    title: existing.title ?? person.title ?? null,
    linkedinUrl: existing.linkedinUrl ?? person.linkedinUrl ?? null,
  });
}

/** Pull people out of JSON-LD (schema.org Person / Organization.founder / employee). */
function fromJsonLd($: cheerio.CheerioAPI, out: Map<string, ScraperFounder>): void {
  $("script[type='application/ld+json']").each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const visit = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      const record = node as Record<string, unknown>;
      const type = record["@type"];
      const isPerson =
        type === "Person" || (Array.isArray(type) && type.includes("Person"));
      if (isPerson && typeof record.name === "string" && isLikelyName(record.name)) {
        const jobTitle =
          typeof record.jobTitle === "string" ? record.jobTitle : null;
        const sameAs = record.sameAs;
        const linkedin = (Array.isArray(sameAs) ? sameAs : [sameAs])
          .filter((v): v is string => typeof v === "string")
          .find((v) => /linkedin\.com\/in\//i.test(v));
        addPerson(out, {
          name: normalizeText(record.name) ?? record.name,
          title: normalizeTitle(jobTitle) ?? (jobTitle ? normalizeText(jobTitle) : null),
          linkedinUrl: linkedin ? normalizeUrl(linkedin) : null,
        });
      }
      // Recurse into founder/employee/member and any nested objects.
      for (const value of Object.values(record)) visit(value);
    };

    visit(parsed);
  });
}

/**
 * Anchor-first strategy: each `linkedin.com/in/` link on a team page usually sits
 * beside the person's name and role. Extract name (from nearby heading or the
 * slug) + title (from the surrounding container).
 */
function fromLinkedinAnchors(
  $: cheerio.CheerioAPI,
  out: Map<string, ScraperFounder>
): void {
  $("a[href*='linkedin.com/in/']").each((_, el) => {
    const anchor = $(el);
    const href = normalizeUrl(anchor.attr("href"));
    if (!href) return;

    const container = anchor.closest("li, article, div, section, td").first();
    const containerText = normalizeText(container.text()) ?? "";

    const headingName = cleanCandidateName(
      normalizeText(container.find("h1,h2,h3,h4,h5,strong,b").first().text())
    );
    const anchorName = cleanCandidateName(normalizeText(anchor.text()));
    const slugName = nameFromLinkedinSlug(href);

    const name =
      [headingName, anchorName, slugName].find((candidate) => isLikelyName(candidate)) ??
      slugName;
    if (!isLikelyName(name)) return;

    addPerson(out, {
      name,
      title: stripNameFromTitle(normalizeTitle(containerText), name),
      linkedinUrl: href,
    });
  });
}

/**
 * Text heuristic for team pages without LinkedIn links: match "Name — Title" /
 * "Name, CEO" style lines that mention a leadership role.
 */
function fromTextPairs(
  $: cheerio.CheerioAPI,
  out: Map<string, ScraperFounder>
): void {
  $("li, p, h2, h3, h4, figcaption, .team-member, [class*='team'], [class*='founder']").each(
    (_, el) => {
      const text = normalizeText($(el).text());
      if (!text || text.length > 120) return;
      if (!LEADERSHIP_TITLE_RE.test(text)) return;

      const nameMatch = text.match(NAME_RE);
      const name = cleanCandidateName(nameMatch?.[1]);
      if (!isLikelyName(name)) return;

      addPerson(out, {
        name,
        title: stripNameFromTitle(normalizeTitle(text), name),
        linkedinUrl: null,
      });
    }
  );
}

/**
 * Extract publicly listed leadership (founders + C-suite) from a company page's
 * HTML. Only reads what the page publishes — never fabricates emails or contact
 * details. Returns at most {@link MAX_PEOPLE}, de-duplicated by name.
 */
export function extractLeadership(html: string): ScraperFounder[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const out = new Map<string, ScraperFounder>();

  fromJsonLd($, out);
  fromLinkedinAnchors($, out);
  fromTextPairs($, out);

  // Prefer entries that carry a leadership title, then those with a LinkedIn URL.
  return [...out.values()]
    .sort((a, b) => {
      const score = (p: ScraperFounder) => (p.title ? 2 : 0) + (p.linkedinUrl ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, MAX_PEOPLE);
}

/** Find the most likely "about"/"team"/"leadership" page URL from a page's links. */
export function findLeadershipPageUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const patterns = [
    /\/(about|team|leadership|our-team|company|people|founders?)(\/|$|[?#])/i,
  ];
  for (const el of $("a[href]").toArray()) {
    const href = $(el).attr("href");
    if (!href) continue;
    let resolved: string;
    try {
      resolved = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (patterns.some((pattern) => pattern.test(resolved))) {
      return resolved;
    }
  }
  return null;
}
