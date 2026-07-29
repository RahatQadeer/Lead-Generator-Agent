import { describe, expect, it } from "vitest";
import { parsePipelineRunRequest } from "@/lib/pipeline/parse-run-request";

function ok(body: unknown) {
  const result = parsePipelineRunRequest(body);
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.value;
}

function err(body: unknown): string {
  const result = parsePipelineRunRequest(body);
  if (result.ok) throw new Error("expected an error");
  return result.error;
}

describe("pipeline run request validation", () => {
  it("accepts a minimal body and defaults enrichment on", () => {
    const value = ok({});
    expect(value.searchId).toBeNull();
    expect(value.roleKeys).toEqual([]);
    expect(value.providerIds).toEqual([]);
    expect(value.enrichCompanies).toBe(true);
    expect(value.criteria.limit).toBe(0);
  });

  it("rejects an unknown decision-maker role", () => {
    expect(err({ roleKeys: ["ceo", "chief-vibes-officer"] })).toContain(
      "chief-vibes-officer"
    );
  });

  it("accepts ladder keys", () => {
    expect(ok({ roleKeys: ["founder", "ceo", "cto"] }).roleKeys).toEqual([
      "founder",
      "ceo",
      "cto",
    ]);
  });

  it("rejects an unknown funding stage", () => {
    expect(err({ fundingStages: ["seed", "series_z"] })).toContain("series_z");
  });

  it("rejects an inverted company size range", () => {
    expect(err({ companySizeMin: 500, companySizeMax: 10 })).toContain(
      "cannot be greater than"
    );
  });

  it("rejects negative sizes", () => {
    expect(err({ companySizeMin: -5 })).toContain("negative");
  });

  it("bounds the recency filter", () => {
    expect(err({ fundedWithinMonths: 0 })).toContain("between 1 and 120");
    expect(err({ fundedWithinMonths: 999 })).toContain("between 1 and 120");
    expect(ok({ fundedWithinMonths: 6 }).criteria.fundedWithinMonths).toBe(6);
  });

  it("clamps an oversized limit rather than rejecting it", () => {
    // Asking for 10_000 means "as many as possible", not "fail my request".
    expect(ok({ limit: 10_000 }).criteria.limit).toBe(500);
  });

  it("treats limit 0 as unlimited", () => {
    expect(ok({ limit: 0 }).criteria.limit).toBe(0);
  });

  it("strips blanks and non-strings from array filters", () => {
    const value = ok({
      countries: ["United States", "  ", 42, "Germany", null],
      keywords: ["ai", ""],
    });
    expect(value.criteria.countries).toEqual(["United States", "Germany"]);
    expect(value.criteria.keywords).toEqual(["ai"]);
  });

  it("rejects a non-object body", () => {
    expect(err("nope")).toContain("must be an object");
    expect(err(null)).toContain("must be an object");
  });

  it("honours an explicit enrichment opt-out", () => {
    expect(ok({ enrichCompanies: false }).enrichCompanies).toBe(false);
  });
});
