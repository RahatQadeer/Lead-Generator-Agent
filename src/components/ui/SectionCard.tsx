import {
  cardClassName,
  cardPaddingClassName,
  headingSectionClassName,
  textSecondaryClassName,
} from "@/lib/ui/styles";

interface SectionCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** When false, only the header is padded; children manage their own padding. */
  padContent?: boolean;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
  padContent = true,
}: SectionCardProps) {
  return (
    <section className={`${cardClassName} ${className}`.trim()}>
      <div className={cardPaddingClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className={headingSectionClassName}>{title}</h2>
            {description && (
              <p className={`mt-1.5 max-w-2xl ${textSecondaryClassName}`}>
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {padContent && <div className="mt-6">{children}</div>}
      </div>
      {!padContent && children}
    </section>
  );
}
