import { createLogger } from "@/lib/logger";
import { getPeopleDataLabsApiKey } from "@/lib/people-data-labs/config";

const log = createLogger("people-data-labs");
const PDL_SEARCH_URL = "https://api.peopledatalabs.com/v5/person/search";

export interface PdlPersonRecord {
  id?: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  work_email?: string | null;
  linkedin_url?: string | null;
  job_company_name?: string | null;
  job_company_website?: string | null;
  job_title_levels?: string[] | null;
}

export interface PdlPersonSearchResponse {
  status?: number;
  data?: PdlPersonRecord[];
  total?: number;
  error?: { message?: string; type?: string };
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function buildTitleSqlClause(jobTitles: string[]): string | null {
  const titles = jobTitles.map((title) => title.trim()).filter(Boolean);
  if (titles.length === 0) return null;

  const clauses: string[] = [];

  for (const title of titles) {
    const normalized = title.toLowerCase();
    clauses.push(`job_title LIKE '%${escapeSqlString(normalized)}%'`);

    if (/\bvp\b/.test(normalized) && /\bengineering\b/.test(normalized)) {
      clauses.push(`job_title LIKE '%vice president%engineering%'`);
      clauses.push(`job_title LIKE '%vp%engineering%'`);
      clauses.push(`job_title LIKE '%v.p.%engineering%'`);
    }
    if (normalized === "ceo") {
      clauses.push(`job_title LIKE '%chief executive%'`);
    }
    if (normalized === "cto") {
      clauses.push(`job_title LIKE '%chief technology%'`);
      clauses.push(`job_title LIKE '%chief technical%'`);
    }
  }

  return `(${[...new Set(clauses)].join(" OR ")})`;
}

function buildDomainSqlClause(domain: string, companyName?: string): string {
  const normalized = escapeSqlString(domain.replace(/^www\./, "").toLowerCase());
  const parts = [
    `job_company_website='${normalized}'`,
    `job_company_website='www.${normalized}'`,
  ];

  const name = companyName?.trim();
  if (name && name.length >= 3) {
    const escapedName = escapeSqlString(name.toLowerCase());
    parts.push(`job_company_name LIKE '%${escapedName}%'`);
  }

  return `(${parts.join(" OR ")})`;
}

function buildExecutiveSqlClause(): string {
  return `(job_title_levels IN ('cxo', 'vp', 'director', 'owner') OR job_title LIKE '%chief%officer%' OR job_title LIKE '%founder%' OR job_title LIKE '%president%' OR job_title LIKE '%vice president%' OR job_title LIKE '%director%' OR job_title LIKE '%owner%')`;
}

export function buildPersonSearchSql(input: {
  domain: string;
  companyName?: string;
  jobTitles: string[];
  executiveFallback?: boolean;
}): string {
  const must = [buildDomainSqlClause(input.domain, input.companyName)];

  const titleClause = input.executiveFallback
    ? buildExecutiveSqlClause()
    : buildTitleSqlClause(input.jobTitles);

  if (titleClause) {
    must.push(titleClause);
  }

  return `SELECT * FROM person WHERE ${must.join(" AND ")}`;
}

export async function searchPeopleDataLabsPeople(input: {
  domain: string;
  companyName?: string;
  jobTitles: string[];
  size?: number;
  executiveFallback?: boolean;
}): Promise<PdlPersonRecord[]> {
  const apiKey = getPeopleDataLabsApiKey();
  if (!apiKey) return [];

  const sql = buildPersonSearchSql(input);
  const size = Math.min(input.size ?? 10, 25);

  try {
    const response = await fetch(PDL_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({ sql, size, pretty: false }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = (await response.json()) as PdlPersonSearchResponse;

    if (!response.ok) {
      log.warn("PDL person search failed", {
        domain: input.domain,
        status: response.status,
        message: body.error?.message ?? "unknown",
      });
      return [];
    }

    return body.data ?? [];
  } catch (error) {
    log.warn("PDL person search request error", {
      domain: input.domain,
      error: String(error),
    });
    return [];
  }
}
