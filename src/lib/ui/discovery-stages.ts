export const COMPANY_DISCOVERY_STAGES = [
  "Searching directories and business registries…",
  "Querying Google Places and web search…",
  "Fetching and validating company websites…",
  "Scoring industry fit and data quality…",
  "Filtering duplicates and ranking results…",
] as const;

export const CONTACT_DISCOVERY_STAGES = [
  "Querying People Data Labs…",
  "Scanning leadership and team pages…",
  "Extracting names and titles from websites…",
  "Matching job titles and decision-makers…",
] as const;

export const ENRICHMENT_STAGES = [
  "Enriching contact profiles…",
  "Looking up email addresses and LinkedIn…",
  "Verifying email deliverability…",
] as const;
