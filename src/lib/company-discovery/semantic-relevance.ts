/**
 * Deterministic semantic-relevance scoring between a user's search and a
 * discovered company.
 *
 * The spec calls for a "semantic similarity score >= 85%". True embedding-based
 * similarity would require a paid model call, which conflicts with the default
 * free stack (DISABLE_PAID_APIS). Instead this computes a deterministic,
 * embeddings-free relevance signal from term coverage: how much of the query's
 * industry and keyword vocabulary is actually present in the company's own
 * words (name + industry + description + technologies).
 *
 * It is intentionally a *supporting* signal, not a hard gate — the existing
 * industry classifier already rejects off-industry companies. A low semantic
 * score downgrades a company from "verified" to "needs verification" rather than
 * discarding it, so we never silently drop a real lead because our lexical
 * vocabulary didn't line up. All functions are pure and unit-testable.
 */

/** Below this, a company is flagged as a weak semantic match to the query. */
export const SEMANTIC_RELEVANCE_FLOOR = 45;
/** At/above this, the query and company vocabularies strongly align. */
export const SEMANTIC_RELEVANCE_STRONG = 85;

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "our",
  "your",
  "their",
  "are",
  "was",
  "were",
  "will",
  "have",
  "has",
  "had",
  "not",
  "you",
  "who",
  "what",
  "how",
  "why",
  "all",
  "can",
  "inc",
  "llc",
  "ltd",
  "co",
  "corp",
  "company",
  "companies",
  "solution",
  "solutions",
  "service",
  "services",
  "platform",
  "based",
  "global",
  "leading",
  "world",
]);

/** Lowercase, strip punctuation, drop stopwords/short tokens, light singularize. */
export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((token) => singularize(token))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function singularize(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function normalizePhrase(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface SemanticRelevanceQuery {
  industry: string;
  keywords?: string[];
  technologies?: string[];
}

export interface SemanticRelevanceTarget {
  name?: string | null;
  industry?: string | null;
  description?: string | null;
  technologies?: string[] | null;
}

export interface SemanticRelevanceResult {
  /** 0-100 relevance score. */
  score: number;
  industryCoverage: number;
  keywordCoverage: number | null;
  matchedTerms: string[];
  strong: boolean;
}

function coverage(queryTokens: string[], targetSet: Set<string>): { ratio: number; matched: string[] } {
  const unique = [...new Set(queryTokens)];
  if (unique.length === 0) return { ratio: 1, matched: [] };
  const matched = unique.filter((token) => targetSet.has(token));
  return { ratio: matched.length / unique.length, matched };
}

/**
 * Compute a 0-100 semantic relevance score between a search and a company.
 *
 * Weighting: industry vocabulary is the dominant signal (0.65), keyword +
 * technology vocabulary the remainder (0.35). An exact industry-phrase match
 * floors the score at 70 so companies that clearly belong to the industry but
 * don't happen to echo the search keywords aren't unfairly penalized.
 */
export function computeSemanticRelevance(
  query: SemanticRelevanceQuery,
  target: SemanticRelevanceTarget
): SemanticRelevanceResult {
  const targetText = [
    target.name,
    target.industry,
    target.description,
    (target.technologies ?? []).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const targetTokens = tokenize(targetText);
  const targetSet = new Set(targetTokens);

  const industryTokens = tokenize(query.industry);
  const keywordTokens = tokenize([...(query.keywords ?? []), ...(query.technologies ?? [])].join(" "));

  const industry = coverage(industryTokens, targetSet);
  const phrasePresent =
    industryTokens.length > 0 && normalizePhrase(targetText).includes(normalizePhrase(query.industry));

  let industryScore = industryTokens.length > 0 ? industry.ratio : 1;
  if (phrasePresent) industryScore = Math.max(industryScore, 0.85);

  const hasKeywords = keywordTokens.length > 0;
  const keyword = hasKeywords ? coverage(keywordTokens, targetSet) : null;

  let score01 = keyword ? 0.65 * industryScore + 0.35 * keyword.ratio : industryScore;
  if (phrasePresent) score01 = Math.max(score01, 0.7);

  const score = Math.round(Math.min(100, Math.max(0, score01 * 100)));

  return {
    score,
    industryCoverage: Math.round(industryScore * 100) / 100,
    keywordCoverage: keyword ? Math.round(keyword.ratio * 100) / 100 : null,
    matchedTerms: [...new Set([...industry.matched, ...(keyword?.matched ?? [])])],
    strong: score >= SEMANTIC_RELEVANCE_STRONG,
  };
}
