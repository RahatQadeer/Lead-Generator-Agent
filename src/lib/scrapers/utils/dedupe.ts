import { getCompanyDedupKey } from "@/lib/company-discovery/apply-dedup";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";
import { toDiscoveredCompany } from "@/lib/scrapers/utils/to-discovered-company";

export function dedupeScrapedProfiles(
  profiles: ScrapedCompanyProfile[],
  knownKeys: ReadonlySet<string> = new Set()
): {
  unique: ScrapedCompanyProfile[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  const unique: ScrapedCompanyProfile[] = [];
  let duplicateCount = 0;

  for (const profile of profiles) {
    const company = toDiscoveredCompany(profile);
    const key = getCompanyDedupKey(company);
    if (!key) {
      unique.push(profile);
      continue;
    }

    if (seen.has(key) || knownKeys.has(key)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(key);
    unique.push(profile);
  }

  return { unique, duplicateCount };
}
