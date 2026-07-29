"use client";

/**
 * Label + description + error wrapper shared by every field.
 *
 * Centralised so the accessibility wiring is written once: the control is
 * associated with its label via `htmlFor`/`id`, and with its description and
 * error via `aria-describedby`, which is what makes a screen reader announce
 * why a field is invalid rather than just that it is.
 */
import type { ReactNode } from "react";

export interface FieldShellProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
  /** Renders the required marker and sets aria-required on the control. */
  required?: boolean;
  children: ReactNode;
}

export function FieldShell({
  id,
  label,
  description,
  error,
  required,
  children,
}: FieldShellProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-900 dark:text-gray-100"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {description && (
        <p id={descriptionId} className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}

      {children}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Ids for the describedby wiring, so controls stay consistent. */
export function describedBy(
  id: string,
  hasDescription: boolean,
  hasError: boolean
): string | undefined {
  const ids = [
    hasDescription ? `${id}-description` : null,
    hasError ? `${id}-error` : null,
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}
