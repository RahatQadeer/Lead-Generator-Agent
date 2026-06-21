"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar, Loader2, Sparkles, FileText } from "lucide-react";
import type { ScheduledFollowUpWithContext } from "@/types/follow-up";

interface FollowUpQueueListProps {
  followUps: ScheduledFollowUpWithContext[];
}

function formatScheduledDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FollowUpQueueList({ followUps }: FollowUpQueueListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localSuggestions, setLocalSuggestions] = useState<
    Record<string, { subject: string; body: string }>
  >({});

  if (followUps.length === 0) return null;

  async function handleGenerate(followUpId: string) {
    setLoadingId(followUpId);
    setError(null);

    try {
      const res = await fetch("/api/follow-ups/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpId }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to generate suggestion.");
        return;
      }

      setLocalSuggestions((prev) => ({
        ...prev,
        [followUpId]: {
          subject: data.suggestion.subject,
          body: data.suggestion.body,
        },
      }));
      router.refresh();
    } catch {
      setError("Failed to connect to follow-up generation service.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleSaveDraft(followUpId: string) {
    setSavingId(followUpId);
    setError(null);

    try {
      const res = await fetch("/api/follow-ups/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpId }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to save draft.");
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to save follow-up draft.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mb-6 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Scheduled follow-ups
      </p>
      <ul className="space-y-3">
        {followUps.map((followUp) => {
          const suggestion =
            localSuggestions[followUp.id] ?? followUp.suggestion;
          const isGenerating = loadingId === followUp.id;
          const isSaving = savingId === followUp.id;

          return (
            <li
              key={followUp.id}
              className="rounded-xl border border-white/10 bg-slate-900/50 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">
                    {followUp.leadName}
                  </p>
                  <p className="text-xs text-slate-400">{followUp.leadCompany}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Re: {followUp.originalSubject}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
                    <Calendar className="h-3.5 w-3.5" />
                    Due {formatScheduledDate(followUp.scheduledAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerate(followUp.id)}
                    disabled={isGenerating || isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        {suggestion ? "Regenerate" : "Generate suggestion"}
                      </>
                    )}
                  </button>
                  {suggestion && !followUp.draftEmailId && (
                    <button
                      type="button"
                      onClick={() => handleSaveDraft(followUp.id)}
                      disabled={isGenerating || isSaving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <FileText className="h-3.5 w-3.5" />
                          Save as draft
                        </>
                      )}
                    </button>
                  )}
                  {followUp.draftEmailId && (
                    <span className="inline-flex items-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-300">
                      Draft saved
                    </span>
                  )}
                </div>
              </div>
              {suggestion && (
                <div className="mt-3 rounded-lg border border-white/5 bg-slate-950/50 p-3">
                  <p className="text-xs font-medium text-slate-300">
                    {suggestion.subject}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">
                    {suggestion.body}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
