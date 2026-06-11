"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

interface SendEmailButtonProps {
  emailId: string;
  recipientEmail: string | null;
}

export function SendEmailButton({ emailId, recipientEmail }: SendEmailButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.error?.message ?? "Failed to send email.");
        return;
      }

      setSent(true);
      setMessage(`Sent to ${data.meta?.recipientEmail ?? recipientEmail}.`);
    } catch {
      setMessage("Failed to connect to email sending service.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return <p className="text-xs text-emerald-400">Sent successfully</p>;
  }

  if (!recipientEmail) {
    return (
      <p className="text-xs text-slate-600">No recipient email on file</p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSend}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5" />
            Send via Gmail
          </>
        )}
      </button>
      {message && (
        <p className="max-w-xs text-right text-xs text-slate-400">{message}</p>
      )}
    </div>
  );
}
