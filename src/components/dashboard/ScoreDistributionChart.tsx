import type { LeadScoreBucket } from "@/types/dashboard";

interface ScoreDistributionChartProps {
  buckets: LeadScoreBucket[];
  averageScore: number | null;
}

const segmentFill: Record<LeadScoreBucket["color"], string> = {
  red: "#fca5a5",
  amber: "#fcd34d",
  cyan: "#93c5fd",
  emerald: "#6ee7b7",
};

const segmentBar: Record<LeadScoreBucket["color"], string> = {
  red: "bg-red-300",
  amber: "bg-amber-300",
  cyan: "bg-sky-300",
  emerald: "bg-emerald-300",
};

const segmentDot: Record<LeadScoreBucket["color"], string> = {
  red: "bg-red-400",
  amber: "bg-amber-400",
  cyan: "bg-sky-400",
  emerald: "bg-emerald-400",
};

function buildConicGradient(buckets: LeadScoreBucket[], total: number): string {
  if (total <= 0) return "#f3f4f6";

  let cursor = 0;
  const stops: string[] = [];

  for (const bucket of buckets) {
    if (bucket.count <= 0) continue;
    const start = (cursor / total) * 100;
    cursor += bucket.count;
    const end = (cursor / total) * 100;
    stops.push(`${segmentFill[bucket.color]} ${start}% ${end}%`);
  }

  return stops.length > 0 ? stops.join(", ") : "#f3f4f6";
}

export function ScoreDistributionChart({
  buckets,
  averageScore,
}: ScoreDistributionChartProps) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const gradient = buildConicGradient(buckets, total);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative h-32 w-32 shrink-0">
        <div
          className="h-full w-full rounded-full"
          style={{ background: `conic-gradient(from 225deg, ${gradient})` }}
          role="img"
          aria-hidden
        />
        <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100">
          {averageScore !== null ? (
            <>
              <span className="text-2xl font-bold leading-none tabular-nums text-gray-950">
                {averageScore}
              </span>
              <span className="mt-0.5 text-[10px] text-gray-400">avg</span>
            </>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {buckets.map((bucket) => {
          const pct = total > 0 ? Math.round((bucket.count / total) * 100) : 0;

          return (
            <li key={bucket.label}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${segmentDot[bucket.color]}`}
                  />
                  <span className="font-medium text-gray-700">
                    {bucket.label}
                  </span>
                  <span className="text-gray-400">({bucket.range})</span>
                </div>
                <span className="shrink-0 tabular-nums text-gray-600">
                  {bucket.count}
                  {total > 0 && (
                    <span className="ml-1.5 text-gray-400">{pct}%</span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${segmentBar[bucket.color]} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
