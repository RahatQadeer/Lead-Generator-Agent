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

function parseOptionalInt(value: string): number | null {
  if (!value.trim()) return null;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

export function validateSearchCriteria(
  input: SearchCriteriaInput
): SearchValidationResult {
  const errors: Record<string, string> = {};

  const name = input.name.trim();
  if (!name) errors.name = "Search name is required.";
  if (name.length > 100) errors.name = "Name must be 100 characters or less.";

  const industry = input.industry.trim();
  if (!industry) errors.industry = "Industry is required.";

  const country = input.country.trim();
  if (!country) errors.country = "Country is required.";

  const companySizeMin = parseOptionalInt(input.companySizeMin);
  const companySizeMax = parseOptionalInt(input.companySizeMax);

  if (companySizeMin === null && companySizeMax === null) {
    errors.companySize = "Company size is required.";
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
