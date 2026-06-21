export interface CsvLeadRow {
  company: string;
  domain: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  contactName: string;
  title: string;
  email: string | null;
  linkedin: string | null;
}

const HEADER_ALIASES: Record<string, keyof CsvLeadRow> = {
  company: "company",
  company_name: "company",
  organization: "company",
  domain: "domain",
  website: "domain",
  website_url: "domain",
  industry: "industry",
  sector: "industry",
  country: "country",
  city: "city",
  location: "city",
  contact_name: "contactName",
  name: "contactName",
  full_name: "contactName",
  contact: "contactName",
  title: "title",
  job_title: "title",
  role: "title",
  email: "email",
  email_address: "email",
  linkedin: "linkedin",
  linkedin_url: "linkedin",
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function splitName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeDomain(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase();
  }
}

export function parseCsvLeads(csvText: string): {
  rows: CsvLeadRow[];
  errors: string[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV must include a header row and at least one data row."] };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const mappedHeaders = headers.map((header) => HEADER_ALIASES[header] ?? null);

  if (!mappedHeaders.includes("company")) {
    return {
      rows: [],
      errors: ['CSV must include a "company" column.'],
    };
  }

  const rows: CsvLeadRow[] = [];
  const errors: string[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const record: Partial<CsvLeadRow> = {
      company: "",
      domain: null,
      industry: null,
      country: null,
      city: null,
      contactName: "",
      title: "Team Member",
      email: null,
      linkedin: null,
    };

    mappedHeaders.forEach((key, columnIndex) => {
      if (!key) return;
      const value = values[columnIndex]?.trim();
      if (!value) return;

      if (key === "domain") {
        record.domain = normalizeDomain(value);
        return;
      }

      record[key] = value as never;
    });

    if (!record.company?.trim()) {
      errors.push(`Row ${lineIndex + 1}: missing company name.`);
      continue;
    }

    if (!record.contactName?.trim()) {
      record.contactName = "Unknown Contact";
    }

    rows.push({
      company: record.company.trim(),
      domain: record.domain ?? null,
      industry: record.industry ?? null,
      country: record.country ?? null,
      city: record.city ?? null,
      contactName: record.contactName.trim(),
      title: record.title?.trim() || "Team Member",
      email: record.email?.trim().toLowerCase() ?? null,
      linkedin: record.linkedin?.trim() ?? null,
    });
  }

  return { rows, errors };
}

export function csvRowsToDiscoveredData(rows: CsvLeadRow[]): {
  companies: import("@/types/company").DiscoveredCompany[];
  contacts: import("@/types/contact").DiscoveredContact[];
} {
  const companies: import("@/types/company").DiscoveredCompany[] = [];
  const contacts: import("@/types/contact").DiscoveredContact[] = [];
  const companyIdByKey = new Map<string, string>();

  rows.forEach((row, index) => {
    const companyKey = (row.domain ?? row.company).toLowerCase();
    let companyId = companyIdByKey.get(companyKey);

    if (!companyId) {
      companyId = `csv-company-${index}-${companyKey.replace(/[^a-z0-9]+/g, "-")}`;
      companyIdByKey.set(companyKey, companyId);
      companies.push({
        id: companyId,
        name: row.company,
        domain: row.domain,
        industry: row.industry,
        description: null,
        employeeCount: null,
        country: row.country,
        city: row.city,
        state: null,
        linkedinUrl: null,
        websiteUrl: row.domain ? `https://${row.domain}` : null,
        technologies: null,
        confidenceScore: 70,
      });
    }

    const { firstName, lastName } = splitName(row.contactName);
    contacts.push({
      id: `csv-contact-${index}`,
      companyId,
      companyName: row.company,
      companyDomain: row.domain,
      firstName,
      lastName,
      fullName: row.contactName,
      title: row.title,
      department: null,
      email: row.email,
      emailIsGuessed: false,
      linkedinUrl: row.linkedin,
      confidenceScore: 75,
    });
  });

  return { companies, contacts };
}

export const CSV_IMPORT_TEMPLATE = `company,domain,industry,country,city,contact_name,title,email,linkedin
ButterBee,butterbee.co,Technology,Pakistan,Islamabad,Laiba Kafayat,CEO,layibakafayat@gmail.com,
Acme Health,acmehealth.com,Healthcare,United States,Boston,Jane Smith,CEO,jane.smith@acmehealth.com,https://linkedin.com/in/jane-smith`;
