export const DEFAULT_LEAD_SCORING_WEIGHTS: LeadScoringWeights = {
  industryMatch: 18,
  companyTypeVerified: 18,
  companySize: 16,
  locationMatch: 16,
  jobRoleMatch: 16,
  technologyMatch: 16,
};

export interface LeadScoringWeights {
  industryMatch: number;
  companyTypeVerified: number;
  companySize: number;
  locationMatch: number;
  jobRoleMatch: number;
  technologyMatch: number;
}

export interface LeadScoringSettings {
  weights: LeadScoringWeights;
  updatedAt: string;
}

export interface LeadScoringSettingsStatus {
  weights: LeadScoringWeights;
  effectiveWeights: LeadScoringWeights;
  hasUserSettings: boolean;
}

export interface LeadScoringWeightsInput {
  industryMatch: number;
  companyTypeVerified: number;
  companySize: number;
  locationMatch: number;
  jobRoleMatch: number;
  technologyMatch: number;
}
