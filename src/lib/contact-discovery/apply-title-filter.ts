import type { DiscoveredContact } from "@/types/contact";

const TITLE_ALIASES: Record<string, string[]> = {
  ceo: ["chief executive officer"],
  cto: ["chief technology officer", "chief technical officer"],
  founder: ["co-founder", "cofounder"],
  "vp sales": ["vice president of sales", "vice president sales", "vp of sales"],
  "marketing director": [
    "director of marketing",
    "head of marketing",
    "vp marketing",
    "vice president of marketing",
  ],
};

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleVariants(title: string): string[] {
  const normalized = normalizeTitle(title);
  const variants = new Set<string>([normalized]);

  for (const [key, aliases] of Object.entries(TITLE_ALIASES)) {
    if (normalized === key || aliases.includes(normalized)) {
      variants.add(key);
      aliases.forEach((alias) => variants.add(alias));
    }
  }

  return Array.from(variants);
}

export function matchesJobTitle(
  contactTitle: string,
  targetTitles: string[]
): boolean {
  if (targetTitles.length === 0) return true;

  const contactVariants = titleVariants(contactTitle);

  return targetTitles.some((target) => {
    const targetVariants = titleVariants(target);
    return targetVariants.some((targetVariant) =>
      contactVariants.some(
        (contactVariant) =>
          contactVariant.includes(targetVariant) ||
          targetVariant.includes(contactVariant)
      )
    );
  });
}

export function applyTitleFilter(
  contacts: DiscoveredContact[],
  jobTitles: string[]
): { contacts: DiscoveredContact[]; filteredCount: number } {
  if (jobTitles.length === 0) {
    return { contacts, filteredCount: 0 };
  }

  const matched = contacts.filter((contact) =>
    matchesJobTitle(contact.title, jobTitles)
  );

  return {
    contacts: matched,
    filteredCount: contacts.length - matched.length,
  };
}
