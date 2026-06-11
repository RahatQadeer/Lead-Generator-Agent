export function formatStatValue(count: number): string {
  return count > 0 ? String(count) : "—";
}

export function formatConversionRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate}%`;
}
