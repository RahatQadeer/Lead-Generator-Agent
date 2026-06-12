"use client";

import { useState, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { inputClassName } from "@/components/ui/Field";
import {
  btnSecondaryClassName,
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
}

export function TagInput({
  id,
  value,
  onChange,
  placeholder = "Type and press Enter",
  suggestions = [],
  disabled,
  variant = "default",
}: TagInputProps) {
  const isExclude = variant === "exclude";
  const [draft, setDraft] = useState("");
  const tags = value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed].join(", "));
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag).join(", "));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    }
    if (e.key === "Backspace" && !draft && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  const availableSuggestions = suggestions.filter((s) => !tags.includes(s));
  const tagClass = isExclude ? tagExcludeClassName : tagDefaultClassName;

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
                  isExclude ? "text-red-500" : "text-blue-600"
                }`}
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && addTag(draft)}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => addTag(draft)}
          disabled={disabled || !draft.trim()}
          className={`${btnSecondaryClassName} !min-h-[44px] !px-3`}
          aria-label="Add tag"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {availableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableSuggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addTag(suggestion)}
              disabled={disabled}
              className={`${pillInactiveClassName} !rounded-full hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700`}
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
