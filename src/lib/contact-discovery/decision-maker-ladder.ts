/**
 * The single decision-maker priority ladder.
 *
 * Two rival ladders used to exist — one in `apply-title-filter.ts`, one in
 * `relevance.ts` — and they silently disagreed (VP outranked President in one and the
 * reverse in the other; neither knew VC partner roles, so a fund's Managing Partner
 * scored below a General Manager). Both now delegate here.
 *
 * Rank 1 is the best decision maker. Ordering is the product spec:
 *   1 Founder / Co-Founder   2 CEO                3 Managing Partner (VC)
 *   4 General Partner (VC)   5 Partner            6 CTO
 *   7 Head of Engineering    8 VP Engineering     9 Director
 *   10 Other relevant executive
 */

export interface DecisionMakerRung {
  /** 1 = best. Matches the numbering in the spec. */
  rank: number;
  /** Stable identifier used in selection reasons and tests. */
  key: string;
  /** Human-readable role name for the "reason for selection" output. */
  label: string;
  pattern: RegExp;
}

/**
 * Order matters: the first match wins, so more specific roles must precede broader
 * ones ("Head of Engineering" before "Partner", "VP Engineering" before "Director").
 */
export const DECISION_MAKER_LADDER: readonly DecisionMakerRung[] = [
  {
    rank: 1,
    key: "founder",
    label: "Founder / Co-Founder",
    pattern: /\b(co[-\s]?founders?|cofounders?|founders?|founding partner)\b/i,
  },
  {
    rank: 2,
    key: "ceo",
    label: "CEO",
    pattern: /\b(ceo|chief executive officer|chief executive)\b/i,
  },
  {
    rank: 3,
    key: "managing_partner",
    label: "Managing Partner",
    // "Managing Director" at a fund is the same tier, but at an operating company it
    // is a country/regional lead — rank 9 handles that case.
    pattern: /\b(managing partner|manager partner|managing general partner)\b/i,
  },
  {
    rank: 4,
    key: "general_partner",
    label: "General Partner",
    pattern: /\b(general partner|\bgp\b)\b/i,
  },
  {
    rank: 5,
    key: "partner",
    label: "Partner",
    pattern: /\b(venture partner|investment partner|principal partner|partner)\b/i,
  },
  {
    rank: 6,
    key: "cto",
    label: "CTO",
    pattern: /\b(cto|chief technology officer|chief technical officer)\b/i,
  },
  {
    rank: 7,
    key: "head_of_engineering",
    label: "Head of Engineering",
    pattern: /\bhead of (engineering|technology|tech|software|platform|it)\b/i,
  },
  {
    rank: 8,
    key: "vp_engineering",
    label: "VP Engineering",
    pattern:
      /\b(vp|vice president|svp|evp|senior vice president|executive vice president)\b[^|]{0,24}\b(engineering|technology|tech|software|platform)\b/i,
  },
  {
    rank: 9,
    key: "director",
    label: "Director",
    pattern:
      /\b(director|managing director|executive director|general manager|country manager|regional manager)\b/i,
  },
  {
    rank: 10,
    key: "executive",
    label: "Other executive",
    // Any remaining C-level/president/VP/owner/head-of role.
    pattern:
      /\b(president|owner|proprietor|chairman|chairperson|chairwoman|chief\s+[\w\s]{0,24}officer|cfo|coo|cmo|cpo|chro|vp|vice president|svp|evp|head of)\b/i,
  },
];

/** Worst possible rank — a title on no rung of the ladder. */
export const UNRANKED_DECISION_MAKER = 99;

export interface DecisionMakerMatch {
  rank: number;
  key: string;
  label: string;
}

/** The best rung a title matches, or null when it is not a decision-maker title. */
export function matchDecisionMakerRung(
  title: string | null | undefined
): DecisionMakerMatch | null {
  const normalized = title?.trim();
  if (!normalized) return null;

  for (const rung of DECISION_MAKER_LADDER) {
    if (rung.pattern.test(normalized)) {
      return { rank: rung.rank, key: rung.key, label: rung.label };
    }
  }

  return null;
}

/** Ladder rank for a title; [UNRANKED_DECISION_MAKER] when it matches no rung. */
export function decisionMakerRank(title: string | null | undefined): number {
  return matchDecisionMakerRung(title)?.rank ?? UNRANKED_DECISION_MAKER;
}

/**
 * 0-100 score derived from ladder rank, for sorting and confidence.
 * Rank 1 → 100, rank 10 → ~55, unranked → 0.
 */
export function decisionMakerScore(title: string | null | undefined): number {
  const rank = decisionMakerRank(title);
  if (rank === UNRANKED_DECISION_MAKER) return 0;
  return Math.max(0, 100 - (rank - 1) * 5);
}

/** Sort best-decision-maker first; ties broken by name for stable output. */
export function byDecisionMakerRank<T extends { title: string | null; fullName: string }>(
  contacts: readonly T[]
): T[] {
  return [...contacts].sort((left, right) => {
    const diff = decisionMakerRank(left.title) - decisionMakerRank(right.title);
    if (diff !== 0) return diff;
    return left.fullName.localeCompare(right.fullName);
  });
}

export interface DecisionMakerCandidate {
  title: string | null;
  fullName: string;
}

export interface DecisionMakerSelection<T> {
  contact: T;
  rank: number;
  label: string;
  /** Human-readable "reason for selection" for the output row. */
  reason: string;
}

/**
 * Pick the single best decision maker and explain the choice.
 *
 * Falls down the ladder automatically: when no Founder or CEO was found, the
 * highest-ranked person who *was* found is selected, and the reason records what
 * was missing so the output is auditable rather than a bare score.
 */
export function selectBestDecisionMaker<T extends DecisionMakerCandidate>(
  contacts: readonly T[],
  options: { companyName?: string } = {}
): DecisionMakerSelection<T> | null {
  const ranked = byDecisionMakerRank(contacts).filter(
    (contact) => decisionMakerRank(contact.title) !== UNRANKED_DECISION_MAKER
  );

  const best = ranked[0];
  if (!best) return null;

  const match = matchDecisionMakerRung(best.title);
  if (!match) return null;

  const at = options.companyName ? ` at ${options.companyName}` : "";

  if (match.rank === 1) {
    return {
      contact: best,
      rank: match.rank,
      label: match.label,
      reason: `${match.label} — top of the decision-maker priority list${at}.`,
    };
  }

  const missing = DECISION_MAKER_LADDER.filter((rung) => rung.rank < match.rank)
    .map((rung) => rung.label)
    .join(", ");

  return {
    contact: best,
    rank: match.rank,
    label: match.label,
    reason: `${match.label} — best available${at}; no ${missing} found. Priority ${match.rank} of ${DECISION_MAKER_LADDER.length}.`,
  };
}
