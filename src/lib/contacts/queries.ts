import {
  toContactInsert,
  toContactInsertCore,
  toEmailVerificationInput,
  toEmailVerificationUpdate,
  toEnrichedLead,
  toEnrichedLeadUpdate,
  toEnrichedLeadUpdateCore,
  toLeadEnrichmentInput,
  toLeadScoreUpdate,
  toLeadScoringInput,
  type ContactWithCompany,
} from "@/lib/contacts/mapper";
import { createClient } from "@/lib/supabase/server";
import type { DiscoveredContact } from "@/types/contact";
import type { EmailVerificationInput } from "@/types/email-verification";
import type { VerifiedEmail } from "@/types/email-verification";
import type { EnrichedLead } from "@/types/lead";
import type { ScoredLeadResult } from "@/types/lead-scoring";

export async function getKnownContactDedupKeys(
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("dedup_key")
    .eq("user_id", userId);

  if (error || !data) return new Set();

  return new Set(data.map((row) => row.dedup_key));
}

export async function upsertDiscoveredContacts(
  userId: string,
  searchId: string,
  provider: string,
  contacts: DiscoveredContact[]
): Promise<{ savedCount: number; failedCount: number; errorMessage?: string }> {
  const fullRows = contacts
    .map((contact) => toContactInsert(userId, searchId, provider, contact))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const coreRows = contacts
    .map((contact) => toContactInsertCore(userId, searchId, provider, contact))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (coreRows.length === 0) {
    return {
      savedCount: 0,
      failedCount: contacts.length,
      errorMessage:
        contacts.length > 0
          ? "Contacts were missing required name fields and could not be saved."
          : undefined,
    };
  }

  const supabase = await createClient();

  let { error } = await supabase.from("contacts").upsert(fullRows, {
    onConflict: "user_id,dedup_key",
  });

  if (error) {
    console.warn(
      "Contact upsert with extended columns failed, retrying core columns:",
      error.message
    );
    ({ error } = await supabase.from("contacts").upsert(coreRows, {
      onConflict: "user_id,dedup_key",
    }));
  }

  if (error) {
    let savedCount = 0;
    const errors: string[] = [];

    for (const row of coreRows) {
      const { error: rowError } = await supabase.from("contacts").upsert(row, {
        onConflict: "user_id,dedup_key",
      });

      if (rowError) {
        errors.push(rowError.message);
        console.error("Failed to persist contact row:", rowError.message, row);
      } else {
        savedCount += 1;
      }
    }

    if (savedCount > 0) {
      return {
        savedCount,
        failedCount: contacts.length - savedCount,
        errorMessage:
          errors.length > 0 ? errors[0] : undefined,
      };
    }

    console.error("Failed to persist discovered contacts:", error.message);
    return {
      savedCount: 0,
      failedCount: contacts.length,
      errorMessage: errors[0] ?? error.message,
    };
  }

  return {
    savedCount: fullRows.length > 0 ? fullRows.length : coreRows.length,
    failedCount: contacts.length - coreRows.length,
  };
}

export async function getContactsBySearchId(
  userId: string,
  searchId: string,
  options: { includeDiscarded?: boolean } = {}
): Promise<ContactWithCompany[]> {
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select(
      "*, companies(name, city, state, country, industry, description, employee_count, technologies, domain, website_url)"
    )
    .eq("user_id", userId)
    .eq("search_id", searchId);

  if (!options.includeDiscarded) {
    query = query.is("discarded_at", null);
  }

  const { data, error } = await query.order("full_name", { ascending: true });

  if (error || !data) return [];

  return data as ContactWithCompany[];
}

export async function countDiscardedContactsBySearchId(
  userId: string,
  searchId: string
): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("search_id", searchId)
    .not("discarded_at", "is", null);

  if (error || count === null) return 0;

  return count;
}

/** Remove contacts from a search when re-running people discovery (page 1 refresh). */
export async function detachContactsFromSearch(
  userId: string,
  searchId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("user_id", userId)
    .eq("search_id", searchId);

  if (error) {
    console.error("Failed to detach contacts from search:", error.message);
  }
}

export async function saveEnrichedLeads(
  userId: string,
  provider: string,
  leads: EnrichedLead[]
): Promise<{ savedCount: number; failedCount: number }> {
  const supabase = await createClient();
  const failures: string[] = [];

  for (const lead of leads) {
    let { error } = await supabase
      .from("contacts")
      .update(toEnrichedLeadUpdate(lead, provider))
      .eq("id", lead.id)
      .eq("user_id", userId);

    // Fall back to core columns if newer migration columns are missing
    if (error) {
      ({ error } = await supabase
        .from("contacts")
        .update(toEnrichedLeadUpdateCore(lead, provider))
        .eq("id", lead.id)
        .eq("user_id", userId));
    }

    if (error) {
      failures.push(`${lead.name}: ${error.message}`);
      console.error(`Failed to enrich contact ${lead.id}:`, error.message);
    }
  }

  if (failures.length > 0) {
    console.error("Enrich save failures:", failures);
  }

  return {
    savedCount: leads.length - failures.length,
    failedCount: failures.length,
  };
}

export async function discardContacts(
  userId: string,
  contactIds: string[]
): Promise<void> {
  if (contactIds.length === 0) return;

  const supabase = await createClient();
  const discardedAt = new Date().toISOString();

  for (const contactId of contactIds) {
    const { error } = await supabase
      .from("contacts")
      .update({
        discarded_at: discardedAt,
        outreach_channel: null,
        enriched_at: null,
        email: null,
        linkedin_url: null,
        email_source: null,
        linkedin_source: null,
        updated_at: discardedAt,
      })
      .eq("id", contactId)
      .eq("user_id", userId);

    if (error) {
      console.error(`Failed to discard contact ${contactId}:`, error.message);
    }
  }
}

export async function getEnrichedLeadsByUserId(
  userId: string
): Promise<EnrichedLead[]> {
  const supabase = await createClient();

  const { data: publishedSearches, error: searchError } = await supabase
    .from("searches")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "completed"]);

  if (searchError || !publishedSearches?.length) return [];

  const searchIds = publishedSearches.map((search) => search.id);

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .in("search_id", searchIds)
    .not("enriched_at", "is", null)
    .is("discarded_at", null)
    .order("enriched_at", { ascending: false });

  if (error || !data) return [];

  return data
    .map(toEnrichedLead)
    .filter((lead): lead is EnrichedLead => lead !== null);
}

export async function deleteContactsByIds(
  userId: string,
  contactIds: string[]
): Promise<number> {
  if (contactIds.length === 0) return 0;

  const supabase = await createClient();

  const { error, count } = await supabase
    .from("contacts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .in("id", contactIds);

  if (error) {
    console.error("Failed to delete contacts:", error.message);
    throw new Error(error.message);
  }

  return count ?? contactIds.length;
}

export async function deleteAllUserLeads(userId: string): Promise<number> {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("contacts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .not("enriched_at", "is", null);

  if (error) {
    console.error("Failed to delete all leads:", error.message);
    throw new Error(error.message);
  }

  return count ?? 0;
}

export function toLeadEnrichmentInputs(
  contacts: ContactWithCompany[],
  searchIndustry?: string
): ReturnType<typeof toLeadEnrichmentInput>[] {
  return contacts.map((contact) => toLeadEnrichmentInput(contact, searchIndustry));
}

export function toEmailVerificationInputs(
  contacts: ContactWithCompany[]
): EmailVerificationInput[] {
  return contacts.map(toEmailVerificationInput);
}

export function toLeadScoringInputs(
  contacts: ContactWithCompany[]
): ReturnType<typeof toLeadScoringInput>[] {
  return contacts.map(toLeadScoringInput);
}

export async function saveLeadScores(
  userId: string,
  results: ScoredLeadResult[]
): Promise<void> {
  const supabase = await createClient();

  for (const result of results) {
    const { error } = await supabase
      .from("contacts")
      .update(toLeadScoreUpdate(result))
      .eq("id", result.contactId)
      .eq("user_id", userId);

    if (error) {
      console.error(
        `Failed to save lead score for ${result.contactId}:`,
        error.message
      );
    }
  }
}

export async function saveEmailVerificationResults(
  userId: string,
  results: VerifiedEmail[]
): Promise<void> {
  const supabase = await createClient();

  for (const result of results) {
    const { error } = await supabase
      .from("contacts")
      .update(toEmailVerificationUpdate(result))
      .eq("id", result.contactId)
      .eq("user_id", userId);

    if (error) {
      console.error(
        `Failed to save email verification for ${result.contactId}:`,
        error.message
      );
    }
  }
}
