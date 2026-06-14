"use client";

import { useState } from "react";
import { Bot, Mail, X } from "lucide-react";
import { GmailSettingsCard } from "@/components/settings/GmailSettingsCard";
import { IntegrationTile } from "@/components/settings/IntegrationTile";
import { OpenAISettingsCard } from "@/components/settings/OpenAISettingsCard";
import { OutlookSettingsCard } from "@/components/settings/OutlookSettingsCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { btnIconClassName } from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

type IntegrationId = "openai" | "gmail" | "outlook";

interface IntegrationConfig {
  id: IntegrationId;
  name: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    description:
      "Power AI-generated outreach emails and follow-ups with your preferred model and API key.",
    icon: Bot,
    iconClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
  },
  {
    id: "gmail",
    name: "Gmail",
    description:
      "Send outreach from your Gmail account and track replies through OAuth.",
    icon: Mail,
    iconClassName: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
  },
  {
    id: "outlook",
    name: "Outlook",
    description:
      "Deliver campaigns via Microsoft Outlook with Graph API mail permissions.",
    icon: Mail,
    iconClassName: "bg-sky-50 text-sky-600 ring-1 ring-sky-100",
  },
];

function IntegrationPanel({ id }: { id: IntegrationId }) {
  switch (id) {
    case "openai":
      return <OpenAISettingsCard embedded />;
    case "gmail":
      return <GmailSettingsCard embedded />;
    case "outlook":
      return <OutlookSettingsCard embedded />;
  }
}

export function IntegrationsHub() {
  const [activeId, setActiveId] = useState<IntegrationId | null>(null);
  const active = INTEGRATIONS.find((item) => item.id === activeId);

  return (
    <div
      className={`grid items-start gap-6 ${
        activeId
          ? "lg:grid-cols-[1fr_min(100%,440px)] xl:grid-cols-[1fr_440px]"
          : ""
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div
          className={`grid divide-gray-200 ${
            activeId
              ? "grid-cols-1 divide-y"
              : "grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y lg:grid-cols-3"
          }`}
        >
          {INTEGRATIONS.map((integration) => (
            <IntegrationTile
              key={integration.id}
              name={integration.name}
              description={integration.description}
              icon={integration.icon}
              iconClassName={integration.iconClassName}
              selected={activeId === integration.id}
              onManage={() => setActiveId(integration.id)}
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
              aria-label="Close integration settings"
            >
              <X className="h-4 w-4" />
            </button>
          }
        >
          <div className="border-t border-gray-100 p-5 sm:p-6">
            <IntegrationPanel id={active.id} />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
