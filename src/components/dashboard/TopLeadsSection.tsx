"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TopLeadsRanked } from "@/components/dashboard/TopLeadsRanked";
import type { TopLeadMetric } from "@/types/dashboard";

const PREVIEW_COUNT = 3;

interface TopLeadsSectionProps {
  leads: TopLeadMetric[];
  previewCount?: number;
}

export function TopLeadsSection({
  leads,
  previewCount = PREVIEW_COUNT,
}: TopLeadsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const hasMore = leads.length > previewCount;
  const hiddenCount = Math.max(0, leads.length - previewCount);
  const visible =
    expanded || !hasMore ? leads : leads.slice(0, previewCount);

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Top leads
      </h3>
      <div className="mt-3">
        <TopLeadsRanked leads={visible} />
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900"
        >
          {expanded ? (
            <>
              Show less
              <ChevronDown className="h-4 w-4 rotate-180 transition-transform duration-200" />
            </>
          ) : (
            <>
              Show {hiddenCount} more
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
