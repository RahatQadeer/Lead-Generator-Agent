import { formatConversionRate } from "@/lib/dashboard/format";
import type { ConversionRateMetric } from "@/types/dashboard";

interface ConversionRatesChartProps {
  rates: ConversionRateMetric[];
}

const rateTheme: Record<string, { ring: string; text: string }> = {
  enrich: { ring: "#a78bfa", text: "text-violet-600" },
  outreach: { ring: "#38bdf8", text: "text-sky-600" },
  "email-reply": { ring: "#34d399", text: "text-emerald-600" },
  "contact-reply": { ring: "#fbbf24", text: "text-amber-600" },
  overall: { ring: "#7c3aed", text: "text-violet-700" },
};

const shortLabel: Record<string, string> = {
  enrich: "Enrich",
  outreach: "Outreach",
  "email-reply": "Email reply",
  "contact-reply": "Contact reply",
};

function ProgressRing({
  value,
  color,
  size = 96,
  stroke = 6,
}: {
  value: number | null;
  color: string;
  size?: number;
  stroke?: number;
}) {
  const pct = value !== null ? Math.min(Math.max(value, 0), 100) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90 shrink-0"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function RateList({ items }: { items: ConversionRateMetric[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((rate) => {
        const theme = rateTheme[rate.key] ?? rateTheme.enrich;
        const pct =
          rate.value !== null ? Math.min(Math.max(rate.value, 0), 100) : 0;

        return (
          <li key={rate.key} className="min-w-0" title={rate.description}>
            <div className="flex items-center justify-between gap-3">
              <p className={`text-xs font-semibold ${theme.text}`}>
                {shortLabel[rate.key] ?? rate.label}
              </p>
              <p className="shrink-0 text-sm font-bold tabular-nums text-gray-950">
                {formatConversionRate(rate.value)}
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: theme.ring }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ConversionRatesChart({ rates }: ConversionRatesChartProps) {
  const pipelineRates = rates.filter((r) => r.key !== "overall");
  const overall = rates.find((r) => r.key === "overall");
  const overallTheme = rateTheme.overall;
  const leftRates = pipelineRates.slice(0, 2);
  const rightRates = pipelineRates.slice(2);

  return (
    <div className="flex flex-col items-center gap-8 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-6">
      <div className="w-full min-w-0 lg:justify-self-end lg:pr-2">
        <RateList items={leftRates} />
      </div>

      {overall && (
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <ProgressRing value={overall.value} color={overallTheme.ring} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold tabular-nums text-gray-950">
                {formatConversionRate(overall.value)}
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-900">
            {overall.label}
          </p>
          <p className="mt-1 max-w-[140px] text-xs leading-snug text-gray-500">
            {overall.description}
          </p>
        </div>
      )}

      <div className="w-full min-w-0 lg:justify-self-start lg:pl-2">
        <RateList items={rightRates} />
      </div>
    </div>
  );
}
