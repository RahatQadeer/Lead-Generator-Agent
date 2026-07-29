"use client";

/** Consistent card + heading for every builder section. */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SectionShellProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Rendered on the right of the header — counts, badges, actions. */
  aside?: ReactNode;
  children: ReactNode;
}

export function SectionShell({
  icon: Icon,
  title,
  description,
  aside,
  children,
}: SectionShellProps) {
  return (
    <section
      aria-labelledby={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-gray-800 dark:bg-gray-900"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <Icon className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>
        {aside}
      </header>

      <div className="space-y-4">{children}</div>
    </section>
  );
}
