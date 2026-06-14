import Image from "next/image";
import Link from "next/link";

const LOGO_SRC = "/lead-generation-logo.png";
const BRAND_NAME = "Lead Generation";

interface BrandMarkProps {
  href?: string;
  size?: "sm" | "md";
  className?: string;
}

export function BrandMark({
  href = "/dashboard",
  size = "md",
  className = "",
}: BrandMarkProps) {
  const logoSize = size === "sm" ? 32 : 36;
  const nameClass =
    size === "sm"
      ? "text-sm font-bold tracking-[-0.02em] text-gray-950"
      : "text-[0.9375rem] font-bold tracking-[-0.02em] text-gray-950";

  const content = (
    <>
      <Image
        src={LOGO_SRC}
        alt=""
        width={logoSize}
        height={logoSize}
        className="h-8 w-8 shrink-0 rounded-lg object-contain sm:h-9 sm:w-9"
        priority
      />
      <div className="min-w-0">
        <p className={nameClass}>{BRAND_NAME}</p>
      </div>
    </>
  );

  const baseClass = `flex min-w-0 items-center gap-2.5 ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={`${baseClass} transition-opacity hover:opacity-90`}>
        {content}
      </Link>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
