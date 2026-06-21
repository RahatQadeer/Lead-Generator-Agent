import { getEmailMetrics } from "@/lib/dashboard/email-metrics";
import { getLeadMetrics } from "@/lib/dashboard/lead-metrics";
import { createClient } from "@/lib/supabase/server";
import type {
  ConversionFunnelStage,
  ConversionMetrics,
  ConversionRateMetric,
} from "@/types/dashboard";

function calcRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function buildFunnel(
  discovered: number,
  enriched: number,
  contacted: number,
  replied: number
): ConversionFunnelStage[] {
  const stages = [
    { key: "discovered", label: "Discovered", count: discovered },
    { key: "enriched", label: "Enriched", count: enriched },
    { key: "contacted", label: "Contacted", count: contacted },
    { key: "replied", label: "Replied", count: replied },
  ];

  return stages.map((stage, index) => {
    const previous = index > 0 ? stages[index - 1].count : null;
    return {
      ...stage,
      rateFromPrevious:
        previous !== null ? calcRate(stage.count, previous) : null,
      rateFromStart: calcRate(stage.count, discovered),
    };
  });
}

function buildRates(input: {
  discovered: number;
  enriched: number;
  contacted: number;
  repliedContacts: number;
  emailsSent: number;
  emailsReplied: number;
}): ConversionRateMetric[] {
  return [
    {
      key: "enrich",
      label: "Enrich rate",
      value: calcRate(input.enriched, input.discovered),
      description: "Enriched ÷ discovered leads",
    },
    {
      key: "outreach",
      label: "Outreach rate",
      value: calcRate(input.contacted, input.enriched),
      description: "Contacted ÷ enriched leads",
    },
    {
      key: "email-reply",
      label: "Email reply rate",
      value: calcRate(input.emailsReplied, input.emailsSent),
      description: "Replies ÷ emails sent",
    },
    {
      key: "contact-reply",
      label: "Contact reply rate",
      value: calcRate(input.repliedContacts, input.contacted),
      description: "Replied contacts ÷ contacted",
    },
    {
      key: "overall",
      label: "End-to-end",
      value: calcRate(input.repliedContacts, input.discovered),
      description: "Replied contacts ÷ discovered",
    },
  ];
}

async function getContactOutreachCounts(userId: string): Promise<{
  contactedCount: number;
  repliedContactCount: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_emails")
    .select("contact_id, status, reply_status")
    .eq("user_id", userId);

  if (error || !data) {
    return { contactedCount: 0, repliedContactCount: 0 };
  }

  const contacted = new Set<string>();
  const replied = new Set<string>();

  for (const row of data) {
    if (row.status === "sent") {
      contacted.add(row.contact_id);
    }
    if (row.reply_status === "replied") {
      replied.add(row.contact_id);
    }
  }

  return {
    contactedCount: contacted.size,
    repliedContactCount: replied.size,
  };
}

export async function getConversionMetrics(
  userId: string
): Promise<ConversionMetrics> {
  const [leadMetrics, emailMetrics, contactCounts] = await Promise.all([
    getLeadMetrics(userId),
    getEmailMetrics(userId),
    getContactOutreachCounts(userId),
  ]);

  const discovered = leadMetrics.discoveredCount;
  const enriched = leadMetrics.enrichedCount;
  const contacted = contactCounts.contactedCount;
  const repliedContacts = contactCounts.repliedContactCount;

  return {
    discoveredCount: discovered,
    enrichedCount: enriched,
    contactedCount: contacted,
    repliedContactCount: repliedContacts,
    emailsSent: emailMetrics.sentCount,
    emailsReplied: emailMetrics.repliedCount,
    funnel: buildFunnel(discovered, enriched, contacted, repliedContacts),
    rates: buildRates({
      discovered,
      enriched,
      contacted,
      repliedContacts,
      emailsSent: emailMetrics.sentCount,
      emailsReplied: emailMetrics.repliedCount,
    }),
  };
}
