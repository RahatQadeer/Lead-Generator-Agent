"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { inputClassName } from "@/components/ui/Field";
import type {
  LeadScoringSettingsStatus,
  LeadScoringWeights,
} from "@/types/lead-scoring-settings";

const WEIGHT_FIELDS: Array<{
  key: keyof LeadScoringWeights;
  label: string;
  description: string;
}> = [
  {
    key: "industryMatch",
    label: "Industry match",
    description: "Company industry vs search industry",
  },
  {
    key: "companySize",
    label: "Company size",
    description: "Employee count within search size range",
  },
  {
    key: "locationMatch",
    label: "Location match",
    description: "Company country vs search country",
  },
  {
    key: "jobRoleMatch",
    label: "Job role match",
    description: "Contact title vs search job titles",
  },
  {
    key: "technologyMatch",
    label: "Technology match",
    description: "Company technologies vs search technologies",
  },
];

export function LeadScoringSettingsCard() {
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

  function updateWeight(key: keyof LeadScoringWeights, value: string) {
    const parsed = Number.parseInt(value, 10);
    setWeights((current) => ({
      ...current,
      [key]: Number.isNaN(parsed) ? 0 : parsed,
    }));
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

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 sm:p-8 lg:col-span-2">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <BarChart3 className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Lead scoring rules
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Factor weights for the 1–10 lead score
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading configuration…
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs text-slate-500">
            Adjust how much each factor contributes to the final score. Weights
            must total 100%. Set a factor to 0% to exclude it.
          </p>

          <div className="mt-6 space-y-4">
            {WEIGHT_FIELDS.map((field) => (
              <div
                key={field.key}
                className="grid gap-3 rounded-xl border border-white/5 bg-slate-950/40 p-4 sm:grid-cols-[1fr_6rem]"
              >
                <div>
                  <label
                    htmlFor={`weight-${field.key}`}
                    className="text-sm font-medium text-slate-200"
                  >
                    {field.label}
                  </label>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {field.description}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      id={`weight-${field.key}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={weights[field.key]}
                      onChange={(e) => updateWeight(field.key, e.target.value)}
                      className={inputClassName}
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p
            className={`mt-4 text-xs ${
              weightTotal === 100 ? "text-slate-500" : "text-amber-300"
            }`}
          >
            Total: {weightTotal}% {weightTotal !== 100 && "(must equal 100%)"}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || weightTotal !== 100}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
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
                className="text-sm text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
              >
                Reset to defaults
              </button>
            )}
          </div>

          {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

          <p className="mt-3 text-xs text-slate-600">
            Re-score leads on a search after changing rules to apply new weights.
          </p>
        </>
      )}
    </div>
  );
}
