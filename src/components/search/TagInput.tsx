"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { inputClassName } from "@/components/ui/Field";
import {
  filterSuggestions,
  findExactSuggestion,
  findSpellSuggestion,
} from "@/lib/search/suggestion-match";
import {
  btnSecondaryClassName,
  dropdownPanelClassName,
  pillInactiveClassName,
  tagDefaultClassName,
  tagExcludeClassName,
} from "@/lib/ui/styles";

interface TagInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: readonly string[];
  disabled?: boolean;
  variant?: "default" | "exclude";
  /** Show searchable dropdown while typing (like Country field). */
  autosuggest?: boolean;
  /** Show "Show all" to reveal every suggestion chip. */
  showAllSuggestions?: boolean;
  /** Max suggestion chips before "Show all". */
  maxSuggestionPills?: number;
  /** Max options in the autosuggest dropdown. */
  maxDropdownOptions?: number;
}

export function TagInput({
  id,
  value,
  onChange,
  placeholder = "Type and press Enter",
  suggestions = [],
  disabled,
  variant = "default",
  autosuggest = false,
  showAllSuggestions = false,
  maxSuggestionPills = 8,
  maxDropdownOptions = 50,
}: TagInputProps) {
  const isExclude = variant === "exclude";
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [expandedSuggestions, setExpandedSuggestions] = useState(false);

  const tags = value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const availableSuggestions = suggestions.filter((s) => !tags.includes(s));
  const filteredDropdown = filterSuggestions(
    draft,
    availableSuggestions,
    maxDropdownOptions
  );
  const spellSuggestion =
    autosuggest && draft.trim().length >= 3
      ? findSpellSuggestion(draft, availableSuggestions)
      : null;

  const visiblePills = expandedSuggestions
    ? availableSuggestions
    : availableSuggestions.slice(0, maxSuggestionPills);
  const hiddenPillCount = availableSuggestions.length - maxSuggestionPills;

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;

    const exact = findExactSuggestion(trimmed, suggestions) ?? trimmed;
    if (tags.some((t) => t.toLowerCase() === exact.toLowerCase())) return;

    onChange([...tags, exact].join(", "));
    setDraft("");
    setOpen(false);
    setHighlightIndex(0);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag).join(", "));
  }

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    const exact = findExactSuggestion(trimmed, suggestions);
    addTag(exact ?? trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (autosuggest && open && filteredDropdown.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % filteredDropdown.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev === 0 ? filteredDropdown.length - 1 : prev - 1
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredDropdown[highlightIndex]) {
          addTag(filteredDropdown[highlightIndex]);
        } else {
          commitDraft();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    }
    if (e.key === "Backspace" && !draft && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  useEffect(() => {
    setHighlightIndex(0);
  }, [draft]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const tagClass = isExclude ? tagExcludeClassName : tagDefaultClassName;
  const showDropdown =
    autosuggest && open && !disabled && availableSuggestions.length > 0;

  return (
    <div className="space-y-3">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className={tagClass}>
              <span className="break-all">{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className={`shrink-0 rounded hover:opacity-70 disabled:opacity-50 ${
                  isExclude ? "text-red-500" : "text-violet-600"
                }`}
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            {autosuggest && (
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            )}
            <input
              id={id}
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (autosuggest) setOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => autosuggest && setOpen(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  if (!containerRef.current?.contains(document.activeElement)) {
                    if (draft.trim()) commitDraft();
                    setOpen(false);
                  }
                }, 0);
              }}
              placeholder={placeholder}
              disabled={disabled}
              spellCheck={autosuggest}
              autoComplete="off"
              role={autosuggest ? "combobox" : undefined}
              aria-expanded={showDropdown}
              aria-controls={showDropdown ? listboxId : undefined}
              className={`${inputClassName} ${autosuggest ? "pl-10 pr-10" : ""}`}
            />
            {autosuggest && availableSuggestions.length > 0 && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  if (disabled) return;
                  setOpen((prev) => !prev);
                }}
                disabled={disabled}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                aria-label={open ? "Close suggestions" : "Open suggestions"}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => commitDraft()}
            disabled={disabled || !draft.trim()}
            className={`${btnSecondaryClassName} !min-h-[44px] !px-3`}
            aria-label="Add tag"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {spellSuggestion && draft.trim().toLowerCase() !== spellSuggestion.toLowerCase() && (
          <button
            type="button"
            onClick={() => addTag(spellSuggestion)}
            className="mt-2 text-left text-xs text-amber-700 hover:text-amber-900"
          >
            Did you mean <span className="font-semibold">{spellSuggestion}</span>?
          </button>
        )}

        {showDropdown && (
          <ul id={listboxId} role="listbox" className={dropdownPanelClassName}>
            {!draft.trim() && availableSuggestions.length > maxDropdownOptions && (
              <li className="border-b border-gray-100 px-4 py-2 text-xs text-gray-400">
                Type to search all {availableSuggestions.length} suggestions
              </li>
            )}
            {filteredDropdown.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500">
                No matching suggestions — press Enter to add your text
              </li>
            ) : (
              filteredDropdown.map((suggestion, index) => (
                <li
                  key={suggestion}
                  role="option"
                  aria-selected={index === highlightIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => addTag(suggestion)}
                  className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                    index === highlightIndex
                      ? "bg-violet-50 text-violet-900"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {suggestion}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {availableSuggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {visiblePills.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addTag(suggestion)}
                disabled={disabled}
                className={`${pillInactiveClassName} !rounded-full hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800`}
              >
                + {suggestion}
              </button>
            ))}
          </div>
          {showAllSuggestions && !expandedSuggestions && hiddenPillCount > 0 && (
            <button
              type="button"
              onClick={() => setExpandedSuggestions(true)}
              disabled={disabled}
              className="text-xs font-medium text-violet-700 hover:text-violet-900"
            >
              Show all {availableSuggestions.length} suggestions
            </button>
          )}
          {showAllSuggestions && expandedSuggestions && (
            <button
              type="button"
              onClick={() => setExpandedSuggestions(false)}
              disabled={disabled}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Show fewer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
