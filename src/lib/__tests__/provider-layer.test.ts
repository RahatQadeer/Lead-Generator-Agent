import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/lib/providers/errors";
import { callProvider, clearRunProviderState, tryProvider } from "@/lib/providers/execute";
import { resetRateLimiters } from "@/lib/providers/rate-limiter";
import {
  describeProviders,
  getCompanyProviders,
  getEnabledProviders,
  registerProvider,
  resetProviderRegistry,
} from "@/lib/providers/registry";
import { bootstrapProviders, resetProviderBootstrap } from "@/lib/providers";
import type { PeopleProvider, Provider } from "@/lib/providers/types";

const ENV_KEYS = ["DISABLE_PAID_APIS", "PROVIDERS_DISABLED"] as const;

function resetEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

/** Minimal people provider used to exercise the shared policy stack. */
function fakePeopleProvider(overrides: Partial<PeopleProvider> = {}): PeopleProvider {
  return {
    id: "fake",
    displayName: "Fake",
    kind: "people",
    tier: "free",
    isConfigured: () => true,
    rateLimit: { requestsPerSecond: 1000, burst: 1000 },
    retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    findPeople: async () => [],
    ...overrides,
  } as PeopleProvider;
}

function ctx(jobId = "job-1") {
  return { operation: "test", jobId, signal: new AbortController().signal };
}

beforeEach(() => {
  resetEnv();
  resetRateLimiters();
  resetProviderRegistry();
  resetProviderBootstrap();
});

afterEach(() => {
  resetEnv();
  clearRunProviderState("job-1");
});

describe("provider registry", () => {
  it("lets a provider be replaced without touching the pipeline", () => {
    registerProvider("p", "people", () => fakePeopleProvider({ displayName: "v1" }));
    expect(getEnabledProviders("people")[0]?.displayName).toBe("v1");

    registerProvider("p", "people", () => fakePeopleProvider({ displayName: "v2" }));
    expect(getEnabledProviders("people")).toHaveLength(1);
    expect(getEnabledProviders("people")[0]?.displayName).toBe("v2");
  });

  it("orders providers by priority, lowest first", () => {
    registerProvider("slow", "people", () => fakePeopleProvider({ id: "slow" }), {
      priority: 200,
    });
    registerProvider("fast", "people", () => fakePeopleProvider({ id: "fast" }), {
      priority: 10,
    });
    expect(getEnabledProviders("people").map((p) => p.id)).toEqual(["fast", "slow"]);
  });

  it("skips an unconfigured provider instead of failing", () => {
    registerProvider("off", "people", () =>
      fakePeopleProvider({ id: "off", isConfigured: () => false })
    );
    expect(getEnabledProviders("people")).toHaveLength(0);
    expect(describeProviders()[0]).toMatchObject({ enabled: false, reason: "not configured" });
  });

  it("gates paid providers behind the free-stack policy", () => {
    registerProvider("paid", "people", () =>
      fakePeopleProvider({ id: "paid", tier: "paid" })
    );

    process.env.DISABLE_PAID_APIS = "true";
    expect(getEnabledProviders("people")).toHaveLength(0);

    process.env.DISABLE_PAID_APIS = "false";
    expect(getEnabledProviders("people")).toHaveLength(1);
  });

  it("honours an explicit disable list above everything else", () => {
    registerProvider("apollo", "people", () => fakePeopleProvider({ id: "apollo" }));
    process.env.PROVIDERS_DISABLED = "apollo";
    expect(getEnabledProviders("people")).toHaveLength(0);
  });
});

describe("provider execution policy", () => {
  it("retries a transient failure and then succeeds", async () => {
    const provider = fakePeopleProvider();
    let calls = 0;

    const result = await callProvider(provider, ctx(), async () => {
      calls += 1;
      if (calls < 3) {
        throw new ProviderError({
          provider: "fake",
          code: "NETWORK",
          message: "socket hang up",
        });
      }
      return "ok";
    });

    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a non-retryable failure", async () => {
    const provider = fakePeopleProvider();
    let calls = 0;

    await expect(
      callProvider(provider, ctx(), async () => {
        calls += 1;
        throw new ProviderError({
          provider: "fake",
          code: "BAD_RESPONSE",
          message: "malformed",
        });
      })
    ).rejects.toBeInstanceOf(ProviderError);

    expect(calls).toBe(1);
  });

  it("disables a provider for the rest of the run once quota is exhausted", async () => {
    const provider = fakePeopleProvider();
    const call = vi.fn(async () => {
      throw new ProviderError({
        provider: "fake",
        code: "QUOTA_EXCEEDED",
        message: "out of credits",
      });
    });

    await expect(callProvider(provider, ctx(), call)).rejects.toBeInstanceOf(ProviderError);
    // Second call must not reach the vendor at all.
    await expect(callProvider(provider, ctx(), call)).rejects.toBeInstanceOf(ProviderError);

    expect(call).toHaveBeenCalledTimes(1);
  });

  it("tryProvider degrades to a fallback rather than failing the search", async () => {
    const provider = fakePeopleProvider();
    const value = await tryProvider(
      provider,
      ctx("job-try"),
      async () => {
        throw new ProviderError({ provider: "fake", code: "BAD_RESPONSE", message: "nope" });
      },
      ["fallback"]
    );
    expect(value).toEqual(["fallback"]);
    clearRunProviderState("job-try");
  });

  it("propagates an abort instead of swallowing it", async () => {
    const provider = fakePeopleProvider();
    const controller = new AbortController();
    controller.abort();

    await expect(
      tryProvider(
        provider,
        { operation: "test", jobId: "job-abort", signal: controller.signal },
        async () => "unreachable",
        "fallback"
      )
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
});

describe("scrapers registered as company providers", () => {
  it("exposes every directory source as its own company provider", () => {
    bootstrapProviders();
    const ids = getCompanyProviders().map((p) => p.id);

    expect(ids).toContain("scraper:ycombinator");
    expect(ids).toContain("scraper:techstars");
    expect(ids).toContain("scraper:antler");
    expect(ids).toContain("scraper:500global");
    expect(ids).toContain("scraper:a16z-portfolio");
  });

  it("keeps unimplemented integration points registered but disabled", () => {
    bootstrapProviders();
    const all = describeProviders();

    const places = all.find((p) => p.id === "google-places");
    expect(places).toMatchObject({ kind: "company", enabled: false });

    const pdl = all.find((p) => p.id === "people-data-labs");
    expect(pdl).toMatchObject({ kind: "people", enabled: false });

    // ...and they must not appear in the enabled set the pipeline iterates.
    expect(getCompanyProviders().map((p) => p.id)).not.toContain("google-places");
  });
});
