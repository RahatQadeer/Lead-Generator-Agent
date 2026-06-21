export function parsePainPointsInput(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;

  if (Array.isArray(value)) {
    const points = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return points.length > 0 ? points : undefined;
  }

  if (typeof value === "string") {
    const points = value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    return points.length > 0 ? points : undefined;
  }

  return undefined;
}
