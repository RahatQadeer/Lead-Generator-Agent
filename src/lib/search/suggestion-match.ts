/** Case-insensitive exact match in a suggestion list. */
export function findExactSuggestion(
  query: string,
  suggestions: readonly string[]
): string | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  return suggestions.find((item) => item.toLowerCase() === normalized) ?? null;
}

/** Filter suggestions for autosuggest dropdown (prefix first, then contains). */
export function filterSuggestions(
  query: string,
  suggestions: readonly string[],
  max = 50
): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...suggestions].slice(0, max);

  const prefix: string[] = [];
  const contains: string[] = [];

  for (const item of suggestions) {
    const lower = item.toLowerCase();
    if (lower.startsWith(normalized)) prefix.push(item);
    else if (lower.includes(normalized)) contains.push(item);
  }

  return [...prefix, ...contains].slice(0, max);
}

/** Closest suggestion when the typed word is almost correct (simple edit distance). */
export function findSpellSuggestion(
  query: string,
  suggestions: readonly string[]
): string | null {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 3) return null;
  if (findExactSuggestion(query, suggestions)) return null;

  let best: { item: string; distance: number } | null = null;

  for (const item of suggestions) {
    const lower = item.toLowerCase();
    if (lower.startsWith(normalized.slice(0, 2))) {
      const distance = levenshtein(normalized, lower);
      if (distance <= 2 && (!best || distance < best.distance)) {
        best = { item, distance };
      }
    }
  }

  return best?.item ?? null;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0)
  );

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}
