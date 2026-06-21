"use client";

import { Loader2, Search } from "lucide-react";
import { formatElapsed } from "@/hooks/useElapsedSeconds";
import { iconTileSmClassName } from "@/lib/ui/styles";

export interface DiscoveryProgressState {
  current?: number;
  total?: number;
  foundCount?: number;
  stage?: string;
  itemLabel?: string;
}

interface DiscoveryProgressPanelProps {
  title: string;
  elapsedSeconds: number;
  progress: DiscoveryProgressState;
}

export function DiscoveryProgressPanel({
  title,
  elapsedSeconds,
  progress,
}: DiscoveryProgressPanelProps) {
  const { current, total, foundCount, stage, itemLabel } = progress;
  const percent =
    current != null && total != null && total > 0
      ? Math.min(100, Math.round((current / total) * 100))
      : undefined;

  return (
    <div className="mt-4 rounded-2xl border border-[color-mix(in_srgb,var(--color-accent-600)_22%,transparent)] bg-[var(--color-accent-50)] p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className={`${iconTileSmClassName} !bg-[var(--color-surface)]`}>
          {percent != null && percent < 100 ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Search className="h-4 w-4" strokeWidth={2} />
          )}
        </div>
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        <span className="text-xs text-[var(--color-ink-muted)]">
          {formatElapsed(elapsedSeconds)}
        </span>
      </div>

      {stage && (
        <p className="mt-2 text-xs text-[var(--color-ink-secondary)]">{stage}</p>
      )}

      {itemLabel && (
        <p className="mt-1 truncate text-xs font-medium text-[var(--color-ink)]">
          {itemLabel}
        </p>
      )}

      {current != null && total != null && (
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          {current} of {total}
          {foundCount != null ? ` · ${foundCount} found so far` : ""}
        </p>
      )}

      {foundCount != null && current == null && (
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          {foundCount} found so far
        </p>
      )}

      {percent != null && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-accent-600)_12%,transparent)]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--color-accent-600)] transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
