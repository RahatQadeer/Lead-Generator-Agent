import type { DiscoveredContact } from "@/types/contact";
import { matchesJobTitle } from "@/lib/contact-discovery/apply-title-filter";

const TITLE_PRIORITY: { pattern: RegExp; score: number }[] = [
  { pattern: /\b(co[- ]?founder|cofounder)\b/i, score: 100 },
  { pattern: /\bfounder\b/i, score: 98 },
  { pattern: /\bceo\b|chief executive/i, score: 96 },
  { pattern: /\bcto\b|chief technology/i, score: 92 },
  { pattern: /\bcfo\b|chief financial/i, score: 90 },
  { pattern: /\bcoo\b|chief operating/i, score: 88 },
  { pattern: /\bchief\b/i, score: 86 },
  { pattern: /\bvp\b|vice president/i, score: 84 },
  { pattern: /\bpresident\b/i, score: 82 },
  { pattern: /\bdirector\b/i, score: 78 },
  { pattern: /\bhead of\b/i, score: 76 },
  { pattern: /\bmanager\b/i, score: 70 },
  { pattern: /\blead\b/i, score: 65 },
  { pattern: /\bpartner\b/i, score: 62 },
];

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
  let score = 40;

  for (const { pattern, score: priority } of TITLE_PRIORITY) {
    if (normalized && pattern.test(normalized)) {
      score = Math.max(score, priority);
      break;
    }
  }

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
