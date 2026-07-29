/**
 * Website people provider — the default, free way to find decision makers.
 *
 * Wraps the existing `ScrapingContactDiscoveryProvider`, which already does the
 * layered work: sitemap discovery, then leadership → about → other page phases,
 * name/title parsing, affiliation checks and relevance ranking. None of that is
 * reimplemented here; this only translates between the provider-layer contract
 * and the shape that module already speaks.
 *
 * Role handling: `roleKeys` are ladder keys from `decision-maker-ladder.ts`, and
 * that ladder stays the single authority on ranking. This maps keys to the title
 * strings the scraper matches on, and marks anything the scraper returned as a
 * relaxed match so the pipeline knows it is a fallback rather than a hit.
 */
import { DECISION_MAKER_LADDER } from "@/lib/contact-discovery/decision-maker-ladder";
import { ScrapingContactDiscoveryProvider } from "@/lib/contact-discovery/scraping-provider";
import { createLogger } from "@/lib/logger";
import type {
  PeopleProvider,
  PeopleTarget,
  PersonRecord,
  ProviderContext,
} from "@/lib/providers/types";
import type { DiscoveredContact } from "@/types/contact";

const log = createLogger("providers.people.website");

/** Ladder key → the title text the scraper's title filter matches against. */
function roleKeysToJobTitles(roleKeys: readonly string[]): string[] {
  if (roleKeys.length === 0) {
    // No explicit roles: ask for the top of the ladder and let the fallback
    // logic in the pipeline widen from there.
    return ["CEO", "Founder"];
  }

  const byKey = new Map(DECISION_MAKER_LADDER.map((rung) => [rung.key, rung.label]));
  const titles = roleKeys
    .map((key) => byKey.get(key) ?? key)
    // Ladder labels like "Founder / Co-Founder" carry two titles; the filter
    // matches better on them separately.
    .flatMap((label) => label.split("/").map((part) => part.trim()))
    .filter(Boolean);

  return [...new Set(titles)];
}

/** Resolve a person's title back onto a ladder key, for downstream ranking. */
export function roleKeyForTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  for (const rung of DECISION_MAKER_LADDER) {
    if (rung.pattern.test(title)) return rung.key;
  }
  return null;
}

function toPersonRecord(contact: DiscoveredContact): PersonRecord {
  return {
    fullName: contact.fullName,
    firstName: contact.firstName ?? null,
    lastName: contact.lastName ?? null,
    title: contact.title || null,
    department: contact.department ?? null,
    roleKey: roleKeyForTitle(contact.title),
    titleMatched: contact.titleMatched !== false,
    // DiscoveredContact.confidenceScore is 0–100; the provider layer is 0–1.
    confidence: Math.min(1, Math.max(0, (contact.confidenceScore ?? 0) / 100)),
    sourceUrl: contact.sourceUrl ?? null,
    linkedinUrl: contact.linkedinUrl ?? null,
  };
}

export function createWebsitePeopleProvider(): PeopleProvider {
  return {
    id: "website-people",
    displayName: "Company website",
    kind: "people",
    tier: "free",

    // Scraping a company's own site: one company at a time, politely. The
    // scraper paces its own page fetches internally.
    rateLimit: { requestsPerSecond: 4, burst: 8, maxConcurrent: 4 },

    isConfigured: () => true,

    async findPeople(
      target: PeopleTarget,
      roleKeys: readonly string[],
      ctx: ProviderContext
    ): Promise<PersonRecord[]> {
      if (!target.companyDomain && !target.websiteUrl) {
        // Nothing to scrape. Not an error — another provider may still know.
        return [];
      }

      ctx.onProgress?.({
        provider: "website-people",
        phase: `Finding decision makers at ${target.companyName}…`,
      });

      const provider = new ScrapingContactDiscoveryProvider();
      const result = await provider.search({
        jobTitles: roleKeysToJobTitles(roleKeys),
        companies: [
          {
            id: target.companyId,
            name: target.companyName,
            // The scraper resolves the site from the domain; there is no
            // separate website field on its target shape.
            domain: target.companyDomain,
            providerCompanyId: null,
          },
        ],
        page: 1,
        perPage: 25,
      });

      log.debug("Website people search finished", {
        company: target.companyName,
        found: result.contacts.length,
        relaxed: result.relaxedMatch ?? false,
      });

      return result.contacts.map((contact) => ({
        ...toPersonRecord(contact),
        // A relaxed result means the requested title was not present and the
        // scraper returned the next best person — that IS the fallback ladder
        // firing, and the pipeline must be able to tell.
        titleMatched: result.relaxedMatch ? false : contact.titleMatched !== false,
      }));
    },
  };
}
