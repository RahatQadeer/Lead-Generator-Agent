import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";

export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function normalizeDomain(urlOrDomain: string | null | undefined): string | null {
  if (!urlOrDomain?.trim()) return null;
  const domain = extractDomainFromUrl(
    urlOrDomain.includes("://") ? urlOrDomain : `https://${urlOrDomain}`
  );
  return domain?.toLowerCase() ?? null;
}

export function normalizeText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const value = normalizeText(tag)?.toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
