"use client";

import { useState } from "react";
import { BarChart3, FileText, X } from "lucide-react";
import { EmailTemplatesSettingsCard } from "@/components/settings/EmailTemplatesSettingsCard";
import { IntegrationTile } from "@/components/settings/IntegrationTile";
import { LeadScoringSettingsCard } from "@/components/settings/LeadScoringSettingsCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { btnIconClassName } from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

type OutreachId = "lead-scoring" | "email-templates";

interface OutreachConfig {
  id: OutreachId;
  name: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
}

const OUTREACH_OPTIONS: OutreachConfig[] = [
  {
    id: "lead-scoring",
    name: "Lead scoring",
    description:
      "Tune how industry, size, location, role, and tech signals combine into each lead score.",
    icon: BarChart3,
    iconClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
  },
  {
    id: "email-templates",
    name: "Email templates",
    description:
      "Craft reusable subject and body patterns with placeholders for personalized outreach.",
    icon: FileText,
    iconClassName: "bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100",
  },
];

function OutreachPanel({ id }: { id: OutreachId }) {
  switch (id) {
    case "lead-scoring":
      return <LeadScoringSettingsCard embedded />;
    case "email-templates":
      return <EmailTemplatesSettingsCard embedded />;
  }
}

export function OutreachHub() {
  const [activeId, setActiveId] = useState<OutreachId | null>(null);
  const active = OUTREACH_OPTIONS.find((item) => item.id === activeId);

  return (
    <div
      className={`grid items-start gap-6 ${
        activeId
          ? "lg:grid-cols-[1fr_min(100%,520px)] xl:grid-cols-[1fr_520px]"
          : ""
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div
          className={`grid divide-gray-200 ${
            activeId
              ? "grid-cols-1 divide-y"
              : "grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0"
          }`}
        >
          {OUTREACH_OPTIONS.map((option) => (
            <IntegrationTile
              key={option.id}
              name={option.name}
              description={option.description}
              icon={option.icon}
              iconClassName={option.iconClassName}
              selected={activeId === option.id}
              onManage={() => setActiveId(option.id)}
            />
          ))}
        </div>
      </div>

      {active && (
        <SectionCard
          title={active.name}
          padContent={false}
          className="overflow-hidden lg:sticky lg:top-24"
          action={
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className={btnIconClassName}
              aria-label="Close outreach settings"
            >
              <X className="h-4 w-4" />
            </button>
          }
        >
          <div className="border-t border-gray-100 p-5 sm:p-6">
            <OutreachPanel id={active.id} />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
