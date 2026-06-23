import { countryToIsoCode } from "@/lib/search/jurisdiction-codes";

/** ccTLD hints for country-scoped web discovery (free SearXNG queries). */
const ISO_TO_CCTLD: Record<string, string> = {
  pk: "pk",
  in: "in",
  gb: "co.uk",
  uk: "co.uk",
  us: "com",
  au: "com.au",
  ca: "ca",
  de: "de",
  fr: "fr",
  ae: "ae",
  sa: "sa",
  sg: "sg",
  my: "my",
  ng: "ng",
  za: "za",
  ie: "ie",
  nl: "nl",
  se: "se",
  no: "no",
  dk: "dk",
};

export function countryCcTld(country: string): string | null {
  const iso = countryToIsoCode(country.trim());
  if (!iso) return null;
  return ISO_TO_CCTLD[iso.toLowerCase()] ?? iso.toLowerCase();
}

/** Extra SearXNG queries biased toward local businesses in the target country. */
export function buildCountryLocalCompanyQueries(input: {
  industry: string;
  country: string;
  keywords: string[];
}): string[] {
  const industry = input.industry.trim();
  const country = input.country.trim();
  if (!country) return [];

  const ccTld = countryCcTld(country);
  const keyword = input.keywords[0]?.trim();
  const queries: string[] = [];

  if (industry && country) {
    queries.push(`${industry} companies ${country}`);
    queries.push(`${industry} company ${country} website`);
    if (industry.toLowerCase().includes("health")) {
      queries.push(`hospital clinic diagnostic ${country}`);
      queries.push(`healthcare provider ${country}`);
    }
  }

  if (ccTld && ccTld !== "com") {
    const siteFilter = `site:.${ccTld}`;
    if (industry) {
      queries.push(`${industry} company ${country} ${siteFilter}`);
    }
  }

  const iso = countryToIsoCode(country)?.toLowerCase();
  if (iso === "pk") {
    if (industry) {
      queries.push(`site:yellowpages.com.pk ${industry}`);
      queries.push(`site:company.com.pk ${industry}`);
    }
  }

  if (keyword && country) {
    queries.push(`${keyword} company ${country}`);
  }

  if (ccTld && ccTld !== "com" && keyword) {
    queries.push(`${keyword} ${country} site:.${ccTld}`);
  }

  return [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, 6);
}
