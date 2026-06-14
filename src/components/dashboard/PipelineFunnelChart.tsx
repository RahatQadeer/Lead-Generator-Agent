import type { ConversionFunnelStage } from "@/types/dashboard";

interface PipelineFunnelChartProps {
  stages: ConversionFunnelStage[];
}

const stageColor: Record<string, string> = {
  discovered: "#38bdf8",
  enriched: "#a78bfa",
  contacted: "#fbbf24",
  replied: "#34d399",
};

const stageDot: Record<string, string> = {
  discovered: "bg-sky-400",
  enriched: "bg-violet-400",
  contacted: "bg-amber-400",
  replied: "bg-emerald-400",
};

const SEGMENT_HEIGHT = 32;
const GAP = 2;
const VIEW_WIDTH = 100;

function stageWidth(count: number, baseline: number, maxCount: number): number {
  if (baseline > 0) {
    return Math.max((count / baseline) * 90, count > 0 ? 28 : 12);
  }
  return Math.max((count / maxCount) * 90, count > 0 ? 28 : 12);
}

export function PipelineFunnelChart({ stages }: PipelineFunnelChartProps) {
  const baseline = stages[0]?.count ?? 0;
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const widths = stages.map((s) => stageWidth(s.count, baseline, maxCount));

  const totalHeight =
    stages.length * SEGMENT_HEIGHT + Math.max(0, stages.length - 1) * GAP;

  let y = 0;
  const polygons = stages.map((stage, index) => {
    const topW = widths[index];
    const bottomW =
      index < stages.length - 1
        ? widths[index + 1]
        : Math.max(topW * 0.7, 16);

    const topLeft = (VIEW_WIDTH - topW) / 2;
    const topRight = topLeft + topW;
    const bottomLeft = (VIEW_WIDTH - bottomW) / 2;
    const bottomRight = bottomLeft + bottomW;

    const points = [
      `${topLeft},${y}`,
      `${topRight},${y}`,
      `${bottomRight},${y + SEGMENT_HEIGHT}`,
      `${bottomLeft},${y + SEGMENT_HEIGHT}`,
    ].join(" ");

    const segment = { stage, points };
    y += SEGMENT_HEIGHT + GAP;
    return segment;
  });

  return (
    <div className="flex items-center gap-6 lg:gap-10">
      <div className="w-[100px] shrink-0 lg:w-[120px]">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${totalHeight}`}
          className="h-auto w-full"
          role="img"
          aria-label="Pipeline conversion funnel"
        >
          {polygons.map(({ stage, points }) => (
            <polygon
              key={stage.key}
              points={points}
              fill={stageColor[stage.key] ?? "#38bdf8"}
              opacity={stage.count > 0 ? 0.9 : 0.3}
            />
          ))}
        </svg>
      </div>

      <ul className="min-w-0 flex-1 divide-y divide-gray-100">
        {stages.map((stage) => (
          <li
            key={stage.key}
            className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${stageDot[stage.key] ?? "bg-sky-400"}`}
              />
              <span className="truncate text-sm font-medium text-gray-700">
                {stage.label}
              </span>
            </div>

            <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
              {stage.count.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
