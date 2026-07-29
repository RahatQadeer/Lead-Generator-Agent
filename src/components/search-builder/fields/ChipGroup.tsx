"use client";

/**
 * Toggleable chips for a small, fixed option set (funding stages, contact types,
 * decision-maker roles).
 *
 * Built on real checkbox/radio inputs rather than clickable divs. A visually
 * styled div is invisible to assistive technology and unreachable by keyboard;
 * hiding a genuine input behind `sr-only` and styling its label keeps arrow-key
 * and space/enter behaviour that browsers already implement correctly.
 */
import { describedBy } from "@/components/search-builder/fields/FieldShell";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface ChipGroupProps<T extends string> {
  id: string;
  options: readonly ChipOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  hasDescription?: boolean;
  hasError?: boolean;
  /** Single-select renders radios instead of checkboxes. */
  single?: boolean;
  disabled?: boolean;
}

export function ChipGroup<T extends string>({
  id,
  options,
  value,
  onChange,
  hasDescription,
  hasError,
  single,
  disabled,
}: ChipGroupProps<T>) {
  const toggle = (option: T) => {
    if (single) {
      onChange(value[0] === option ? [] : [option]);
      return;
    }
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  };

  return (
    <div
      role="group"
      aria-describedby={describedBy(id, Boolean(hasDescription), Boolean(hasError))}
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const checked = value.includes(option.value);
        const inputId = `${id}-${option.value}`;

        return (
          <div key={option.value}>
            <input
              id={inputId}
              type={single ? "radio" : "checkbox"}
              name={single ? id : inputId}
              className="peer sr-only"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(option.value)}
            />
            <label
              htmlFor={inputId}
              title={option.hint}
              className={[
                "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5",
                "text-sm transition-colors",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-focus-visible:ring-offset-2",
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                checked
                  ? "border-violet-500 bg-violet-50 font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
              ].join(" ")}
            >
              {option.label}
            </label>
          </div>
        );
      })}
    </div>
  );
}
