import type { DiscoveredContact } from "@/types/contact";

export function getContactDedupKey(contact: DiscoveredContact): string | null {
  if (contact.email) {
    return contact.email.trim().toLowerCase();
  }

  if (contact.linkedinUrl) {
    return contact.linkedinUrl.trim().toLowerCase();
  }

  const name = contact.fullName.trim().toLowerCase();
  if (!name) return null;

  return `company:${contact.companyId}|name:${name}`;
}

export function applyDedup(
  contacts: DiscoveredContact[],
  knownKeys: ReadonlySet<string> = new Set()
): {
  contacts: DiscoveredContact[];
  duplicateCount: number;
  batchDuplicateCount: number;
  knownDuplicateCount: number;
} {
  const seenInBatch = new Set<string>();
  const unique: DiscoveredContact[] = [];
  let batchDuplicateCount = 0;
  let knownDuplicateCount = 0;

  for (const contact of contacts) {
    const key = getContactDedupKey(contact);

    if (!key) {
      unique.push(contact);
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
    unique.push(contact);
  }

  return {
    contacts: unique,
    duplicateCount: batchDuplicateCount + knownDuplicateCount,
    batchDuplicateCount,
    knownDuplicateCount,
  };
}
