"use client";

/**
 * Loads the provider catalog from `/api/providers`.
 *
 * The list is fetched rather than hard-coded so registering a provider makes it
 * appear in the builder with no UI change — which is the point of the registry.
 * Disabled providers are returned too, with a reason, so the picker can show
 * them greyed out instead of silently omitting them.
 */
import { useCallback, useEffect, useState } from "react";

export interface ProviderInfo {
  id: string;
  displayName: string;
  kind: "company" | "people" | "contact" | "funding";
  tier: "free" | "paid";
  enabled: boolean;
  reason: string | null;
  priority: number;
}

export interface UseProvidersResult {
  providers: ProviderInfo[];
  byKind: Record<string, ProviderInfo[]>;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useProviders(): UseProvidersResult {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/providers", { signal: controller.signal });
        if (!response.ok) throw new Error(`Failed to load providers (${response.status})`);

        const body = await response.json();
        if (cancelled) return;
        setProviders(Array.isArray(body.providers) ? body.providers : []);
      } catch (caught) {
        if (cancelled || controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonce]);

  const byKind = providers.reduce<Record<string, ProviderInfo[]>>((acc, provider) => {
    (acc[provider.kind] ??= []).push(provider);
    return acc;
  }, {});

  return { providers, byKind, loading, error, reload };
}
