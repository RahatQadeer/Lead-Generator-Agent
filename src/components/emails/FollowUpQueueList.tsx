"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar, Loader2, Sparkles, FileText } from "lucide-react";
import {
  alertErrorClassName,
  btnSmPrimaryClassName,
  btnSmSecondaryClassName,
  cardClassName,
  headingSubsectionClassName,
  hintClassName,
  nestedCardClassName,
  textPrimaryClassName,
  textSecondaryClassName,
} from "@/lib/ui/styles";
import type { ScheduledFollowUpWithContext } from "@/types/follow-up";
import { getApiErrorMessage } from "@/lib/ui/user-messages";

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
        setError(getApiErrorMessage(data.error, "Failed to generate suggestion."));
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
        setError(getApiErrorMessage(data.error, "Failed to save draft."));
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
      <p className={headingSubsectionClassName}>Scheduled follow-ups</p>
      <ul className="space-y-3">
        {followUps.map((followUp) => {
          const suggestion =
            localSuggestions[followUp.id] ?? followUp.suggestion;
          const isGenerating = loadingId === followUp.id;
          const isSaving = savingId === followUp.id;

          return (
            <li key={followUp.id} className={`${cardClassName} p-4`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-gray-900">
                    {followUp.leadName}
                  </p>
                  <p className={`break-words ${textSecondaryClassName}`}>
                    {followUp.leadCompany}
                  </p>
                  <p className={`mt-1 break-words ${hintClassName}`}>
                    Re: {followUp.originalSubject}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Due {formatScheduledDate(followUp.scheduledAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerate(followUp.id)}
                    disabled={isGenerating || isSaving}
                    className={btnSmSecondaryClassName}
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
                      className={btnSmPrimaryClassName}
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
                    <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
                      Draft saved
                    </span>
                  )}
                </div>
              </div>
              {suggestion && (
                <div className={`mt-3 ${nestedCardClassName} p-3`}>
                  <p className={`break-words ${textPrimaryClassName}`}>
                    {suggestion.subject}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-600">
                    {suggestion.body}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <div className={alertErrorClassName} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
