export const DEFAULT_LEAD_SCORING_WEIGHTS: LeadScoringWeights = {
  industryMatch: 20,
  companySize: 20,
  locationMatch: 20,
  jobRoleMatch: 20,
  technologyMatch: 20,
};

export interface LeadScoringWeights {
  industryMatch: number;
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
  companySize: number;
  locationMatch: number;
  jobRoleMatch: number;
  technologyMatch: number;
}
