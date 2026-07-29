"use client";

/**
 * Which providers to run, loaded live from `/api/providers`.
 *
 * Disabled providers are shown greyed out WITH their reason rather than hidden.
 * A provider silently missing from this list is indistinguishable from a bug;
 * "not configured" tells the user there is an action available.
 *
 * An empty selection means "every enabled provider", matching the column default
 * in migration 035 — so a user who never opens this section gets the full set.
 */
import { Controller, type Control } from "react-hook-form";
import { AlertCircle, Loader2, Plug, RefreshCw } from "lucide-react";
import { useProviders, type ProviderInfo } from "@/hooks/useProviders";
import { SectionShell } from "@/components/search-builder/sections/SectionShell";
import { PROVIDER_KIND_LABELS } from "@/lib/search-builder/labels";
import type { SearchBuilderValues } from "@/lib/search-builder/schema";

interface Props {
  control: Control<SearchBuilderValues>;
}

const KIND_ORDER = ["company", "people", "contact", "funding"] as const;

export function ProviderSelectionSection({ control }: Props) {
  const { byKind, loading, error, reload, providers } = useProviders();
  const enabledCount = providers.filter((p) => p.enabled).length;

  return (
    <SectionShell
      icon={Plug}
      title="Providers"
      description="Data sources the pipeline will use."
      aside={
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Refresh
        </button>
      }
    >
      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading providers…
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!loading && !error && (
        <Controller
          control={control}
          name="enabledProviders"
          render={({ field }) => (
            <div className="space-y-5">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {field.value.length === 0
                  ? `Using all ${enabledCount} available providers.`
                  : `${field.value.length} of ${enabledCount} selected.`}{" "}
                {field.value.length > 0 && (
                  <button
                    type="button"
                    onClick={() => field.onChange([])}
                    className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
                  >
                    Use all
                  </button>
                )}
              </p>

              {KIND_ORDER.map((kind) => {
                const group = byKind[kind] ?? [];
                if (group.length === 0) return null;

                return (
                  <fieldset key={kind}>
                    <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {PROVIDER_KIND_LABELS[kind] ?? kind}
                    </legend>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {group.map((provider) => (
                        <ProviderRow
                          key={provider.id}
                          provider={provider}
                          checked={field.value.includes(provider.id)}
                          onToggle={() =>
                            field.onChange(
                              field.value.includes(provider.id)
                                ? field.value.filter((id) => id !== provider.id)
                                : [...field.value, provider.id]
                            )
                          }
                        />
                      ))}
                    </ul>
                  </fieldset>
                );
              })}
            </div>
          )}
        />
      )}
    </SectionShell>
  );
}

function ProviderRow({
  provider,
  checked,
  onToggle,
}: {
  provider: ProviderInfo;
  checked: boolean;
  onToggle: () => void;
}) {
  const disabled = !provider.enabled;

  return (
    <li>
      <label
        className={[
          "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-70 dark:border-gray-800 dark:bg-gray-800/40"
            : checked
              ? "border-violet-400 bg-violet-50/60 dark:border-violet-700 dark:bg-violet-950/30"
              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900",
        ].join(" ")}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {provider.displayName}
          </span>
          <span className="block truncate font-mono text-[11px] text-gray-400">
            {provider.id}
          </span>
          {disabled && provider.reason && (
            <span className="mt-0.5 block text-[11px] text-amber-600 dark:text-amber-400">
              {provider.reason}
            </span>
          )}
          {provider.tier === "paid" && !disabled && (
            <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Paid
            </span>
          )}
        </span>
      </label>
    </li>
  );
}
