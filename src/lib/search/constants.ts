export const INDUSTRIES = [
  "Healthcare",
  "Financial Services",
  "Technology",
  "E-commerce",
  "Education",
  "Manufacturing",
  "Real Estate",
  "Media & Entertainment",
  "Logistics",
  "Energy",
  "Retail",
  "Consulting",
  "Legal",
  "Hospitality",
  "Other",
] as const;

export const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Netherlands",
  "India",
  "Singapore",
  "United Arab Emirates",
  "Other",
] as const;

export const COMPANY_SIZE_PRESETS = [
  { label: "1 – 10", min: 1, max: 10 },
  { label: "11 – 50", min: 11, max: 50 },
  { label: "51 – 200", min: 51, max: 200 },
  { label: "201 – 500", min: 201, max: 500 },
  { label: "501 – 1,000", min: 501, max: 1000 },
  { label: "1,001 – 5,000", min: 1001, max: 5000 },
  { label: "5,000+", min: 5000, max: null },
] as const;

export const JOB_TITLE_SUGGESTIONS = [
  "CEO",
  "CTO",
  "CFO",
  "COO",
  "Founder",
  "Co-Founder",
  "VP Engineering",
  "VP Sales",
  "VP Marketing",
  "Marketing Director",
  "Head of Product",
  "Marketing Manager",
  "Sales Director",
  "IT Director",
] as const;

export const TECHNOLOGY_SUGGESTIONS = [
  "React",
  "Node.js",
  "Python",
  "AWS",
  "Azure",
  "Salesforce",
  "HubSpot",
  "Shopify",
  "WordPress",
  "Kubernetes",
  "Docker",
  "PostgreSQL",
] as const;
