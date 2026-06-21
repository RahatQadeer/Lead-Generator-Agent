import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sequencedItemClassName } from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

export interface SequencedMetaRow {
  icon: LucideIcon;
  text: string;
}

interface SequencedItemCardProps {
  href: string;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  meta?: SequencedMetaRow[];
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
}

export function SequencedItemCard({
  href,
  icon: Icon,
  iconClassName = "bg-gray-100 text-gray-500",
  title,
  subtitle,
  meta = [],
  trailing,
  footer,
}: SequencedItemCardProps) {
  return (
    <Link href={href} className={`group ${sequencedItemClassName}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-[-0.01em] text-gray-900 group-hover:text-violet-900">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
        {trailing ?? (
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-gray-500" />
        )}
      </div>

      {meta.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
          {meta.map((row) => {
            const MetaIcon = row.icon;
            return (
              <div
                key={row.text}
                className="flex items-center gap-2 text-xs text-gray-500"
              >
                <MetaIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="truncate">{row.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {footer && (
        <div className="mt-4 flex justify-center border-t border-gray-100 pt-3">
          {footer}
        </div>
      )}
    </Link>
  );
}
