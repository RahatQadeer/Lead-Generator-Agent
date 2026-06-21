import type { IntentAnalysis, IntentSignal, IntentSignalStrength } from "@/types/intent-signals";

interface IntentRule {
  id: string;
  label: string;
  strength: IntentSignalStrength;
  pattern: RegExp;
}

const INTENT_RULES: IntentRule[] = [
  {
    id: "buying_language",
    label: "Active buying language",
    strength: "high",
    pattern:
      /\b(evaluating|looking for|seeking|in the market for|vendor selection|rfp|request for proposal|shortlist|procurement)\b/i,
  },
  {
    id: "funding",
    label: "Recent funding",
    strength: "high",
    pattern:
      /\b(raised|funding round|series [a-e]|venture capital|seed round|investment from|secured \$)\b/i,
  },
  {
    id: "digital_initiative",
    label: "Digital transformation",
    strength: "high",
    pattern:
      /\b(digital transformation|moderniz(e|ing)|cloud migration|automation initiative|platform upgrade)\b/i,
  },
  {
    id: "hiring",
    label: "Actively hiring",
    strength: "medium",
    pattern:
      /\b(we(?:'re| are) hiring|job openings?|open roles?|join our team|careers page|growing team)\b/i,
  },
  {
    id: "expansion",
    label: "Business expansion",
    strength: "medium",
    pattern:
      /\b(expanding|new office|international growth|scaling|rapid growth|market expansion)\b/i,
  },
  {
    id: "tech_adoption",
    label: "Technology adoption",
    strength: "medium",
    pattern:
      /\b(implementing|rolling out|adopting|deploying|migrating to|new software|new platform)\b/i,
  },
  {
    id: "pain_point",
    label: "Stated pain point",
    strength: "medium",
    pattern:
      /\b(challenge|pain point|struggling with|need to improve|looking to streamline|inefficien)\b/i,
  },
];

const STRENGTH_SCORE: Record<IntentSignalStrength, number> = {
  high: 35,
  medium: 20,
  low: 10,
};

function excerpt(text: string, index: number, length = 80): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + length);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/** Detect intent-to-buy signals from company website text, news snippets, or careers pages. */
export function detectIntentSignals(text: string): IntentAnalysis {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { score: 0, signals: [] };
  }

  const signals: IntentSignal[] = [];
  const seen = new Set<string>();

  for (const rule of INTENT_RULES) {
    const match = rule.pattern.exec(normalized);
    if (!match || seen.has(rule.id)) continue;
    seen.add(rule.id);

    signals.push({
      id: rule.id,
      label: rule.label,
      strength: rule.strength,
      evidence: excerpt(normalized, match.index ?? 0),
    });
  }

  let score = signals.reduce((sum, signal) => sum + STRENGTH_SCORE[signal.strength], 0);
  score = Math.min(100, score);

  return { score, signals };
}

export interface CompanyIntentInput {
  name: string;
  description?: string | null;
  industry?: string | null;
  technologies?: string[] | null;
  websiteText?: string | null;
}

export function detectCompanyIntentSignals(input: CompanyIntentInput): IntentAnalysis {
  const combined = [
    input.name,
    input.industry,
    input.description,
    ...(input.technologies ?? []),
    input.websiteText,
  ]
    .filter(Boolean)
    .join(" ");

  return detectIntentSignals(combined);
}
