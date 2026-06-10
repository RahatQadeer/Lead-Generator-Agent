import type { Database } from "@/types/database";
import type { SearchRecord } from "@/types/search";

type SearchRow = Database["public"]["Tables"]["searches"]["Row"];

export function toSearchRecord(row: SearchRow): SearchRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    industry: row.industry ?? "",
    companySizeMin: row.company_size_min,
    companySizeMax: row.company_size_max,
    country: row.country ?? "",
    keywords: row.keywords,
    technologies: row.technologies,
    jobTitles: row.job_titles,
    status: row.status as SearchRecord["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatCompanySize(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min.toLocaleString()} – ${max.toLocaleString()}`;
  if (min !== null) return `${min.toLocaleString()}+`;
  if (max !== null) return `Up to ${max.toLocaleString()}`;
  return "—";
}
