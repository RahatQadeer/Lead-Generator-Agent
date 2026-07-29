"use client";

/**
 * Live run panel: phase, provider, company, counts, retries and errors.
 *
 * The progress bar is driven by `percent` from the snapshot, which the tracker
 * guarantees is monotonic — so this never animates backwards, which reads as a
 * failure even when the run is healthy.
 */
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Contact,
  Loader2,
  Radio,
  RotateCw,
  Square,
  Users,
  XCircle,
} from "lucide-react";
import type { PipelineProgress } from "@/lib/pipeline/progress";
import type { RunStatus } from "@/hooks/usePipelineRun";

interface Props {
  status: RunStatus;
  progress: PipelineProgress | null;
  error: string | null;
  polling: boolean;
  onStop: () => void;
  onReset: () => void;
}

const TERMINAL: RunStatus[] = ["completed", "failed", "stopped"];

export function LivePipelineProgress({
  status,
  progress,
  error,
  polling,
  onStop,
  onReset,
}: Props) {
  const percent = progress?.percent ?? (status === "completed" ? 100 : 0);
  const isRunning = status === "running" || status === "starting";
  const counts = progress?.counts;

  return (
    <section
      aria-label="Run progress"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-gray-800 dark:bg-gray-900"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StatusIcon status={status} />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {progress?.phaseLabel ?? statusLabel(status)}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {progress?.provider ? (
                <span className="font-mono">{progress.provider}</span>
              ) : (
                statusLabel(status)
              )}
              {progress?.company && (
                <>
                  {" · "}
                  <span className="text-gray-700 dark:text-gray-300">
                    {progress.company}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {polling && (
            <span
              title="Streaming unavailable — polling for updates"
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
            >
              <Radio className="h-3 w-3" aria-hidden="true" />
              Polling
            </span>
          )}
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Square className="h-3 w-3" aria-hidden="true" />
              Stop
            </button>
          ) : (
            TERMINAL.includes(status) && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <RotateCw className="h-3 w-3" aria-hidden="true" />
                New run
              </button>
            )
          )}
        </div>
      </header>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall completion"
        className="mb-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
      >
        <div
          className={[
            "h-full rounded-full transition-[width] duration-500",
            status === "failed"
              ? "bg-red-500"
              : status === "stopped"
                ? "bg-amber-500"
                : "bg-violet-500",
          ].join(" ")}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mb-4 text-right text-xs tabular-nums text-gray-500">{percent}%</p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Building2} label="Companies" value={counts?.companiesFound ?? 0} />
        <Stat icon={Users} label="People" value={counts?.peopleFound ?? 0} />
        <Stat icon={Contact} label="Contacts" value={counts?.contactsFound ?? 0} />
        <Stat icon={RotateCw} label="Retries" value={progress?.retries ?? 0} />
      </dl>

      {(error || (progress?.errors?.length ?? 0) > 0) && (
        <div className="mt-4 space-y-1.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Issues
          </h3>
          <ul className="space-y-1" role="log" aria-live="polite">
            {error && (
              <li className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </li>
            )}
            {progress?.errors?.slice(-5).map((entry, index) => (
              <li
                key={`${entry.at}-${index}`}
                className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
              >
                <span className="font-medium">{entry.provider ?? entry.phase}</span>
                {": "}
                {entry.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/40">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </dd>
    </div>
  );
}

function StatusIcon({ status }: { status: RunStatus }) {
  const className = "h-5 w-5";
  if (status === "completed")
    return <CheckCircle2 className={`${className} text-emerald-500`} aria-hidden="true" />;
  if (status === "failed")
    return <XCircle className={`${className} text-red-500`} aria-hidden="true" />;
  if (status === "stopped")
    return <Square className={`${className} text-amber-500`} aria-hidden="true" />;
  return <Loader2 className={`${className} animate-spin text-violet-500`} aria-hidden="true" />;
}

function statusLabel(status: RunStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "starting":
      return "Starting…";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "stopped":
      return "Stopped";
  }
}
