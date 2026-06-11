import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import type { DashboardOnboardingStep } from "@/types/dashboard";

interface DashboardGettingStartedProps {
  steps: DashboardOnboardingStep[];
}

export function DashboardGettingStarted({ steps }: DashboardGettingStartedProps) {
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  return (
    <DashboardSection
      title={allDone ? "You're all set" : "Getting started"}
      description={
        allDone
          ? "Your pipeline is active. Monitor replies and analytics to optimize outreach."
          : "Define target companies, discover decision-makers, and launch AI-personalized outreach — all from this platform."
      }
    >
      <div className="flex flex-wrap gap-3">
        {steps.map((item) => (
          <Link
            key={item.step}
            href={item.href}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
              item.done
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:border-cyan-500/50"
                : "border-white/5 bg-white/5 text-slate-400 hover:border-white/10 hover:text-white"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                item.done ? "bg-cyan-500 text-white" : "bg-white/10 text-slate-500"
              }`}
            >
              {item.step}
            </span>
            {item.label}
            {!item.done && <ArrowRight className="h-3.5 w-3.5 opacity-60" />}
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        {completedCount} of {steps.length} steps complete
      </p>
    </DashboardSection>
  );
}
