export type IntentSignalStrength = "high" | "medium" | "low";

export interface IntentSignal {
  id: string;
  label: string;
  strength: IntentSignalStrength;
  evidence: string;
}

export interface IntentAnalysis {
  /** 0–100 — higher means stronger buying intent. */
  score: number;
  signals: IntentSignal[];
}
