import type { DiscoveredContact } from "@/types/contact";
import { matchesJobTitle } from "@/lib/contact-discovery/apply-title-filter";
import { decisionMakerScore } from "@/lib/contact-discovery/decision-maker-ladder";

const DEPARTMENT_RULES: { pattern: RegExp; department: string }[] = [
  { pattern: /\b(engineering|software|developer|technology|tech|it)\b/i, department: "Engineering" },
  { pattern: /\b(sales|revenue|business development|bd)\b/i, department: "Sales" },
  { pattern: /\b(marketing|growth|brand|content)\b/i, department: "Marketing" },
  { pattern: /\b(product)\b/i, department: "Product" },
  { pattern: /\b(finance|financial|accounting)\b/i, department: "Finance" },
  { pattern: /\b(hr|human resources|people|talent)\b/i, department: "Human Resources" },
  { pattern: /\b(operations|ops)\b/i, department: "Operations" },
  { pattern: /\b(legal|counsel)\b/i, department: "Legal" },
  { pattern: /\b(customer success|support|service)\b/i, department: "Customer Success" },
  { pattern: /\b(design|creative|ux|ui)\b/i, department: "Design" },
  { pattern: /\b(data|analytics|science)\b/i, department: "Data" },
  { pattern: /\b(security|cyber)\b/i, department: "Security" },
];

export function scoreTitleRelevance(
  title: string | null | undefined,
  jobTitles: string[]
): number {
  const normalized = title?.trim() ?? "";
  // Base floor kept at 40: this score feeds the MIN_PERSON_CONFIDENCE gate, and an
  // unranked-but-real title should not be rejected outright.
  let score = 40;

  score = Math.max(score, decisionMakerScore(normalized));

  if (normalized && jobTitles.length > 0 && matchesJobTitle(normalized, jobTitles)) {
    score = Math.min(100, score + 15);
  }

  return score;
}

export function inferDepartment(title: string): string | null {
  for (const rule of DEPARTMENT_RULES) {
    if (rule.pattern.test(title)) return rule.department;
  }
  return null;
}

export function computeContactConfidence(contact: {
  title: string;
  email: string | null;
  emailIsGuessed: boolean;
  linkedinUrl: string | null;
  jobTitles: string[];
}): number {
  let score = scoreTitleRelevance(contact.title, contact.jobTitles);

  if (contact.linkedinUrl) score += 12;
  if (contact.email && !contact.emailIsGuessed) score += 18;
  else if (contact.emailIsGuessed) score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankContactsByRelevance(
  contacts: DiscoveredContact[],
  jobTitles: string[]
): DiscoveredContact[] {
  return [...contacts].sort((a, b) => {
    const scoreA = a.confidenceScore ?? scoreTitleRelevance(a.title, jobTitles);
    const scoreB = b.confidenceScore ?? scoreTitleRelevance(b.title, jobTitles);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.fullName.localeCompare(b.fullName);
  });
}
