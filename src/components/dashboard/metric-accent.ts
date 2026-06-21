export const metricAccentStyles = {
  violet: {
    icon: "bg-violet-50 text-violet-600 ring-violet-100",
    glow: "from-violet-50/90 via-violet-50/40",
  },
  sky: {
    icon: "bg-sky-50 text-sky-600 ring-sky-100",
    glow: "from-sky-50/90 via-sky-50/40",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    glow: "from-emerald-50/90 via-emerald-50/40",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
    glow: "from-amber-50/90 via-amber-50/40",
  },
} as const;

export type MetricAccent = keyof typeof metricAccentStyles;

/** Shared top wash on metric cards */
export const metricGlowClassName =
  "pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b to-transparent";
