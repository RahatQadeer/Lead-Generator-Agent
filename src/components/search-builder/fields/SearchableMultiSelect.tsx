"use client";

/**
 * Searchable multi-select for long option lists (countries, industries).
 *
 * Implements the WAI-ARIA combobox pattern: the text input owns
 * `role="combobox"` with `aria-expanded`/`aria-controls`, the list is a
 * `listbox`, and the active option is tracked with `aria-activedescendant`
 * rather than moving DOM focus — moving focus into the list would close the
 * on-screen keyboard on mobile and break type-ahead.
 *
 * Selections render as removable chips above the input, which is what makes a
 * 200-country list usable without a modal.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { describedBy } from "@/components/search-builder/fields/FieldShell";

interface SearchableMultiSelectProps {
  id: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hasDescription?: boolean;
  hasError?: boolean;
  /** Cap the rendered list; a 200-item dropdown is unusable and slow. */
  maxVisible?: number;
}

export function SearchableMultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Type to search…",
  hasDescription,
  hasError,
  maxVisible = 50,
}: SearchableMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const selected = new Set(value);
    return options
      .filter((option) => !selected.has(option))
      .filter((option) => (needle ? option.toLowerCase().includes(needle) : true))
      .slice(0, maxVisible);
  }, [options, value, query, maxVisible]);

  // Reset the highlight whenever the result set changes, so Enter never selects
  // a stale option the user can no longer see.
  useEffect(() => setActiveIndex(0), [query, value.length]);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const add = (option: string) => {
    if (!value.includes(option)) onChange([...value, option]);
    setQuery("");
    setOpen(false);
  };

  const remove = (option: string) => onChange(value.filter((v) => v !== option));

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      add(matches[activeIndex] as string);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && query === "" && value.length > 0) {
      // Backspace on an empty input removes the last chip — the behaviour every
      // tag input has, and its absence feels broken.
      remove(value[value.length - 1] as string);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Selected">
          {value.map((item) => (
            <li key={item}>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 py-1 pl-2.5 pr-1 text-sm text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800">
                {item}
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label={`Remove ${item}`}
                  className="rounded-full p-0.5 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-violet-900"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined
        }
        aria-describedby={describedBy(id, Boolean(hasDescription), Boolean(hasError))}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />

      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {matches.map((option, index) => (
            <li
              key={option}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                // mousedown, not click: the input's blur would close the list
                // before a click ever lands.
                event.preventDefault();
                add(option);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={[
                "cursor-pointer px-3 py-2 text-sm",
                index === activeIndex
                  ? "bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
                  : "text-gray-700 dark:text-gray-300",
              ].join(" ")}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
