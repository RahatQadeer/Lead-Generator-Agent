/**
 * End-to-end verification of the provider pipeline against ONE real source.
 *
 * Runs Y Combinator only, with a small limit, and prints what each phase
 * produced. Read-only by default: pass --save with a real user + search id to
 * exercise persistence as well.
 *
 *   npx tsx --env-file=.env.local scripts/verify-pipeline-yc.ts
 *   npx tsx --env-file=.env.local scripts/verify-pipeline-yc.ts --limit 5
 */
import { bootstrapProviders } from "@/lib/providers";
import { describeProviders } from "@/lib/providers/registry";
import { runPipeline } from "@/lib/pipeline/run-pipeline";
import type { PipelineProgress } from "@/lib/pipeline/progress";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

async function main(): Promise<number> {
  const limit = Number.parseInt(arg("limit", "3"), 10);
  const enrich = !process.argv.includes("--no-enrich");

  bootstrapProviders();

  const providers = describeProviders();
  console.log("\n=== Registered providers ===");
  for (const p of providers.filter((x) => x.enabled)) {
    console.log(`  [${p.kind.padEnd(8)}] ${p.id}`);
  }
  const yc = providers.find((p) => p.id === "scraper:ycombinator");
  if (!yc?.enabled) {
    console.error("\nFAIL: scraper:ycombinator is not enabled.", yc?.reason ?? "not registered");
    return 1;
  }

  console.log(`\n=== Running YC only (limit ${limit}, enrich ${enrich}) ===\n`);

  let lastPhase = "";
  const onProgress = (p: PipelineProgress) => {
    if (p.phase !== lastPhase) {
      lastPhase = p.phase;
      console.log(
        `[${String(p.percent).padStart(3)}%] ${p.phaseLabel}` +
          (p.provider ? `  (${p.provider})` : "")
      );
    }
  };

  const startedAt = Date.now();
  const result = await runPipeline({
    jobId: `verify-${Date.now()}`,
    userId: "verify",
    searchId: null,
    criteria: { industry: null, limit },
    roleKeys: ["ceo", "founder"],
    providerIds: ["scraper:ycombinator"],
    enrichCompanies: enrich,
    signal: new AbortController().signal,
    onProgress,
  });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== Result (${seconds}s) ===`);
  console.log(`companies:        ${result.companies.length}`);
  console.log(`duplicates:       ${result.duplicatesRemoved}`);
  console.log(`degraded:         ${result.degradedProviders.join(", ") || "none"}`);

  let peopleTotal = 0;
  let contactTotal = 0;

  for (const entry of result.companies) {
    peopleTotal += entry.people.length;
    contactTotal += entry.people.filter((p) => p.contact).length;

    console.log(`\n--- ${entry.profile.name} ---`);
    console.log(`  domain:      ${entry.profile.domain ?? "(none)"}`);
    console.log(`  website:     ${entry.profile.websiteUrl ?? "(none)"}`);
    console.log(`  industry:    ${entry.profile.industry ?? "(none)"}`);
    console.log(`  country:     ${entry.profile.country ?? "(none)"}`);
    console.log(`  teamSize:    ${entry.profile.teamSize ?? "(none)"}`);
    console.log(`  batch:       ${entry.profile.batch ?? "(none)"}`);
    console.log(`  investors:   ${(entry.profile.investors ?? []).join(", ") || "(none)"}`);
    console.log(`  description: ${(entry.profile.description ?? "").slice(0, 80)}`);
    console.log(`  dedupKey:    ${entry.dedupKey ?? "(none)"}`);
    console.log(`  confidence:  ${entry.confidence.toFixed(2)}`);
    console.log(`  people:      ${entry.people.length}`);

    for (const slot of entry.people) {
      console.log(
        `    - ${slot.person.fullName} | ${slot.person.title ?? "?"} | ` +
          `matched=${slot.person.titleMatched} | conf=${slot.confidence.toFixed(2)}`
      );
      if (slot.contact) {
        console.log(
          `        email=${slot.contact.email ?? "-"} guessed=${slot.contact.emailIsGuessed ?? false} ` +
            `linkedin=${slot.contact.linkedinUrl ? "yes" : "-"} phone=${slot.contact.phone ?? "-"}`
        );
      }
    }
  }

  console.log("\n=== Totals ===");
  console.log(`people found:   ${peopleTotal}`);
  console.log(`contacts found: ${contactTotal}`);

  // Discovery is the phase everything else depends on; treat zero as a failure.
  if (result.companies.length === 0) {
    console.error("\nFAIL: no companies discovered.");
    return 1;
  }
  console.log("\nPASS: companies discovered through the provider pipeline.");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("\nFATAL:", error);
    process.exit(1);
  });
