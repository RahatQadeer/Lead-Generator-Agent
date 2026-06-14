"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { getSendingProviderLabel } from "@/lib/email-sending/factory";
import {
  alertSuccessClassName,
  btnSmPrimaryClassName,
  hintClassName,
} from "@/lib/ui/styles";
import type { EmailSendingProviderName } from "@/types/email-sending";

interface SendEmailButtonProps {
  emailId: string;
  recipientEmail: string | null;
  sendingProvider: EmailSendingProviderName;
}

function getSendButtonLabel(provider: EmailSendingProviderName): string {
  if (provider === "mock") return "Send email";
  return `Send via ${getSendingProviderLabel(provider)}`;
}

export function SendEmailButton({
  emailId,
  recipientEmail,
  sendingProvider,
}: SendEmailButtonProps) {
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
    return (
      <div className={alertSuccessClassName} role="status">
        Sent successfully
      </div>
    );
  }

  if (!recipientEmail) {
    return <p className={hintClassName}>No recipient email on file</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSend}
        disabled={loading}
        className={btnSmPrimaryClassName}
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5" />
            {getSendButtonLabel(sendingProvider)}
          </>
        )}
      </button>
      {message && (
        <p
          className="max-w-xs break-words text-right text-xs text-red-600"
          role="alert"
        >
          {message}
        </p>
      )}
    </div>
  );
}
