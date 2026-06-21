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

export interface ApplyContactDedupOptions {
  /** Re-include known DB duplicates so they can be linked to the current search. */
  relinkKnown?: boolean;
}

export function applyDedup(
  contacts: DiscoveredContact[],
  knownKeys: ReadonlySet<string> = new Set(),
  options: ApplyContactDedupOptions = {}
): {
  contacts: DiscoveredContact[];
  duplicateCount: number;
  batchDuplicateCount: number;
  knownDuplicateCount: number;
} {
  const relinkKnown = options.relinkKnown !== false;
  const seenInBatch = new Set<string>();
  const unique: DiscoveredContact[] = [];
  let batchDuplicateCount = 0;
  let knownDuplicateCount = 0;
  let droppedDuplicateCount = 0;

  for (const contact of contacts) {
    const key = getContactDedupKey(contact);

    if (!key) {
      unique.push(contact);
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
        unique.push(contact);
      } else {
        droppedDuplicateCount += 1;
      }
      continue;
    }

    seenInBatch.add(key);
    unique.push(contact);
  }

  return {
    contacts: unique,
    duplicateCount: droppedDuplicateCount,
    batchDuplicateCount,
    knownDuplicateCount,
  };
}
