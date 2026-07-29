import { describe, expect, it } from "vitest";
import {
  SOURCE_CATALOG,
  getSourceBackers,
  isVentureBackedSource,
  listVentureBackedSources,
} from "@/lib/scrapers/source-catalog";
import { SCRAPER_SOURCE_IDS } from "@/lib/scrapers/types";

describe("source catalog", () => {
  it("classifies every registered source", () => {
    for (const id of SCRAPER_SOURCE_IDS) {
      expect(SOURCE_CATALOG[id]).toBeDefined();
    }
  });

  it("marks VC portfolios and accelerators as venture-backed", () => {
    expect(isVentureBackedSource("ycombinator")).toBe(true);
    expect(isVentureBackedSource("techstars")).toBe(true);
    expect(isVentureBackedSource("a16z-portfolio")).toBe(true);
    expect(isVentureBackedSource("sequoia-portfolio")).toBe(true);
  });

  it("excludes general directories from venture-backed", () => {
    expect(isVentureBackedSource("github-organizations")).toBe(false);
    expect(isVentureBackedSource("producthunt")).toBe(false);
    expect(isVentureBackedSource("betalist")).toBe(false);
    expect(listVentureBackedSources()).not.toContain("github-organizations");
  });

  it("stamps the firm/program as the investor for portfolio & accelerator sources", () => {
    expect(getSourceBackers("a16z-portfolio")).toEqual(["Andreessen Horowitz"]);
    expect(getSourceBackers("sequoia-portfolio")).toEqual(["Sequoia Capital"]);
    expect(getSourceBackers("accel-portfolio")).toEqual(["Accel"]);
    expect(getSourceBackers("ycombinator")).toEqual(["Y Combinator"]);
    expect(getSourceBackers("techstars")).toEqual(["Techstars"]);
    expect(getSourceBackers("github-organizations")).toEqual([]);
  });

  it("covers all 14 requested venture-backed sources", () => {
    const venture = listVentureBackedSources();
    for (const id of [
      "ycombinator",
      "openvc",
      "seedtable",
      "f6s",
      "techstars",
      "500global",
      "antler",
      "sequoia-portfolio",
      "a16z-portfolio",
      "accel-portfolio",
      "lightspeed-portfolio",
      "general-catalyst-portfolio",
      "bessemer-portfolio",
      "index-ventures-portfolio",
    ] as const) {
      expect(venture).toContain(id);
    }
  });
});
