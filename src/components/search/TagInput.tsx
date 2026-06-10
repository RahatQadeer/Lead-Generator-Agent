"use client";

import { useState, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { inputClassName } from "@/components/ui/Field";

interface TagInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: readonly string[];
  disabled?: boolean;
}

export function TagInput({
  id,
  value,
  onChange,
  placeholder = "Type and press Enter",
  suggestions = [],
  disabled,
}: TagInputProps) {
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={disabled}
              className="rounded text-cyan-400 hover:text-white disabled:opacity-50"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

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
          className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
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
              className="rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-50"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
