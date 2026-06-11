interface LeadScoreBadgeProps {
  score: number | null;
}

function scoreColor(score: number): string {
  if (score >= 8) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (score >= 6) return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  if (score >= 4) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

export function LeadScoreBadge({ score }: LeadScoreBadgeProps) {
  if (score === null) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreColor(score)}`}
    >
      Score {score}/10
    </span>
  );
}
