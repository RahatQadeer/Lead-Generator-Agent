/**
 * People Data Labs — people provider integration point.
 *
 * NOT YET IMPLEMENTED. Registered but inert without `PEOPLE_DATA_LABS_API_KEY`,
 * and paid-tier so the free-stack policy keeps it off by default.
 *
 * Implementation notes:
 *   - Person Search (`/v5/person/search`) with an Elasticsearch-style query on
 *     `job_company_website` is the right call. Matching on company NAME produces
 *     false positives across same-named companies; the domain is the reliable key,
 *     so skip targets with a null `companyDomain` rather than guessing.
 *   - Map PDL `job_title_role` / `job_title_levels` onto the ladder keys from
 *     `decision-maker-ladder.ts`. Do not invent a second ranking — that ladder is
 *     the single source of truth and two rival ladders is a bug this codebase has
 *     already had once.
 *   - PDL bills per matched record, not per request. Cap `size` from the caller's
 *     role list rather than fetching a page and filtering locally.
 *   - Work emails come back on the person record, so a PDL hit can also satisfy
 *     the contact stage — return them via the contact provider counterpart rather
 *     than widening PersonRecord.
 */
import { ProviderError } from "@/lib/providers/errors";
import type {
  PeopleProvider,
  PeopleTarget,
  PersonRecord,
  ProviderContext,
} from "@/lib/providers/types";

export function peopleDataLabsApiKey(): string | null {
  return process.env.PEOPLE_DATA_LABS_API_KEY?.trim() || null;
}

export function createPeopleDataLabsProvider(): PeopleProvider {
  return {
    id: "people-data-labs",
    displayName: "People Data Labs",
    kind: "people",
    tier: "paid",

    rateLimit: { requestsPerSecond: 10, burst: 10, maxConcurrent: 5 },

    isConfigured: () => Boolean(peopleDataLabsApiKey()),

    findPeople(
      _target: PeopleTarget,
      _roleKeys: readonly string[],
      _ctx: ProviderContext
    ): Promise<PersonRecord[]> {
      throw new ProviderError({
        provider: "people-data-labs",
        code: "NOT_CONFIGURED",
        message:
          "People Data Labs people search is an integration point and is not implemented yet.",
      });
    },
  };
}
