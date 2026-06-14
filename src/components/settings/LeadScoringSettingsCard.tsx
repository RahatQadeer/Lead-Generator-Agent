"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { SettingsCard } from "@/components/ui/SettingsCard";
import {
  alertErrorClassName,
  alertSuccessClassName,
  btnGhostClassName,
  btnPrimaryClassName,
  hintClassName,
  textSecondaryClassName,
} from "@/lib/ui/styles";
import type {
  LeadScoringSettingsStatus,
  LeadScoringWeights,
} from "@/types/lead-scoring-settings";

const WEIGHT_FIELDS: Array<{
  key: keyof LeadScoringWeights;
  label: string;
  shortLabel: string;
  description: string;
  gradientClassName: string;
  accentClassName: string;
}> = [
  {
    key: "industryMatch",
    label: "Industry match",
    shortLabel: "Industry",
    description: "Company industry vs search industry",
    gradientClassName: "from-violet-400 to-violet-600",
    accentClassName: "accent-violet-600",
  },
  {
    key: "companySize",
    label: "Company size",
    shortLabel: "Size",
    description: "Employee count within search size range",
    gradientClassName: "from-sky-400 to-sky-600",
    accentClassName: "accent-sky-600",
  },
  {
    key: "locationMatch",
    label: "Location match",
    shortLabel: "Location",
    description: "Company country vs search country",
    gradientClassName: "from-emerald-400 to-emerald-600",
    accentClassName: "accent-emerald-600",
  },
  {
    key: "jobRoleMatch",
    label: "Job role match",
    shortLabel: "Role",
    description: "Contact title vs search job titles",
    gradientClassName: "from-amber-400 to-amber-600",
    accentClassName: "accent-amber-600",
  },
  {
    key: "technologyMatch",
    label: "Technology match",
    shortLabel: "Tech",
    description: "Company technologies vs search technologies",
    gradientClassName: "from-rose-400 to-rose-600",
    accentClassName: "accent-rose-600",
  },
];

interface LeadScoringSettingsCardProps {
  embedded?: boolean;
}

function WeightDistributionHeader({
  total,
  weights,
}: {
  total: number;
  weights: LeadScoringWeights;
}) {
  const isValid = total === 100;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex h-2 w-full overflow-hidden bg-gray-100">
        {WEIGHT_FIELDS.map((field) => {
          const value = weights[field.key];
          if (value <= 0) return null;

          return (
            <div
              key={field.key}
              className={`h-full bg-gradient-to-r ${field.gradientClassName}`}
              style={{ width: `${value}%` }}
              title={`${field.label}: ${value}%`}
            />
          );
        })}
      </div>

      <div className="flex flex-row items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-900">
            Distribution preview
          </p>
          <p
            className={`text-[10px] ${
              isValid ? "text-gray-500" : "font-medium text-amber-700"
            }`}
          >
            {isValid
              ? "Balanced — use the controls below to change"
              : "Total must equal 100%"}
          </p>
        </div>
        <span
          className={`shrink-0 text-sm font-bold tabular-nums ${
            isValid ? "text-violet-700" : "text-amber-700"
          }`}
        >
          {total}%
        </span>
      </div>
    </div>
  );
}

export function LeadScoringSettingsCard({
  embedded = false,
}: LeadScoringSettingsCardProps) {
  const [status, setStatus] = useState<LeadScoringSettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<LeadScoringWeights>({
    industryMatch: 20,
    companySize: 20,
    locationMatch: 20,
    jobRoleMatch: 20,
    technologyMatch: 20,
  });

  const weightTotal = useMemo(
    () => Object.values(weights).reduce((sum, value) => sum + value, 0),
    [weights]
  );

  async function loadStatus() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/lead-scoring/status");
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to load lead scoring settings.");
        return;
      }

      setStatus(data.status);
      setWeights(data.status.weights);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  function updateWeight(key: keyof LeadScoringWeights, value: number) {
    setWeights((current) => ({
      ...current,
      [key]: Math.min(100, Math.max(0, value)),
    }));
  }

  function updateWeightFromInput(key: keyof LeadScoringWeights, raw: string) {
    const parsed = Number.parseInt(raw, 10);
    updateWeight(key, Number.isNaN(parsed) ? 0 : parsed);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/lead-scoring/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weights),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to save settings.");
        return;
      }

      setStatus(data.status);
      setWeights(data.status.weights);
      setMessage("Lead scoring rules saved.");
    } catch {
      setError("Failed to save lead scoring settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/lead-scoring/settings", { method: "DELETE" });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to reset settings.");
        return;
      }

      setStatus(data.status);
      setWeights(data.status.weights);
      setMessage("Reset to default weights (20% each).");
    } catch {
      setError("Failed to reset lead scoring settings.");
    } finally {
      setSaving(false);
    }
  }

  const content = loading ? (
    <div className={`flex items-center gap-2 ${textSecondaryClassName}`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading configuration…
    </div>
  ) : (
    <>
      <WeightDistributionHeader total={weightTotal} weights={weights} />

      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-900">Set your weights</p>
        <p className={`mt-1 ${hintClassName}`}>
          Type a percentage or drag the slider on each factor. Set to 0% to
          exclude.
        </p>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {WEIGHT_FIELDS.map((field) => {
          const value = weights[field.key];

          return (
            <div
              key={field.key}
              title={field.description}
              className="min-w-[5.5rem] flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <div className="h-1.5 bg-gray-100">
                <div
                  className={`h-full bg-gradient-to-r transition-[width] duration-200 ${field.gradientClassName}`}
                  style={{ width: `${value}%` }}
                />
              </div>

              <div className="px-2 py-2.5">
                <label
                  htmlFor={`weight-input-${field.key}`}
                  className="block truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  {field.shortLabel}
                </label>

                <div className="mt-1.5 flex items-center gap-0.5">
                  <input
                    id={`weight-input-${field.key}`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={value}
                    onChange={(e) =>
                      updateWeightFromInput(field.key, e.target.value)
                    }
                    className="w-full min-w-0 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-1 text-center text-sm font-bold tabular-nums text-gray-900 focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
                    aria-label={`${field.label} weight`}
                  />
                  <span className="shrink-0 text-xs text-gray-400">%</span>
                </div>

                <input
                  id={`weight-${field.key}`}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={value}
                  onChange={(e) =>
                    updateWeight(
                      field.key,
                      Number.parseInt(e.target.value, 10)
                    )
                  }
                  aria-label={`${field.label} slider`}
                  className={`mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 ${field.accentClassName}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || weightTotal !== 100}
          className={btnPrimaryClassName}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save rules"
          )}
        </button>
        {status?.hasUserSettings && (
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className={btnGhostClassName}
          >
            Reset to defaults
          </button>
        )}
      </div>

      {message && (
        <div className={`mt-3 ${alertSuccessClassName}`} role="status">
          {message}
        </div>
      )}
      {error && (
        <div className={`mt-3 ${alertErrorClassName}`} role="alert">
          {error}
        </div>
      )}

      <p className={`mt-3 ${hintClassName}`}>
        Re-score leads on a search after changing rules to apply new weights.
      </p>
    </>
  );

  if (embedded) return content;

  return (
    <SettingsCard
      icon={BarChart3}
      iconClassName="bg-violet-50 text-violet-600"
      title="Lead scoring rules"
      description="Factor weights for the 1–10 lead score"
    >
      {content}
    </SettingsCard>
  );
}
