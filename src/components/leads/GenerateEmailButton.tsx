"use client";

import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";

interface GenerateEmailButtonProps {
  contactId: string;
  leadName: string;
  hasEmail: boolean;
}

export function GenerateEmailButton({
  contactId,
  leadName,
  hasEmail,
}: GenerateEmailButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/emails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.error?.message ?? "Failed to generate email.");
        return;
      }

      setMessage(`Draft saved for ${leadName}. View it on the Emails page.`);
    } catch {
      setMessage("Failed to connect to email generation service.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasEmail) {
    return (
      <p className="text-xs text-slate-600">No email — cannot generate outreach</p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Mail className="h-3.5 w-3.5" />
            Generate email
          </>
        )}
      </button>
      {message && (
        <p className="max-w-xs text-right text-xs text-slate-400">{message}</p>
      )}
    </div>
  );
}
