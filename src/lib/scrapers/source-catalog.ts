import type { ScraperSourceId } from "@/lib/scrapers/types";

/**
 * How each scraper source is classified. Discovery targets ONLY venture-backed
 * sources (accelerator / vc-portfolio / startup-directory). General directories
 * remain registered but are excluded from company discovery.
 */
export type SourceCategory =
  | "accelerator"
  | "vc-portfolio"
  | "startup-directory"
  | "general-directory";

export interface SourceCatalogEntry {
  category: SourceCategory;
  /** Investors/backers inherent to the source (portfolio ⇒ the firm; accelerator ⇒ the program). */
  backers: string[];
}

export const SOURCE_CATALOG: Record<ScraperSourceId, SourceCatalogEntry> = {
  // ── Accelerators / incubators (the program is the backer) ──────────────────
  ycombinator: { category: "accelerator", backers: ["Y Combinator"] },
  techstars: { category: "accelerator", backers: ["Techstars"] },
  "500global": { category: "accelerator", backers: ["500 Global"] },
  antler: { category: "accelerator", backers: ["Antler"] },

  // ── Startup / investor directories (aggregate many backers) ────────────────
  f6s: { category: "startup-directory", backers: [] },
  openvc: { category: "startup-directory", backers: [] },
  seedtable: { category: "startup-directory", backers: [] },

  // ── Venture-capital firm portfolios (the firm is the investor) ─────────────
  "sequoia-portfolio": { category: "vc-portfolio", backers: ["Sequoia Capital"] },
  "a16z-portfolio": { category: "vc-portfolio", backers: ["Andreessen Horowitz"] },
  "accel-portfolio": { category: "vc-portfolio", backers: ["Accel"] },
  "lightspeed-portfolio": {
    category: "vc-portfolio",
    backers: ["Lightspeed Venture Partners"],
  },
  "general-catalyst-portfolio": {
    category: "vc-portfolio",
    backers: ["General Catalyst"],
  },
  "bessemer-portfolio": {
    category: "vc-portfolio",
    backers: ["Bessemer Venture Partners"],
  },
  "index-ventures-portfolio": { category: "vc-portfolio", backers: ["Index Ventures"] },

  // ── General directories — NOT venture-backed, excluded from discovery ──────
  producthunt: { category: "general-directory", backers: [] },
  betalist: { category: "general-directory", backers: [] },
  indiehackers: { category: "general-directory", backers: [] },
  startupranking: { category: "general-directory", backers: [] },
  saashub: { category: "general-directory", backers: [] },
  "github-organizations": { category: "general-directory", backers: [] },
};

/** True when the source lists funded / venture-backed startups (not a general directory). */
export function isVentureBackedSource(source: ScraperSourceId): boolean {
  return SOURCE_CATALOG[source]?.category !== "general-directory";
}

/** Investors/backers to stamp on every company from a source (may be empty). */
export function getSourceBackers(source: ScraperSourceId): string[] {
  return SOURCE_CATALOG[source]?.backers ?? [];
}

/**
 * How a source is classified. Unknown ids fall back to "startup-directory":
 * it makes no claim about a backer and keeps the source inside venture-backed
 * discovery, which is the safe default for a newly registered directory.
 */
export function getSourceCategory(source: ScraperSourceId): SourceCategory {
  return SOURCE_CATALOG[source]?.category ?? "startup-directory";
}

/** All venture-backed source ids (accelerators + vc portfolios + startup directories). */
export function listVentureBackedSources(): ScraperSourceId[] {
  return (Object.keys(SOURCE_CATALOG) as ScraperSourceId[]).filter(
    isVentureBackedSource
  );
}
