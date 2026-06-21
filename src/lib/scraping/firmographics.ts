import {
  normalizeCountryName,
  textMentionsCountry,
} from "@/lib/search/country-aliases";

const EMPLOYEE_RANGE_PATTERN =
  /(\d{1,3}(?:,\d{3})*)\s*[-–]\s*(\d{1,3}(?:,\d{3})*)\s*employees/i;
const EMPLOYEE_COUNT_PATTERN =
  /(\d{1,3}(?:,\d{3})*)\+?\s*employees?\b/i;
const EMPLOYEE_STAFF_PATTERN = /(\d{1,3}(?:,\d{3})*)\+?\s*(staff|people|team members)\b/i;
const LINKEDIN_SIZE_PATTERN =
  /\b(\d{1,3}(?:,\d{3})*)\s*[-–]\s*(\d{1,3}(?:,\d{3})*)\s*employees?\b/i;

function parseCount(value: string): number | null {
  const count = Number(value.replace(/,/g, ""));
  return Number.isFinite(count) && count > 0 ? count : null;
}

/** Parse employee headcount from search snippets, LinkedIn text, or page copy. */
export function parseEmployeeCountFromText(text: string): number | null {
  if (!text.trim()) return null;

  const rangeMatch = text.match(EMPLOYEE_RANGE_PATTERN) ?? text.match(LINKEDIN_SIZE_PATTERN);
  if (rangeMatch) {
    const low = parseCount(rangeMatch[1]);
    const high = parseCount(rangeMatch[2]);
    if (low && high) return Math.round((low + high) / 2);
  }

  const countMatch =
    text.match(EMPLOYEE_COUNT_PATTERN) ?? text.match(EMPLOYEE_STAFF_PATTERN);
  if (countMatch) {
    return parseCount(countMatch[1]);
  }

  return null;
}

/** Human-readable employee range for API output. */
export function formatEmployeeRange(
  count: number | null,
  min?: number | null,
  max?: number | null
): string | null {
  if (min != null && max != null) return `${min} – ${max}`;
  if (count == null) return null;
  if (count <= 10) return "1 – 10";
  if (count <= 50) return "11 – 50";
  if (count <= 200) return "51 – 200";
  if (count <= 500) return "201 – 500";
  if (count <= 1000) return "501 – 1,000";
  if (count <= 5000) return "1,001 – 5,000";
  return "5,000+";
}

const COUNTRY_NAMES = [
  "pakistan",
  "united states",
  "united kingdom",
  "india",
  "germany",
  "france",
  "canada",
  "australia",
  "united arab emirates",
  "singapore",
  "netherlands",
  "brazil",
  "mexico",
  "spain",
  "italy",
  "sweden",
  "switzerland",
  "ireland",
  "south africa",
  "nigeria",
  "kenya",
  "bangladesh",
  "sri lanka",
  "nepal",
  "saudi arabia",
  "japan",
  "south korea",
  "china",
  "indonesia",
  "malaysia",
  "philippines",
  "vietnam",
  "turkey",
  "egypt",
  "argentina",
  "colombia",
  "chile",
  "new zealand",
  "poland",
  "norway",
  "denmark",
];

/** Extract country name from free text (address blocks, about copy, LinkedIn snippets). */
export function parseCountryFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const country of COUNTRY_NAMES) {
    if (lower.includes(country)) {
      return country
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }

  for (const [alias, canonical] of Object.entries({
    usa: "United States",
    uk: "United Kingdom",
    uae: "United Arab Emirates",
    pk: "Pakistan",
  })) {
    if (new RegExp(`\\b${alias}\\b`, "i").test(lower)) {
      return canonical;
    }
  }

  return null;
}

export function extractFirmographics(sources: Array<string | null | undefined>): {
  employeeCount: number | null;
  country: string | null;
} {
  const combined = sources.filter(Boolean).join(" ");
  return {
    employeeCount: parseEmployeeCountFromText(combined),
    country: parseCountryFromText(combined),
  };
}

export function countryMatchesTarget(
  companyCountry: string | null,
  targetCountry: string,
  textSources: Array<string | null | undefined>
): boolean {
  if (!targetCountry.trim()) return true;

  const target = normalizeCountryName(targetCountry);
  if (companyCountry && normalizeCountryName(companyCountry) === target) return true;

  const combined = textSources.filter(Boolean).join(" ");
  return textMentionsCountry(combined, targetCountry);
}
