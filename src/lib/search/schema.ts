import type { SearchCriteria, SearchCriteriaInput } from "@/types/search";

export type SearchValidationResult =
  | { success: true; data: SearchCriteria }
  | { success: false; errors: Record<string, string> };

function parseTagList(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

type IntParseResult = number | null | "invalid";

function parseOptionalInt(value: string): IntParseResult {
  if (!value.trim()) return null;
  const num = parseInt(value, 10);
  if (Number.isNaN(num)) return "invalid";
  return num;
}

export function validateSearchCriteria(
  input: SearchCriteriaInput
): SearchValidationResult {
  const errors: Record<string, string> = {};

  const name = input.name.trim();
  if (!name) errors.name = "Search name is required.";
  else if (name.length > 100) errors.name = "Name must be 100 characters or less.";

  const industry = input.industry.trim();
  if (!industry) errors.industry = "Industry is required.";

  const country = input.country.trim();
  if (!country) errors.country = "Country is required.";

  const rawMin = parseOptionalInt(input.companySizeMin);
  const rawMax = parseOptionalInt(input.companySizeMax);

  if (rawMin === "invalid" || rawMax === "invalid") {
    errors.companySize = "Company size must be a valid number.";
  }

  const companySizeMin = rawMin === "invalid" ? null : rawMin;
  const companySizeMax = rawMax === "invalid" ? null : rawMax;

  if (companySizeMin === null && companySizeMax === null && rawMin !== "invalid" && rawMax !== "invalid") {
    errors.companySize = "Company size is required.";
  }

  if (companySizeMin !== null && companySizeMin < 1) {
    errors.companySize = "Minimum company size must be at least 1.";
  }

  if (companySizeMax !== null && companySizeMax < 1) {
    errors.companySize = "Maximum company size must be at least 1.";
  }

  if (
    companySizeMin !== null &&
    companySizeMax !== null &&
    companySizeMin > companySizeMax
  ) {
    errors.companySize = "Minimum size cannot exceed maximum size.";
  }

  const keywords = parseTagList(input.keywords);
  const technologies = parseTagList(input.technologies);
  const jobTitles = parseTagList(input.jobTitles);

  if (jobTitles.length === 0) {
    errors.jobTitles = "At least one job title is required.";
  }

  if (keywords.length > 20) {
    errors.keywords = "Maximum 20 keywords allowed.";
  }

  if (technologies.length > 20) {
    errors.technologies = "Maximum 20 technologies allowed.";
  }

  if (jobTitles.length > 10) {
    errors.jobTitles = "Maximum 10 job titles allowed.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name,
      industry,
      companySizeMin,
      companySizeMax,
      country,
      keywords,
      technologies,
      jobTitles,
    },
  };
}
