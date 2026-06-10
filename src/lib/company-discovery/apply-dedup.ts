import { normalizeLocation } from "@/lib/company-discovery/map-criteria";
import { normalizeDomain } from "@/lib/search/exclusions";
import type { DiscoveredCompany } from "@/types/company";

export function getCompanyDedupKey(company: DiscoveredCompany): string | null {
  if (company.domain) {
    return normalizeDomain(company.domain);
  }

  const name = company.name.trim().toLowerCase();
  if (!name) return null;

  const country = normalizeLocation(company.country ?? "");
  return `name:${name}|country:${country}`;
}

export function applyDedup(
  companies: DiscoveredCompany[],
  knownKeys: ReadonlySet<string> = new Set()
): {
  companies: DiscoveredCompany[];
  duplicateCount: number;
  batchDuplicateCount: number;
  knownDuplicateCount: number;
} {
  const seenInBatch = new Set<string>();
  const unique: DiscoveredCompany[] = [];
  let batchDuplicateCount = 0;
  let knownDuplicateCount = 0;

  for (const company of companies) {
    const key = getCompanyDedupKey(company);

    if (!key) {
      unique.push(company);
      continue;
    }

    if (seenInBatch.has(key)) {
      batchDuplicateCount += 1;
      continue;
    }

    if (knownKeys.has(key)) {
      knownDuplicateCount += 1;
      continue;
    }

    seenInBatch.add(key);
    unique.push(company);
  }

  return {
    companies: unique,
    duplicateCount: batchDuplicateCount + knownDuplicateCount,
    batchDuplicateCount,
    knownDuplicateCount,
  };
}
