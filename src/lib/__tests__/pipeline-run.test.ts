import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPipeline, type PipelineInput } from "@/lib/pipeline/run-pipeline";
import type { PipelineProgress } from "@/lib/pipeline/progress";
import { ProgressTracker } from "@/lib/pipeline/progress";
import { registerProvider, resetProviderRegistry } from "@/lib/providers/registry";
import { bootstrapProviders, resetProviderBootstrap } from "@/lib/providers";
import { resetRateLimiters } from "@/lib/providers/rate-limiter";
import { ProviderError } from "@/lib/providers/errors";
import type {
  CompanyProvider,
  ContactProvider,
  PeopleProvider,
  PersonRecord,
} from "@/lib/providers/types";
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";

function profile(name: string, domain = `${name}.com`): ScrapedCompanyProfile {
  return {
    source: "ycombinator",
    sourceUrl: `https://yc.com/${name}`,
    sourceCompanyId: name,
    name,
    websiteUrl: `https://${domain}`,
    domain,
    description: "desc",
    industry: "fintech",
    category: null,
    tags: [],
    country: "United States",
    city: null,
    state: null,
    founders: [],
    publicEmail: null,
    publicPhone: null,
    contactPageUrl: null,
    careersPageUrl: null,
    socialLinks: {},
    fundingStage: null,
    teamSize: 10,
    launchDate: null,
    websiteExtras: {},
    scrapedAt: "2026-01-01T00:00:00.000Z",
    errors: [],
  };
}

function companyProvider(id: string, names: string[]): CompanyProvider {
  return {
    id,
    displayName: id,
    kind: "company",
    tier: "free",
    isConfigured: () => true,
    rateLimit: { requestsPerSecond: 1000, burst: 1000 },
    // eslint-disable-next-line @typescript-eslint/require-await
    async *discover() {
      for (const name of names) yield profile(name);
    },
  };
}

function peopleProvider(
  id: string,
  people: PersonRecord[],
  onCall?: () => void
): PeopleProvider {
  return {
    id,
    displayName: id,
    kind: "people",
    tier: "free",
    isConfigured: () => true,
    rateLimit: { requestsPerSecond: 1000, burst: 1000 },
    retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    findPeople: async () => {
      onCall?.();
      return people;
    },
  };
}

function person(fullName: string, titleMatched = true): PersonRecord {
  return {
    fullName,
    firstName: fullName.split(" ")[0] ?? null,
    lastName: null,
    title: "CEO",
    department: null,
    roleKey: "ceo",
    titleMatched,
    confidence: 0.9,
    sourceUrl: null,
  };
}

function contactProvider(id: string, email: string | null): ContactProvider {
  return {
    id,
    displayName: id,
    kind: "contact",
    tier: "free",
    isConfigured: () => true,
    rateLimit: { requestsPerSecond: 1000, burst: 1000 },
    retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    findContacts: async () =>
      email ? { email, emailIsGuessed: false, confidence: 0.9 } : null,
  };
}

function baseInput(overrides: Partial<PipelineInput> = {}): PipelineInput {
  return {
    jobId: `job-${Math.random().toString(36).slice(2)}`,
    userId: "user-1",
    searchId: null,
    criteria: { industry: "fintech", limit: 0 },
    roleKeys: ["ceo"],
    // Keep the suite offline: website enrichment is the only phase that reaches
    // the network without going through a (stubbable) provider.
    enrichCompanies: false,
    signal: new AbortController().signal,
    ...overrides,
  };
}

beforeEach(() => {
  resetRateLimiters();
  // runPipeline() calls bootstrapProviders() itself, which would register the
  // real scraper/website providers alongside the fakes below and send the suite
  // to the network. Run bootstrap first so its idempotency latch is already set,
  // THEN empty the registry — the call inside runPipeline becomes a no-op and
  // only the fakes registered per test are present.
  resetProviderBootstrap();
  bootstrapProviders();
  resetProviderRegistry();
});

describe("pipeline orchestration", () => {
  it("runs discovery → people → contacts and assembles the result", async () => {
    registerProvider("co", "company", () => companyProvider("co", ["acme"]));
    registerProvider("pp", "people", () => peopleProvider("pp", [person("Ada Lovelace")]));
    registerProvider("cc", "contact", () => contactProvider("cc", "ada@acme.com"));

    const result = await runPipeline(baseInput());

    expect(result.companies).toHaveLength(1);
    const company = result.companies[0]!;
    expect(company.profile.name).toBe("acme");
    expect(company.people).toHaveLength(1);
    expect(company.people[0]!.person.fullName).toBe("Ada Lovelace");
    expect(company.people[0]!.contact?.email).toBe("ada@acme.com");
    expect(company.confidence).toBeGreaterThan(0);
  });

  it("keeps going when a company provider throws", async () => {
    registerProvider("bad", "company", () => ({
      ...companyProvider("bad", []),
      // eslint-disable-next-line require-yield
      async *discover() {
        throw new Error("source down");
      },
    }));
    registerProvider("good", "company", () => companyProvider("good", ["acme"]));

    const result = await runPipeline(baseInput());

    expect(result.companies).toHaveLength(1);
    expect(result.degradedProviders).toContain("bad");
  });

  it("falls through to the next people provider when the title does not match", async () => {
    const secondCalled = vi.fn();
    registerProvider("co", "company", () => companyProvider("co", ["acme"]));
    registerProvider(
      "p1",
      "people",
      () => peopleProvider("p1", [person("Fallback Person", false)]),
      { priority: 10 }
    );
    registerProvider(
      "p2",
      "people",
      () => peopleProvider("p2", [person("Exact Match", true)], secondCalled),
      { priority: 20 }
    );

    const result = await runPipeline(baseInput());

    expect(secondCalled).toHaveBeenCalled();
    expect(result.companies[0]!.people[0]!.person.fullName).toBe("Exact Match");
  });

  it("stops asking people providers once an exact title matches", async () => {
    const secondCalled = vi.fn();
    registerProvider("co", "company", () => companyProvider("co", ["acme"]));
    registerProvider("p1", "people", () => peopleProvider("p1", [person("Exact")]), {
      priority: 10,
    });
    registerProvider("p2", "people", () => peopleProvider("p2", [person("Other")], secondCalled), {
      priority: 20,
    });

    await runPipeline(baseInput());
    expect(secondCalled).not.toHaveBeenCalled();
  });

  it("removes companies already known to the user", async () => {
    registerProvider("co", "company", () => companyProvider("co", ["acme", "beta"]));
    registerProvider("pp", "people", () => peopleProvider("pp", []));

    const first = await runPipeline(baseInput());
    const known = new Set(first.companies.map((c) => c.dedupKey!).filter(Boolean));

    const second = await runPipeline(baseInput({ knownDedupKeys: known }));
    expect(second.companies).toHaveLength(0);
  });

  it("deduplicates the same company yielded by two sources", async () => {
    registerProvider("a", "company", () => companyProvider("a", ["acme"]));
    registerProvider("b", "company", () => companyProvider("b", ["acme"]));
    registerProvider("pp", "people", () => peopleProvider("pp", []));

    const result = await runPipeline(baseInput());
    expect(result.companies).toHaveLength(1);
    expect(result.duplicatesRemoved).toBeGreaterThan(0);
  });

  it("reports phase, provider, counts and a monotonic percentage", async () => {
    registerProvider("co", "company", () => companyProvider("co", ["acme"]));
    registerProvider("pp", "people", () => peopleProvider("pp", [person("Ada")]));
    registerProvider("cc", "contact", () => contactProvider("cc", "ada@acme.com"));

    const snapshots: PipelineProgress[] = [];
    await runPipeline(baseInput({ onProgress: (p) => snapshots.push({ ...p }) }));

    const phases = new Set(snapshots.map((s) => s.phase));
    expect(phases).toContain("company_discovery");
    expect(phases).toContain("people_discovery");
    expect(phases).toContain("contact_discovery");
    expect(phases).toContain("completed");

    const percents = snapshots.map((s) => s.percent);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
    expect(percents.at(-1)).toBe(100);

    const final = snapshots.at(-1)!;
    expect(final.counts.companiesFound).toBe(1);
    expect(final.counts.peopleFound).toBe(1);
    expect(final.counts.contactsFound).toBe(1);
  });

  it("stops on abort and reports the stopped phase", async () => {
    const controller = new AbortController();
    registerProvider("co", "company", () => companyProvider("co", ["a", "b", "c"]));

    const snapshots: PipelineProgress[] = [];
    controller.abort();

    await expect(
      runPipeline(
        baseInput({ signal: controller.signal, onProgress: (p) => snapshots.push({ ...p }) })
      )
    ).rejects.toBeInstanceOf(ProviderError);

    expect(snapshots.at(-1)?.phase).toBe("stopped");
  });
});

describe("progress tracker", () => {
  it("never rewinds the percentage", () => {
    const seen: number[] = [];
    const tracker = new ProgressTracker("job", (p) => seen.push(p.percent));

    tracker.setPhase("people_discovery");
    tracker.setPhaseStep(9, 10);
    tracker.setPhase("company_discovery"); // out-of-order phase
    tracker.setPhaseStep(1, 10);

    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("holds the reached percentage on failure rather than snapping", () => {
    const tracker = new ProgressTracker("job");
    tracker.setPhase("people_discovery");
    tracker.setPhaseStep(1, 1);
    const before = tracker.snapshot().percent;

    tracker.finish("failed");
    expect(tracker.snapshot().percent).toBe(before);
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(100);
  });

  it("caps the tracked error list", () => {
    const tracker = new ProgressTracker("job");
    for (let i = 0; i < 100; i++) tracker.recordError(`err ${i}`);
    const errors = tracker.snapshot().errors;
    expect(errors.length).toBeLessThanOrEqual(25);
    expect(errors.at(-1)?.message).toBe("err 99");
  });
});
