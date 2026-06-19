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

export interface ApplyCompanyDedupOptions {
  /**
   * Re-include known DB duplicates that appear in the current discovery batch
   * so they can be linked to this search. Never pulls companies from DB alone.
   */
  relinkKnown?: boolean;
}

export function applyDedup(
  companies: DiscoveredCompany[],
  knownKeys: ReadonlySet<string> = new Set(),
  options: ApplyCompanyDedupOptions = {}
): {
  companies: DiscoveredCompany[];
  duplicateCount: number;
  batchDuplicateCount: number;
  knownDuplicateCount: number;
} {
  const relinkKnown = options.relinkKnown !== false;
  const seenInBatch = new Set<string>();
  const unique: DiscoveredCompany[] = [];
  let batchDuplicateCount = 0;
  let knownDuplicateCount = 0;
  let droppedDuplicateCount = 0;

  for (const company of companies) {
    const key = getCompanyDedupKey(company);

    if (!key) {
      unique.push(company);
      continue;
    }

    if (seenInBatch.has(key)) {
      batchDuplicateCount += 1;
      droppedDuplicateCount += 1;
      continue;
    }

    if (knownKeys.has(key)) {
      knownDuplicateCount += 1;
      if (relinkKnown) {
        seenInBatch.add(key);
        unique.push(company);
      } else {
        droppedDuplicateCount += 1;
      }
      continue;
    }

    seenInBatch.add(key);
    unique.push(company);
  }

  return {
    companies: unique,
    duplicateCount: droppedDuplicateCount,
    batchDuplicateCount,
    knownDuplicateCount,
  };
}
