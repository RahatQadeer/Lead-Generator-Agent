"use client";

import Image from "next/image";
import { Building2, Globe2, MapPin } from "lucide-react";
import { useEffect, useId } from "react";
import {
  btnPrimaryClassName,
  btnSecondaryClassName,
} from "@/lib/ui/styles";

interface PatienceDiscoveryModalProps {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}

const SOURCES = [
  { icon: Building2, label: "Directories" },
  { icon: MapPin, label: "Google Places" },
  { icon: Globe2, label: "Websites" },
] as const;

export function PatienceDiscoveryModal({
  open,
  onClose,
  onStart,
}: PatienceDiscoveryModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity"
        aria-label="Close"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-10 text-center shadow-[var(--shadow-elevated)]"
      >
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--color-accent-600)_22%,transparent)] bg-[var(--color-accent-50)] shadow-[var(--shadow-card)]">
          <Image
            src="/lead-generation-logo.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-xl object-contain"
            priority
          />
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {SOURCES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-secondary)]"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-600)]" strokeWidth={2} />
              {label}
            </span>
          ))}
        </div>

        <h2
          id={titleId}
          className="text-xl font-semibold tracking-tight text-[var(--color-ink)]"
        >
          Good things take a moment
        </h2>

        <p
          id={descriptionId}
          className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]"
        >
          We&apos;re searching directories, Google Places, and company websites to find
          the best matches for you. Web scraping can take a few minutes — hang tight,
          we&apos;ll show live progress as we go. Thank you for your patience!
        </p>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 ${btnSecondaryClassName}`}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onStart}
            className={`flex-1 ${btnPrimaryClassName}`}
          >
            Start searching
          </button>
        </div>
      </div>
    </div>
  );
}
