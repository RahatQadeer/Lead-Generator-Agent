import { createLogger } from "@/lib/logger";
import { sanitizePersonLinkedInUrl } from "@/lib/scraping/data-quality";
import type { ParsedContact } from "@/lib/scraping/parse-html";

const log = createLogger("scraping.wikidata-people");

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "LeadForge/1.0 (company research; contact@righttail.com)";

/** Wikidata claims that map to leadership roles on a company entity. */
const LEADERSHIP_CLAIMS: Array<{ prop: string; defaultTitle: string }> = [
  { prop: "P169", defaultTitle: "Chief Executive Officer" },
  { prop: "P488", defaultTitle: "Chairperson" },
  { prop: "P112", defaultTitle: "Founder" },
  { prop: "P3320", defaultTitle: "Board Member" },
  { prop: "P1037", defaultTitle: "Director" },
];

interface WikidataSearchResponse {
  search?: Array<{ id: string; label: string; description?: string }>;
}

interface WikidataEntity {
  labels?: Record<string, { value: string }>;
  claims?: Record<
    string,
    Array<{
      mainsnak?: {
        datavalue?: {
          type?: string;
          value?: string | { id?: string; "entity-type"?: string };
        };
      };
    }>
  >;
}

interface WikidataEntitiesResponse {
  entities?: Record<string, WikidataEntity>;
}

async function wikidataGet<T>(params: Record<string, string>): Promise<T | null> {
  const url = new URL(WIKIDATA_API);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    log.warn("Wikidata API error", { error: String(error) });
    return null;
  }
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function labelForEntity(entity: WikidataEntity | undefined): string | null {
  return entity?.labels?.en?.value ?? Object.values(entity?.labels ?? {})[0]?.value ?? null;
}

function linkedInFromEntity(entity: WikidataEntity | undefined): string | null {
  // P6634 = LinkedIn personal profile ID (not P4264 which is company page)
  const personal =
    entity?.claims?.P6634?.[0]?.mainsnak?.datavalue?.value;
  const personalId = typeof personal === "string" ? personal.trim() : null;
  if (personalId) {
    return sanitizePersonLinkedInUrl(`https://www.linkedin.com/in/${personalId}`);
  }
  return null;
}

async function searchCompanyQid(companyName: string): Promise<string | null> {
  const body = await wikidataGet<WikidataSearchResponse>({
    action: "wbsearchentities",
    search: companyName,
    language: "en",
    type: "item",
    limit: "5",
    format: "json",
  });

  const hits = body?.search ?? [];
  if (hits.length === 0) return null;

  const normalized = companyName.toLowerCase();
  const exact = hits.find((hit) => hit.label.toLowerCase() === normalized);
  const contains = hits.find((hit) =>
    hit.label.toLowerCase().includes(normalized) ||
    normalized.includes(hit.label.toLowerCase())
  );
  return (exact ?? contains)?.id ?? null;
}

/**
 * Free public directory: Wikidata leadership/board records for a company.
 * Used when website directory pages have no parseable contacts.
 */
export async function fetchLeadershipFromWikidata(
  companyName: string
): Promise<ParsedContact[]> {
  const companyQid = await searchCompanyQid(companyName);
  if (!companyQid) return [];

  const companyBody = await wikidataGet<WikidataEntitiesResponse>({
    action: "wbgetentities",
    ids: companyQid,
    props: "claims",
    format: "json",
  });

  const companyEntity = companyBody?.entities?.[companyQid];
  if (!companyEntity?.claims) return [];

  const personQids = new Map<string, string>();

  for (const { prop, defaultTitle } of LEADERSHIP_CLAIMS) {
    const claims = companyEntity.claims[prop] ?? [];
    for (const claim of claims) {
      const raw = claim.mainsnak?.datavalue?.value;
      const personId =
        raw && typeof raw === "object" && "id" in raw ? raw.id : undefined;
      if (!personId || personQids.has(personId)) continue;
      personQids.set(personId, defaultTitle);
    }
  }

  if (personQids.size === 0) return [];

  const peopleBody = await wikidataGet<WikidataEntitiesResponse>({
    action: "wbgetentities",
    ids: Array.from(personQids.keys()).join("|"),
    props: "labels|claims",
    format: "json",
  });

  const contacts: ParsedContact[] = [];

  for (const [personQid, defaultTitle] of personQids) {
    const entity = peopleBody?.entities?.[personQid];
    const fullName = labelForEntity(entity);
    if (!fullName) continue;

    const { firstName, lastName } = splitName(fullName);

    contacts.push({
      fullName,
      firstName,
      lastName,
      title: defaultTitle,
      email: null,
      linkedinUrl: linkedInFromEntity(entity),
      source: "page",
      extractionSource: "wikidata",
      affiliationText: `${fullName} ${defaultTitle} ${companyName}`,
    });
  }

  log.info("Wikidata leadership fetched", {
    company: companyName,
    qid: companyQid,
    count: contacts.length,
  });

  return contacts;
}
