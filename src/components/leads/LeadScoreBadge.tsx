interface LeadScoreBadgeProps {
  score: number | null;
}

function scoreColor(score: number): string {
  if (score >= 8) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 6) return "border-violet-200 bg-violet-50 text-violet-800";
  if (score >= 4) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
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
