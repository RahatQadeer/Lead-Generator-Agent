import Link from "next/link";
import type { TopLeadMetric } from "@/types/dashboard";

interface TopLeadsRankedProps {
  leads: TopLeadMetric[];
}

export function TopLeadsRanked({ leads }: TopLeadsRankedProps) {
  if (leads.length === 0) return null;

  return (
    <ul className="divide-y divide-gray-100">
      {leads.map((lead, index) => (
        <li key={lead.id}>
          <Link
            href="/leads"
            className="group flex items-center gap-3 py-3.5 transition-colors hover:bg-gray-50/80"
          >
            <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 group-hover:text-violet-900">
                {lead.name}
              </p>
              <p className="truncate text-xs text-gray-500">
                {lead.role} · {lead.company}
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-700">
              {lead.score}/10
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
