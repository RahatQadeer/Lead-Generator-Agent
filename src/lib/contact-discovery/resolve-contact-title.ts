import type { DiscoveredContact } from "@/types/contact";
import { isLeadershipDirectoryUrl } from "@/lib/scraping/parse-html";

const UNKNOWN_TITLES = new Set([
  "team member",
  "staff member",
  "employee",
  "member",
  "unknown",
  "n/a",
  "",
]);

function normalizeTitle(value: string): string {
  return (value.toLowerCase().replace(/\s+/g, " ").trim());
}

function isUnknownTitle(title: string | null | undefined): boolean {
  return UNKNOWN_TITLES.has(normalizeTitle(title ?? ""));
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["of", "and", "the", "at", "for"].includes(lower)) return lower;
      if (/^(vp|svp|evp|ceo|cto|cfo|coo|cmo|cpo|chro|it|hr)$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\bVp\b/g, "VP")
    .replace(/\bSvp\b/g, "SVP")
    .replace(/\bEvp\b/g, "EVP");
}

const TITLE_FROM_TEXT_PATTERNS: Array<{ pattern: RegExp; pick: (match: RegExpMatchArray) => string }> = [
  {
    pattern:
      /\b((?:senior |executive )?vice president(?:,|\s+of|\s+—|\s+-|\s+–)\s*(?:engineering|technology|tech|software|it|digital|platform|data|product|operations|sales|marketing|finance|commercial|customer success|human resources|hr)[^|.\n]{0,24})/i,
    pick: (match) => titleCase(match[1].replace(/[,.|–-]\s*$/, "").trim()),
  },
  {
    pattern:
      /\b((?:senior |executive )?vice president[^|.\n]{0,48})/i,
    pick: (match) => titleCase(match[1].replace(/[,.|–-]\s*$/, "").trim()),
  },
  {
    pattern: /\b(vp\s+(?:of\s+)?(?:engineering|technology|tech|software|it|digital|platform|product|sales|marketing|operations|finance|hr|human resources)[^|.\n]{0,24})/i,
    pick: (match) => titleCase(match[1].replace(/[,.|–-]\s*$/, "").trim()),
  },
  {
    pattern: /\b(chief\s+(?:general\s+|privacy\s+|commercial\s+|technology\s+|technical\s+|information\s+|[\w]+\s+){0,3}officer)\b/i,
    pick: (match) => titleCase(match[1].trim()),
  },
  {
    pattern: /\b(managing director|executive director|general manager|engineering director|technology director|director of (?:engineering|technology|software|it|digital|platform|product|sales|marketing|operations|finance))\b/i,
    pick: (match) => titleCase(match[1].trim()),
  },
  {
    pattern: /\b(head of (?:engineering|technology|tech|software|it|digital|platform|product|growth|sales|marketing|operations|finance|people|hr|human resources)[^|.\n]{0,24})/i,
    pick: (match) => titleCase(match[1].replace(/[,.|–-]\s*$/, "").trim()),
  },
  {
    pattern: /\b(co[- ]?founder|cofounder|founder|president|chairman|chairperson|chairwoman|owner|partner)\b/i,
    pick: (match) => titleCase(match[1].trim()),
  },
  {
    pattern: /\b(ceo|cto|cfo|coo|cmo|cpo|chro)\b/i,
    pick: (match) => match[1].toUpperCase(),
  },
];

/** Pull an executive title out of scraped page context when the parser only captured a name. */
export function inferExecutiveTitleFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;

  const cleaned = text
    .replace(/\bview bio\b/gi, " ")
    .replace(/\bread more\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  for (const { pattern, pick } of TITLE_FROM_TEXT_PATTERNS) {
    const match = cleaned.match(pattern);
    if (!match) continue;
    const title = pick(match).trim();
    if (title.length >= 3 && title.length <= 80 && !isUnknownTitle(title)) {
      return title;
    }
  }

  return null;
}

function buildTitleHaystack(contact: DiscoveredContact): string {
  return [contact.title, contact.titleContext, contact.fullName, contact.sourceUrl]
    .filter(Boolean)
    .join(" ");
}

/** Upgrade Team Member / missing titles using affiliation text scraped with the person. */
export function enrichContactTitle(contact: DiscoveredContact): DiscoveredContact {
  if (contact.title?.trim() && !isUnknownTitle(contact.title)) {
    return contact;
  }

  const inferred = inferExecutiveTitleFromText(buildTitleHaystack(contact));
  if (!inferred) return contact;

  return {
    ...contact,
    title: inferred,
    department: contact.department,
  };
}

export function enrichContactTitles(contacts: DiscoveredContact[]): DiscoveredContact[] {
  return contacts.map(enrichContactTitle);
}

export function isLeadershipSourceContact(contact: DiscoveredContact): boolean {
  if (!contact.sourceUrl) return false;
  return isLeadershipDirectoryUrl(contact.sourceUrl);
}
