/**
 * The provider registry.
 *
 * One table for all four kinds. The pipeline asks for the enabled providers of a
 * kind and iterates them; it never constructs one, names one, or checks whether
 * a vendor is configured. Adding a provider is a class plus one `register` call.
 *
 * Providers are registered as thunks and constructed on demand, so importing the
 * registry — which API routes do per request — does not build HTTP clients or
 * read credentials for providers this run will not touch.
 */
import { createLogger } from "@/lib/logger";
import { isProviderEnabled, providerDisabledReason } from "@/lib/providers/policy";
import type {
  AnyProvider,
  CompanyProvider,
  ContactProvider,
  FundingProvider,
  PeopleProvider,
  ProviderKind,
} from "@/lib/providers/types";

const log = createLogger("providers.registry");

type ProviderThunk = () => AnyProvider;

interface Entry {
  id: string;
  kind: ProviderKind;
  thunk: ProviderThunk;
  /** Lower runs first. Cheap, high-precision sources should precede fallbacks. */
  priority: number;
}

const REGISTRY = new Map<string, Entry>();

export interface RegisterOptions {
  /** Lower runs first; defaults to 100. */
  priority?: number;
}

/**
 * Register a provider. Re-registering an id replaces it, which is what lets a
 * test swap in a fake without touching the pipeline.
 */
export function registerProvider(
  id: string,
  kind: ProviderKind,
  thunk: ProviderThunk,
  options: RegisterOptions = {}
): void {
  REGISTRY.set(id, { id, kind, thunk, priority: options.priority ?? 100 });
}

export function unregisterProvider(id: string): void {
  REGISTRY.delete(id);
}

/** Every registered provider of a kind, enabled or not, in priority order. */
export function listProviders(kind: ProviderKind): AnyProvider[] {
  return [...REGISTRY.values()]
    .filter((entry) => entry.kind === kind)
    .sort((a, b) => a.priority - b.priority)
    .map((entry) => entry.thunk());
}

/**
 * The providers of a kind that can actually run right now.
 *
 * This is what the pipeline calls. An unconfigured or policy-disabled provider
 * is filtered out here rather than throwing mid-run.
 */
export function getEnabledProviders(kind: ProviderKind): AnyProvider[] {
  const enabled: AnyProvider[] = [];

  for (const provider of listProviders(kind)) {
    if (isProviderEnabled(provider)) {
      enabled.push(provider);
      continue;
    }
    log.debug("Provider skipped", {
      provider: provider.id,
      kind,
      reason: providerDisabledReason(provider),
    });
  }

  return enabled;
}

// Typed accessors — the pipeline uses these so a kind mismatch is a type error
// rather than a runtime surprise.
export function getCompanyProviders(): CompanyProvider[] {
  return getEnabledProviders("company") as CompanyProvider[];
}
export function getPeopleProviders(): PeopleProvider[] {
  return getEnabledProviders("people") as PeopleProvider[];
}
export function getContactProviders(): ContactProvider[] {
  return getEnabledProviders("contact") as ContactProvider[];
}
export function getFundingProviders(): FundingProvider[] {
  return getEnabledProviders("funding") as FundingProvider[];
}

export interface ProviderStatus {
  id: string;
  displayName: string;
  kind: ProviderKind;
  tier: "free" | "paid";
  enabled: boolean;
  /** Populated when `enabled` is false. */
  reason: string | null;
  priority: number;
}

/** Full status of every provider — powers /api/health and the settings UI. */
export function describeProviders(): ProviderStatus[] {
  return [...REGISTRY.values()]
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.priority - b.priority)
    .map((entry) => {
      const provider = entry.thunk();
      return {
        id: provider.id,
        displayName: provider.displayName,
        kind: provider.kind,
        tier: provider.tier,
        enabled: isProviderEnabled(provider),
        reason: providerDisabledReason(provider),
        priority: entry.priority,
      };
    });
}

/** Test helper — empties the registry. */
export function resetProviderRegistry(): void {
  REGISTRY.clear();
}
