export interface LeadEnrichmentInput {
  id: string;
  fullName: string;
  title: string;
  email: string | null;
  linkedinUrl: string | null;
  companyId: string;
  companyName: string;
  companyCity: string | null;
  companyState: string | null;
  companyCountry: string | null;
}

export interface EnrichedLead {
  id: string;
  name: string;
  role: string;
  company: string;
  linkedin: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  email: string | null;
  companyId: string;
  searchId: string | null;
  enrichedAt: string;
}

export interface LeadEnrichmentResult {
  leads: EnrichedLead[];
  provider: string;
  enrichedCount: number;
  skippedCount: number;
}
