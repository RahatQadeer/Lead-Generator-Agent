import { getContactDedupKey } from "@/lib/contact-discovery/apply-dedup";
import type { Database } from "@/types/database";
import type { DiscoveredContact } from "@/types/contact";

type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];

export function toContactInsert(
  userId: string,
  searchId: string,
  provider: string,
  contact: DiscoveredContact
): ContactInsert | null {
  const dedupKey = getContactDedupKey(contact);
  if (!dedupKey) return null;

  return {
    user_id: userId,
    company_id: contact.companyId,
    search_id: searchId,
    dedup_key: dedupKey,
    provider,
    provider_contact_id: contact.id,
    first_name: contact.firstName,
    last_name: contact.lastName,
    full_name: contact.fullName,
    title: contact.title,
    email: contact.email,
    linkedin_url: contact.linkedinUrl,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
