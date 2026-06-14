import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Mail,
  Rocket,
  Search,
  Users,
} from "lucide-react";
import { DashboardPanelShell } from "@/components/dashboard/DashboardPanelShell";
import { textSecondaryClassName } from "@/lib/ui/styles";
import type { DashboardOnboardingStep } from "@/types/dashboard";
import type { LucideIcon } from "lucide-react";

interface DashboardGettingStartedProps {
  steps: DashboardOnboardingStep[];
}

const stepIcons: Record<number, LucideIcon> = {
  1: Search,
  2: Search,
  3: Users,
  4: Mail,
};

const NEXT_ACTIONS = [
  { href: "/searches", label: "Searches", icon: Search },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/emails", label: "Emails", icon: Mail },
] as const;

function stepShortLabel(label: string): string {
  if (label.startsWith("Define")) return "Search criteria";
  if (label.startsWith("Discover")) return "Discovery";
  if (label.startsWith("Find")) return "Leads";
  if (label.startsWith("Send")) return "Outreach";
  return label;
}

function AllSetView({ steps }: { steps: DashboardOnboardingStep[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/70 to-white">
      <div className="flex items-start gap-3 p-4 sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-[0_1px_2px_rgba(16,185,129,0.15)]">
          <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-gray-900">
            Your pipeline is live
          </p>
          <p className={`mt-1 text-xs leading-relaxed ${textSecondaryClassName}`}>
            All {steps.length} setup steps are done. Focus on leads, outreach,
            and replies from here.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-emerald-100/80 bg-white/50 px-4 py-3">
        {steps.map((item) => (
          <span
            key={item.step}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-gray-100"
          >
            <Check className="h-3 w-3 shrink-0 text-emerald-500" />
            {stepShortLabel(item.label)}
          </span>
        ))}
      </div>

      <div className="border-t border-emerald-100/80 px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Keep going
        </p>
        <div className="flex flex-wrap gap-2">
          {NEXT_ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[border-color,box-shadow] duration-200 hover:border-gray-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
            >
              <Icon className="h-3.5 w-3.5 text-gray-400 group-hover:text-violet-600" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function GettingStartedStepper({ steps }: { steps: DashboardOnboardingStep[] }) {
  const completedCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);
  const nextIndex = steps.findIndex((s) => !s.done);

  return (
    <div>
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-gray-500">Setup progress</span>
          <span className="tabular-nums text-gray-600">
            {completedCount}/{steps.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <ol className="space-y-2">
        {steps.map((item, index) => {
          const isNext = index === nextIndex;
          const StepIcon = stepIcons[item.step] ?? Rocket;

          return (
            <li key={item.step}>
              <Link
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-[border-color,background-color,box-shadow] duration-200 ${
                  isNext
                    ? "border-violet-200 bg-violet-50/50 shadow-[0_1px_3px_rgba(139,92,246,0.08)] hover:border-violet-300"
                    : item.done
                      ? "border-gray-100 bg-gray-50/60 hover:bg-gray-50"
                      : "border-gray-100 bg-white opacity-80 hover:opacity-100"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    item.done
                      ? "bg-gray-900 text-white"
                      : isNext
                        ? "bg-violet-600 text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {item.done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    item.step
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      isNext ? "text-violet-900" : "text-gray-900"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {item.done
                      ? "Completed"
                      : isNext
                        ? "Up next — tap to continue"
                        : "Waiting on earlier steps"}
                  </p>
                </div>

                <StepIcon
                  className={`h-4 w-4 shrink-0 ${
                    isNext
                      ? "text-violet-400"
                      : item.done
                        ? "text-gray-300"
                        : "text-gray-300"
                  }`}
                  strokeWidth={1.75}
                />

                {isNext && (
                  <ArrowRight className="h-4 w-4 shrink-0 text-violet-400 transition-transform duration-200 group-hover:translate-x-0.5" />
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function DashboardGettingStarted({
  steps,
}: DashboardGettingStartedProps) {
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  return (
    <DashboardPanelShell
      icon={allDone ? CheckCircle2 : Rocket}
      title={allDone ? "You're all set" : "Getting started"}
    >
      {allDone ? (
        <AllSetView steps={steps} />
      ) : (
        <GettingStartedStepper steps={steps} />
      )}
    </DashboardPanelShell>
  );
}
