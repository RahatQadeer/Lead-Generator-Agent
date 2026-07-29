import { describe, expect, it } from "vitest";
import { detectFundingStage, fundingStageLabel } from "@/lib/scraping/funding-stage";

describe("detectFundingStage", () => {
  it("reads the stage a company states about itself", () => {
    expect(detectFundingStage("We raised a $12M Series A led by Accel.")).toBe("series_a");
    expect(detectFundingStage("Fresh off our Series B, we're hiring.")).toBe("series_b");
    expect(detectFundingStage("Announcing our seed round of $3M")).toBe("seed");
    expect(detectFundingStage("We closed a pre-seed round")).toBe("pre_seed");
    expect(detectFundingStage("Listed on NASDAQ since 2019")).toBe("public");
    expect(detectFundingStage("Acquired by Salesforce in 2021")).toBe("acquired");
    expect(detectFundingStage("We are bootstrapped and profitable since 2018")).toBe(
      "bootstrapped"
    );
  });

  it("takes the latest round when several are mentioned", () => {
    expect(
      detectFundingStage("Backed by Y Combinator. Raised seed funding and later a Series C.")
    ).toBe("series_c");
  });

  it("returns null when there is no funding signal", () => {
    // Null means unknown, never "bootstrapped" — most funded startups say nothing.
    expect(detectFundingStage("We build software for hospitals.")).toBeNull();
    expect(detectFundingStage("")).toBeNull();
    expect(detectFundingStage(null)).toBeNull();
  });

  it("does not mistake unrelated 'series' text for a round", () => {
    expect(detectFundingStage("Series 7 exam prep")).toBeNull();
  });

  it("labels stages for output", () => {
    expect(fundingStageLabel("series_a")).toBe("Series A");
    expect(fundingStageLabel("pre_seed")).toBe("Pre-seed");
    expect(fundingStageLabel(null)).toBeNull();
  });
});
