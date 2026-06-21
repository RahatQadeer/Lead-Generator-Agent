import { createClient } from "@/lib/supabase/server";
import type { LeadMetrics, LeadScoreBucket, TopLeadMetric } from "@/types/dashboard";

type ContactMetricRow = {
  id: string;
  full_name: string;
  title: string;
  company_name: string | null;
  enriched_at: string | null;
  lead_score: number | null;
  email: string | null;
  email_verification_status: string | null;
  follow_ups_paused: boolean;
};

const SCORE_BUCKETS: Array<{
  label: string;
  range: string;
  min: number;
  max: number;
  color: LeadScoreBucket["color"];
}> = [
  { label: "Low", range: "1–3", min: 1, max: 3, color: "red" },
  { label: "Fair", range: "4–5", min: 4, max: 5, color: "amber" },
  { label: "Good", range: "6–7", min: 6, max: 7, color: "cyan" },
  { label: "Hot", range: "8–10", min: 8, max: 10, color: "emerald" },
];

function buildScoreBuckets(scores: number[]): LeadScoreBucket[] {
  return SCORE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    range: bucket.range,
    color: bucket.color,
    count: scores.filter((s) => s >= bucket.min && s <= bucket.max).length,
  }));
}

export async function getLeadMetrics(userId: string): Promise<LeadMetrics> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, full_name, title, company_name, enriched_at, lead_score, email, email_verification_status, follow_ups_paused"
    )
    .eq("user_id", userId);

  if (error || !data) {
    return emptyLeadMetrics();
  }

  const contacts = data as ContactMetricRow[];
  const enriched = contacts.filter((c) => c.enriched_at);
  const scored = contacts.filter((c) => c.lead_score !== null);
  const scores = scored.map((c) => c.lead_score as number);
  const withEmail = contacts.filter((c) => Boolean(c.email));
  const verified = contacts.filter(
    (c) => c.email_verification_status === "valid"
  );
  const highQuality = scored.filter((c) => (c.lead_score as number) >= 8);
  const paused = contacts.filter((c) => c.follow_ups_paused);

  const averageScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10
        ) / 10
      : null;

  const topLeads: TopLeadMetric[] = [...scored]
    .sort((a, b) => (b.lead_score as number) - (a.lead_score as number))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.full_name,
      role: c.title,
      company: c.company_name ?? "Unknown",
      score: c.lead_score as number,
    }));

  return {
    discoveredCount: contacts.length,
    enrichedCount: enriched.length,
    scoredCount: scored.length,
    withEmailCount: withEmail.length,
    verifiedCount: verified.length,
    averageScore,
    highQualityCount: highQuality.length,
    pausedCount: paused.length,
    scoreBuckets: buildScoreBuckets(scores),
    topLeads,
  };
}

function emptyLeadMetrics(): LeadMetrics {
  return {
    discoveredCount: 0,
    enrichedCount: 0,
    scoredCount: 0,
    withEmailCount: 0,
    verifiedCount: 0,
    averageScore: null,
    highQualityCount: 0,
    pausedCount: 0,
    scoreBuckets: SCORE_BUCKETS.map((b) => ({
      label: b.label,
      range: b.range,
      color: b.color,
      count: 0,
    })),
    topLeads: [],
  };
}
