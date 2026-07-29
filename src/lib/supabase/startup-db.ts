import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";
import {
  toStartupCatalogRecord,
  type StartupCatalogRecord,
} from "@/lib/scrapers/utils/to-startup-company";
import type { StartupDatabase } from "@/types/startup-db";

const log = createLogger("startup-db");

/** Rows per upsert request. Supabase rejects very large payloads outright. */
const UPSERT_CHUNK_SIZE = 500;

/**
 * Service-role client scoped to the startup catalog tables (startup_companies,
 * startup_people). Ingestion writes and provider reads both go through this;
 * the service role bypasses RLS. Typed via {@link StartupDatabase} so the two
 * new tables are query-safe without regenerating the full database.ts.
 */
export function createStartupDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for the startup database."
    );
  }

  return createClient<StartupDatabase>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface PersistStartupProfilesResult {
  companiesUpserted: number;
  peopleUpserted: number;
  /** Profiles with no domain and no usable name — impossible to dedupe. */
  skipped: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Upsert scraped profiles into the global startup catalog.
 *
 * Global, not user-scoped: the catalog is shared reference data, so this runs
 * for every scraper job regardless of which user triggered it or whether the
 * job was attached to a search.
 *
 * Conflict handling relies on the two unique constraints from migration 033:
 * `startup_companies.dedup_key` and `startup_people (startup_id, dedup_key)`.
 * A re-scrape therefore refreshes an existing company in place rather than
 * duplicating it — `first_seen_at` is never sent, so the original discovery
 * date survives while `last_seen_at` advances.
 *
 * Failures are logged and swallowed. Catalog ingestion is a side effect of a
 * scraper run; it must never fail the user-facing job that produced the leads.
 */
export async function persistStartupProfiles(
  profiles: ScrapedCompanyProfile[]
): Promise<PersistStartupProfilesResult> {
  const result: PersistStartupProfilesResult = {
    companiesUpserted: 0,
    peopleUpserted: 0,
    skipped: 0,
  };
  if (profiles.length === 0) return result;

  const records: StartupCatalogRecord[] = [];
  for (const profile of profiles) {
    const record = toStartupCatalogRecord(profile);
    if (record) records.push(record);
    else result.skipped += 1;
  }
  if (records.length === 0) return result;

  // Two profiles in one run can collapse to the same company (e.g. the same
  // startup listed by two VC portfolios). Postgres rejects an ON CONFLICT
  // upsert whose payload contains the conflict key twice, so collapse first —
  // last writer wins, and the people lists are merged rather than dropped.
  const byKey = new Map<string, StartupCatalogRecord>();
  for (const record of records) {
    const existing = byKey.get(record.dedupKey);
    if (!existing) {
      byKey.set(record.dedupKey, record);
      continue;
    }
    const merged = new Map(existing.people.map((p) => [p.dedup_key, p]));
    for (const person of record.people) {
      if (!merged.has(person.dedup_key)) merged.set(person.dedup_key, person);
    }
    byKey.set(record.dedupKey, { ...record, people: [...merged.values()] });
  }

  const deduped = [...byKey.values()];
  const supabase = createStartupDbClient();

  try {
    for (const batch of chunk(deduped, UPSERT_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("startup_companies")
        .upsert(
          batch.map((record) => record.company),
          { onConflict: "dedup_key" }
        )
        .select("id, dedup_key");

      if (error) {
        log.error("Failed to upsert startup companies", {
          error: error.message,
          count: batch.length,
        });
        continue;
      }

      const rows = data ?? [];
      result.companiesUpserted += rows.length;

      // Link founders to the ids the upsert just returned.
      const idByKey = new Map(rows.map((row) => [row.dedup_key, row.id]));
      const people = batch.flatMap((record) => {
        const startupId = idByKey.get(record.dedupKey);
        if (!startupId) return [];
        return record.people.map((person) => ({
          ...person,
          startup_id: startupId,
          updated_at: new Date().toISOString(),
        }));
      });

      if (people.length === 0) continue;

      for (const peopleBatch of chunk(people, UPSERT_CHUNK_SIZE)) {
        const { error: peopleError, count } = await supabase
          .from("startup_people")
          .upsert(peopleBatch, {
            onConflict: "startup_id,dedup_key",
            count: "exact",
          });

        if (peopleError) {
          log.error("Failed to upsert startup people", {
            error: peopleError.message,
            count: peopleBatch.length,
          });
          continue;
        }
        result.peopleUpserted += count ?? peopleBatch.length;
      }
    }
  } catch (error) {
    log.error("Startup catalog ingestion failed", { error: String(error) });
  }

  log.info("Startup catalog updated", { ...result });
  return result;
}
