"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { inputClassName } from "@/components/ui/Field";

interface ComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  /** When true, typed text can be committed even if it is not in the options list. */
  allowCustom?: boolean;
  emptyMessage?: string;
  /** Max options shown in the dropdown at once. */
  maxOptions?: number;
}

function findExactMatch(options: readonly string[], query: string): string | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  return options.find((option) => option.toLowerCase() === normalized) ?? null;
}

export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = "Search…",
  disabled,
  allowCustom = false,
  emptyMessage = "No matches found",
  maxOptions = 50,
}: ComboboxProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const trimmedQuery = query.trim();
  const exactMatch = trimmedQuery
    ? findExactMatch(options, trimmedQuery)
    : null;
  const showCustomOption =
    allowCustom && trimmedQuery.length > 0 && !exactMatch;

  const filtered = (() => {
    const normalized = trimmedQuery.toLowerCase();
    if (!normalized) return options.slice(0, maxOptions);
    return options
      .filter((option) => option.toLowerCase().includes(normalized))
      .slice(0, maxOptions);
  })();

  const commitValue = useCallback(
    (next: string) => {
      onChange(next);
      setQuery(next);
      setOpen(false);
      setHighlightIndex(0);
    },
    [onChange]
  );

  const commitQuery = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      commitValue("");
      return;
    }

    const exact = findExactMatch(options, trimmed);
    if (exact) {
      commitValue(exact);
      return;
    }

    if (allowCustom) {
      commitValue(trimmed);
      return;
    }

    setQuery(value);
    setOpen(false);
  }, [allowCustom, commitValue, options, query, value]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        commitQuery();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [commitQuery, open]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else {
        const total = (showCustomOption ? 1 : 0) + filtered.length;
        if (total > 0) setHighlightIndex((prev) => (prev + 1) % total);
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else {
        const total = (showCustomOption ? 1 : 0) + filtered.length;
        if (total > 0) {
          setHighlightIndex((prev) =>
            prev === 0 ? total - 1 : prev - 1
          );
        }
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (showCustomOption && highlightIndex === 0) {
        commitValue(trimmedQuery);
        return;
      }
      const optionIndex = showCustomOption ? highlightIndex - 1 : highlightIndex;
      if (open && filtered[optionIndex]) {
        commitValue(filtered[optionIndex]);
      } else if (allowCustom && trimmedQuery) {
        commitValue(trimmedQuery);
      } else {
        commitQuery();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setQuery(value);
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showDropdown
              ? highlightIndex === 0 && showCustomOption
                ? `${listboxId}-custom`
                : filtered[
                    showCustomOption ? highlightIndex - 1 : highlightIndex
                  ]
                ? `${listboxId}-option-${showCustomOption ? highlightIndex - 1 : highlightIndex}`
                : undefined
              : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                commitQuery();
              }
            }, 0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`${inputClassName} pl-10 pr-10`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300 disabled:opacity-50"
          aria-label={open ? "Close options" : "Open options"}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 bg-slate-900 py-1 shadow-xl shadow-black/40"
        >
          {showCustomOption && (
            <li
              id={`${listboxId}-custom`}
              role="option"
              aria-selected={value === trimmedQuery}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlightIndex(0)}
              onClick={() => commitValue(trimmedQuery)}
              className={`cursor-pointer border-b border-white/5 px-4 py-2.5 text-sm transition-colors ${
                highlightIndex === 0
                  ? "bg-cyan-500/15 text-cyan-100"
                  : "text-cyan-300 hover:bg-white/5"
              }`}
            >
              <span className="inline-flex items-center gap-2 font-medium">
                <Plus className="h-3.5 w-3.5" />
                Add &quot;{trimmedQuery}&quot;
              </span>
            </li>
          )}
          {filtered.length === 0 && !showCustomOption ? (
            <li className="px-4 py-3 text-sm text-slate-500">{emptyMessage}</li>
          ) : (
            filtered.map((option, index) => {
              const listIndex = showCustomOption ? index + 1 : index;
              const isHighlighted = listIndex === highlightIndex;
              const isSelected = option === value;

              return (
                <li
                  key={option}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(listIndex)}
                  onClick={() => commitValue(option)}
                  className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                    isHighlighted
                      ? "bg-cyan-500/15 text-cyan-100"
                      : "text-slate-300 hover:bg-white/5"
                  } ${isSelected ? "font-medium" : ""}`}
                >
                  {option}
                </li>
              );
            })
          )}
          {!query.trim() && options.length > maxOptions && (
            <li className="border-t border-white/5 px-4 py-2 text-xs text-slate-500">
              Type to search all {options.length} options
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
