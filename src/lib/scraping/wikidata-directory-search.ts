import { createLogger } from "@/lib/logger";
import { extractDomainFromUrl } from "@/lib/scraping/extract-domain";
import type { CompanyDirectorySeed } from "@/lib/scraping/company-directory-seeds";
import { countryToWikidataId } from "@/lib/search/jurisdiction-codes";
import { isUsefulSearchName } from "@/lib/search/search-name-utils";

const log = createLogger("scraping.wikidata-directory");
const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "LeadForge/1.0 (company research; contact@righttail.com)";

/** Q4830453 = business, Q6881511 = enterprise */
const BUSINESS_TYPES = "wd:Q4830453 wd:Q6881511 wd:Q891723";

interface SparqlBinding {
  type: string;
  value: string;
}

interface SparqlResponse {
  results?: {
    bindings?: Array<{
      companyLabel?: SparqlBinding;
      website?: SparqlBinding;
      countryLabel?: SparqlBinding;
    }>;
  };
}

function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildKeywordFilter(keywords: string[], industry: string, searchName?: string): string {
  const terms = [
    isUsefulSearchName(searchName) ? searchName?.trim() : "",
    industry.trim(),
    ...keywords.slice(0, 2),
  ]
    .filter((t): t is string => Boolean(t?.trim()))
    .map((t) => t.toLowerCase());

  if (terms.length === 0) return "";

  const clauses = terms.map(
    (term) => `CONTAINS(LCASE(?companyLabel), "${escapeSparqlLiteral(term)}")`
  );

  return `FILTER(${clauses.join(" || ")})`;
}

function buildSparqlQuery(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  limit: number;
}): string {
  const countryId = countryToWikidataId(input.country);
  const keywordFilter = buildKeywordFilter(
    input.keywords,
    input.industry,
    input.searchName
  );

  const countryClause = countryId
    ? `?company wdt:P17 wd:${countryId} .`
    : "";

  const filterClause = keywordFilter ? `\n  ${keywordFilter}` : "";

  return `
SELECT ?companyLabel ?website ?countryLabel WHERE {
  VALUES ?businessType { ${BUSINESS_TYPES} }
  ?company wdt:P31/wdt:P279* ?businessType .
  ?company wdt:P856 ?website .
  ${countryClause}
  ?company rdfs:label ?companyLabel .
  FILTER(LANG(?companyLabel) = "en")
  OPTIONAL {
    ?company wdt:P17 ?country .
    ?country rdfs:label ?countryLabel .
    FILTER(LANG(?countryLabel) = "en")
  }${filterClause}
}
LIMIT ${input.limit}
`.trim();
}

async function runSparql(query: string): Promise<SparqlResponse | null> {
  try {
    const response = await fetch(SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(35_000),
    });

    if (!response.ok) {
      log.warn("Wikidata SPARQL error", { status: response.status });
      return null;
    }

    return (await response.json()) as SparqlResponse;
  } catch (error) {
    log.warn("Wikidata SPARQL failed", { error: String(error) });
    return null;
  }
}

interface SparqlBindingRow {
  companyLabel?: SparqlBinding;
  website?: SparqlBinding;
  countryLabel?: SparqlBinding;
}

function mapBinding(
  binding: SparqlBindingRow,
  fallbackCountry: string
): CompanyDirectorySeed | null {
  const name = binding.companyLabel?.value?.trim();
  const website = binding.website?.value?.trim();
  if (!name || !website) return null;

  const domain = extractDomainFromUrl(website);
  if (!domain) return null;

  const country = binding.countryLabel?.value?.trim() || fallbackCountry || null;

  return {
    title: name,
    url: website.startsWith("http") ? website : `https://${website}`,
    snippet: `Global business directory (Wikidata).${country ? ` Country: ${country}.` : ""}`,
    domain,
    source: "wikidata",
    country,
    city: null,
  };
}

export async function searchWikidataDirectoryCompanies(input: {
  industry: string;
  country: string;
  keywords: string[];
  searchName?: string;
  maxResults?: number;
}): Promise<CompanyDirectorySeed[]> {
  const maxResults = input.maxResults ?? 12;

  async function fetchSeeds(withKeywords: boolean): Promise<CompanyDirectorySeed[]> {
    const query = buildSparqlQuery({
      ...input,
      searchName: withKeywords ? input.searchName : undefined,
      industry: withKeywords ? input.industry : "",
      keywords: withKeywords ? input.keywords : [],
      limit: Math.min(maxResults * 2, 40),
    });

    const body = await runSparql(query);
    const bindings = body?.results?.bindings ?? [];

    const seen = new Set<string>();
    const seeds: CompanyDirectorySeed[] = [];

    for (const binding of bindings) {
      const seed = mapBinding(binding, input.country);
      if (!seed?.domain || seen.has(seed.domain)) continue;
      seen.add(seed.domain);
      seeds.push(seed);
      if (seeds.length >= maxResults) break;
    }

    return seeds;
  }

  let seeds = await fetchSeeds(true);
  if (seeds.length === 0 && input.country.trim()) {
    seeds = await fetchSeeds(false);
  }

  log.info("Wikidata directory search completed", {
    country: input.country,
    count: seeds.length,
  });

  return seeds;
}
