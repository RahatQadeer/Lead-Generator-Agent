/** Normalize a person name for comparison. */
export function normalizePersonName(name: string | null | undefined): string {
  if (!name?.trim()) return "";
  return name
    .toLowerCase()
    .replace(/[.,']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name: string): string[] {
  return normalizePersonName(name).split(" ").filter((part) => part.length > 1);
}

/** True when the name is only a first name or single token (no surname). */
export function isPartialPersonName(name: string | null | undefined): boolean {
  return nameTokens(name ?? "").length === 1;
}

/** Prefer a fuller name from LinkedIn when the scraped name is only a first name. */
export function upgradePartialPersonName(
  partial: string,
  resolved: string | null | undefined
): string {
  const trimmed = partial.trim();
  const resolvedTrimmed = resolved?.trim() ?? "";
  if (!resolvedTrimmed) return trimmed;

  const partialTokens = nameTokens(trimmed);
  const resolvedTokens = nameTokens(resolvedTrimmed);
  if (partialTokens.length >= 2) return trimmed;
  if (resolvedTokens.length < 2) return trimmed;

  const first = partialTokens[0];
  if (!first || resolvedTokens[0] !== first) return trimmed;

  return resolvedTrimmed;
}

export function splitPersonName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? fullName,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

/** True when every token of the shorter name appears in order in the longer name. */
function orderedNameTokensMatch(left: string[], right: string[]): boolean {
  if (left.length < 2 || right.length < 2) return false;

  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter[0] !== longer[0]) return false;
  if (shorter[shorter.length - 1] !== longer[longer.length - 1]) return false;

  let index = 0;
  for (const token of shorter) {
    while (index < longer.length && longer[index] !== token) {
      index += 1;
    }
    if (index >= longer.length) return false;
    index += 1;
  }

  return true;
}

/** Match full names, first+last, or when one name appears inside search result text. */
export function personNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = normalizePersonName(a);
  const right = normalizePersonName(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const leftParts = nameTokens(a ?? "");
  const rightParts = nameTokens(b ?? "");
  if (leftParts.length < 2 || rightParts.length < 2) {
    if (leftParts.length === 1 && rightParts.length >= 2 && leftParts[0] === rightParts[0]) {
      return true;
    }
    if (rightParts.length === 1 && leftParts.length >= 2 && rightParts[0] === leftParts[0]) {
      return true;
    }
    return false;
  }

  if (
    leftParts[0] === rightParts[0] &&
    leftParts[leftParts.length - 1] === rightParts[rightParts.length - 1]
  ) {
    return true;
  }

  return orderedNameTokensMatch(leftParts, rightParts);
}

/** True when a person's name appears in LinkedIn search titles/snippets. */
export function personNameAppearsInText(
  fullName: string,
  text: string | null | undefined
): boolean {
  if (!text?.trim()) return false;

  const normalizedName = normalizePersonName(fullName);
  if (!normalizedName) return false;

  const normalizedText = text
    .toLowerCase()
    .replace(/[|\-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizedText.includes(normalizedName)) return true;

  const parts = nameTokens(fullName);
  if (parts.length === 1) {
    return new RegExp(`\\b${parts[0]}\\b`, "i").test(normalizedText);
  }

  if (parts.length >= 2) {
    const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
    if (normalizedText.includes(firstLast)) return true;
  }

  return personNamesMatch(fullName, text);
}
