"use client";

/**
 * Free-text tag entry for keywords.
 *
 * Commits on Enter, comma, or blur. Blur matters: a user who types a keyword and
 * clicks "Run Search" without pressing Enter would otherwise lose it silently,
 * and lose the run's most important filter without any feedback.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { describedBy } from "@/components/search-builder/fields/FieldShell";

interface TagFieldProps {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hasDescription?: boolean;
  hasError?: boolean;
  suggestions?: readonly string[];
}

export function TagField({
  id,
  value,
  onChange,
  placeholder = "Add a keyword and press Enter",
  hasDescription,
  hasError,
  suggestions = [],
}: TagFieldProps) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "");
    if (!tag) return;
    if (!value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      onChange([...value, tag]);
    }
    setDraft("");
  };

  const remove = (tag: string) => onChange(value.filter((v) => v !== tag));

  const unusedSuggestions = suggestions
    .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    .slice(0, 6);

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Keywords">
          {value.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-2.5 pr-1 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {tag}
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  aria-label={`Remove ${tag}`}
                  className="rounded-full p-0.5 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-gray-700"
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
        value={draft}
        placeholder={placeholder}
        aria-describedby={describedBy(id, Boolean(hasDescription), Boolean(hasError))}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit(draft);
          } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
            remove(value[value.length - 1] as string);
          }
        }}
        onBlur={() => commit(draft)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />

      {unusedSuggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400">Try:</span>
          {unusedSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => commit(suggestion)}
              className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-violet-400 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-gray-700 dark:text-gray-400"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
