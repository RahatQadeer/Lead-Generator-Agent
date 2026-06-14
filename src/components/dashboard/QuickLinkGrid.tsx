import Link from "next/link";
import {
  metricAccentStyles,
  metricGlowClassName,
  type MetricAccent,
} from "@/components/dashboard/metric-accent";
import type { LucideIcon } from "lucide-react";

export interface QuickLinkItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: MetricAccent;
}

interface QuickLinkGridProps {
  links: QuickLinkItem[];
}

export function QuickLinkGrid({ links }: QuickLinkGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {links.map((link) => {
        const Icon = link.icon;
        const accent = metricAccentStyles[link.accent];

        return (
          <Link
            key={link.href}
            href={link.href}
            className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[border-color,box-shadow] duration-200 hover:border-gray-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.06)]"
          >
            <div
              className={`${metricGlowClassName} h-12 ${accent.glow}`}
              aria-hidden
            />

            <div className="relative">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${accent.icon}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </div>

              <p className="mt-2 text-sm font-semibold leading-tight text-gray-900 transition-colors group-hover:text-violet-900">
                {link.label}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-500">
                {link.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
