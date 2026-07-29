/**
 * The pipeline progress contract.
 *
 * One event shape for every phase, so the SSE route, the BullMQ worker and the
 * UI panel all read the same fields and a new phase does not require touching
 * any of them.
 *
 * Progress is reported as a SNAPSHOT, not a delta. A browser that reconnects
 * mid-run, or a worker whose events are polled from the job row rather than
 * streamed, gets a complete picture from whatever event it happens to see
 * first — deltas would leave a reconnecting client permanently mis-counted.
 */

export type PipelinePhase =
  | "starting"
  | "company_discovery"
  | "company_enrichment"
  | "people_discovery"
  | "contact_discovery"
  | "funding_discovery"
  | "deduplication"
  | "scoring"
  | "saving"
  | "completed"
  | "failed"
  | "stopped";

/**
 * Share of the progress bar each phase owns.
 *
 * Weighted by observed wall-clock, not by step count: company discovery and
 * contact discovery dominate a real run because both are network-bound per
 * item, while dedup and scoring are in-memory and effectively instant. Equal
 * weights would park the bar at 60% for minutes and then jump to 100%.
 */
const PHASE_WEIGHTS: Record<PipelinePhase, number> = {
  starting: 0,
  company_discovery: 30,
  company_enrichment: 15,
  people_discovery: 25,
  contact_discovery: 22,
  funding_discovery: 3,
  deduplication: 1,
  scoring: 1,
  saving: 3,
  completed: 0,
  failed: 0,
  stopped: 0,
};

const PHASE_ORDER: PipelinePhase[] = [
  "starting",
  "company_discovery",
  "company_enrichment",
  "people_discovery",
  "contact_discovery",
  "funding_discovery",
  "deduplication",
  "scoring",
  "saving",
];

export const PHASE_LABELS: Record<PipelinePhase, string> = {
  starting: "Starting search…",
  company_discovery: "Finding companies…",
  company_enrichment: "Enriching companies…",
  people_discovery: "Finding decision makers…",
  contact_discovery: "Finding contact details…",
  funding_discovery: "Checking funding…",
  deduplication: "Removing duplicates…",
  scoring: "Scoring leads…",
  saving: "Saving results…",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

export interface PipelineCounts {
  companiesFound: number;
  companiesEnriched: number;
  peopleFound: number;
  contactsFound: number;
  fundingEventsFound: number;
  duplicatesRemoved: number;
  saved: number;
}

export interface PipelineErrorEntry {
  phase: PipelinePhase;
  provider: string | null;
  message: string;
  /** ISO timestamp. */
  at: string;
}

/** A complete snapshot of a run. */
export interface PipelineProgress {
  jobId: string;
  phase: PipelinePhase;
  phaseLabel: string;
  /** Provider currently doing work, e.g. "scraper:ycombinator". */
  provider: string | null;
  /** Company currently being processed. */
  company: string | null;
  counts: PipelineCounts;
  /** 0–100. Monotonic — never goes backwards within a run. */
  percent: number;
  /** Total retry attempts across all providers so far. */
  retries: number;
  /** Most recent errors, newest last. Capped; see MAX_TRACKED_ERRORS. */
  errors: PipelineErrorEntry[];
  startedAt: string;
  updatedAt: string;
}

export type PipelineProgressListener = (progress: PipelineProgress) => void;

/**
 * Keeps a bounded error list. A run against 500 companies where one provider is
 * down would otherwise accumulate 500 identical entries, and this object is
 * serialized into the job row on every update.
 */
const MAX_TRACKED_ERRORS = 25;

export function emptyCounts(): PipelineCounts {
  return {
    companiesFound: 0,
    companiesEnriched: 0,
    peopleFound: 0,
    contactsFound: 0,
    fundingEventsFound: 0,
    duplicatesRemoved: 0,
    saved: 0,
  };
}

/**
 * Accumulates run state and emits a snapshot on every change.
 *
 * Phases report a 0–1 fraction of their own completion; the tracker converts
 * that into an overall percentage using the weights above, so no phase needs to
 * know where it sits in the sequence.
 */
export class ProgressTracker {
  private phase: PipelinePhase = "starting";
  private provider: string | null = null;
  private company: string | null = null;
  private phaseFraction = 0;
  private percentFloor = 0;
  private retries = 0;
  private readonly errors: PipelineErrorEntry[] = [];
  private readonly counts: PipelineCounts = emptyCounts();
  private readonly startedAt = new Date().toISOString();

  constructor(
    private readonly jobId: string,
    private readonly listener?: PipelineProgressListener
  ) {}

  /** Enter a phase. Resets the within-phase fraction. */
  setPhase(phase: PipelinePhase, provider: string | null = null): void {
    this.phase = phase;
    this.provider = provider;
    this.company = null;
    this.phaseFraction = 0;
    this.emit();
  }

  setProvider(provider: string | null): void {
    this.provider = provider;
    this.emit();
  }

  setCompany(company: string | null): void {
    this.company = company;
    this.emit();
  }

  /** Report progress within the current phase as a 0–1 fraction. */
  setPhaseFraction(fraction: number): void {
    this.phaseFraction = Math.min(1, Math.max(0, fraction));
    this.emit();
  }

  /** Convenience for "item i of n" within a phase. */
  setPhaseStep(current: number, total: number): void {
    this.setPhaseFraction(total > 0 ? current / total : 0);
  }

  increment(key: keyof PipelineCounts, by = 1): void {
    this.counts[key] += by;
    this.emit();
  }

  recordRetry(): void {
    this.retries += 1;
  }

  recordError(message: string, provider: string | null = null): void {
    this.errors.push({
      phase: this.phase,
      provider,
      message,
      at: new Date().toISOString(),
    });
    if (this.errors.length > MAX_TRACKED_ERRORS) this.errors.shift();
    this.emit();
  }

  /** Terminal state. Percent is forced to 100 only on success. */
  finish(phase: "completed" | "failed" | "stopped"): void {
    this.phase = phase;
    this.provider = null;
    this.company = null;
    if (phase === "completed") this.percentFloor = 100;
    this.emit();
  }

  snapshot(): PipelineProgress {
    return {
      jobId: this.jobId,
      phase: this.phase,
      phaseLabel: PHASE_LABELS[this.phase],
      provider: this.provider,
      company: this.company,
      counts: { ...this.counts },
      percent: this.computePercent(),
      retries: this.retries,
      errors: [...this.errors],
      startedAt: this.startedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  private computePercent(): number {
    if (this.phase === "completed") return 100;

    const index = PHASE_ORDER.indexOf(this.phase);
    if (index < 0) {
      // failed / stopped — hold wherever the run got to rather than snapping to
      // 0 or 100, which would misreport how much work was actually done.
      return this.percentFloor;
    }

    const before = PHASE_ORDER.slice(0, index).reduce(
      (sum, p) => sum + PHASE_WEIGHTS[p],
      0
    );
    const raw = before + PHASE_WEIGHTS[this.phase] * this.phaseFraction;
    const percent = Math.min(99, Math.round(raw));

    // Monotonic: a phase that revises its total downwards (discovery finding
    // fewer companies than the first source suggested) must not rewind the bar.
    this.percentFloor = Math.max(this.percentFloor, percent);
    return this.percentFloor;
  }

  private emit(): void {
    this.listener?.(this.snapshot());
  }
}
