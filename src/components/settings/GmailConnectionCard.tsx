"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import type { EmailProviderConnectionStatus } from "@/types/email-sending";

export function GmailConnectionCard() {
  const [status, setStatus] = useState<EmailProviderConnectionStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/gmail/status");
        const data = await res.json();
        if (data.success) {
          setStatus(data.status);
        }
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, []);

  return (
    <div className="max-w-xl rounded-2xl border border-white/5 bg-slate-900/50 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
          <Mail className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Gmail sending
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Provider: {status?.provider ?? "—"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking connection…
        </div>
      ) : (
        <dl className="mt-6 space-y-4">
          <div>
            <dt className="text-xs font-medium text-slate-500">Status</dt>
            <dd className="mt-1 text-sm text-white">
              {status?.connected ? "Connected" : "Not connected"}
            </dd>
          </div>
          {status?.accountAddress && (
            <div>
              <dt className="text-xs font-medium text-slate-500">Gmail account</dt>
              <dd className="mt-1 text-sm text-white">{status.accountAddress}</dd>
            </div>
          )}
        </dl>
      )}

      <a
        href="/auth/oauth?redirect=/settings"
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
      >
        {status?.connected ? "Reconnect Gmail" : "Connect Gmail"}
      </a>
      <p className="mt-3 text-xs text-slate-600">
        Sign in with Google to grant Gmail send access. Enable provider token
        storage in Supabase Auth settings.
      </p>
    </div>
  );
}
