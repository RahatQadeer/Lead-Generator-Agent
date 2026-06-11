"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Sparkles } from "lucide-react";
import { selectClassName } from "@/components/ui/Field";
import type { GmailSettingsStatus } from "@/types/gmail-settings";

export function GmailSettingsCard() {
  const [status, setStatus] = useState<GmailSettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingProvider, setSendingProvider] = useState<"mock" | "gmail">(
    "mock"
  );

  async function loadStatus() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/gmail/status");
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to load Gmail settings.");
        return;
      }

      setStatus(data.status);
      setSendingProvider(data.status.sendingProvider);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/gmail/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendingProvider }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to save settings.");
        return;
      }

      setStatus(data.status);
      setMessage("Gmail settings saved.");
    } catch {
      setError("Failed to save Gmail settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/gmail/test", { method: "POST" });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? data.result?.message ?? "Test failed.");
        return;
      }

      setMessage(data.result.message);
    } catch {
      setError("Failed to test Gmail connection.");
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/gmail/connection", { method: "DELETE" });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to disconnect Gmail.");
        return;
      }

      setStatus(data.status);
      setMessage("Gmail disconnected.");
    } catch {
      setError("Failed to disconnect Gmail.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/gmail/settings", { method: "DELETE" });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to reset settings.");
        return;
      }

      setStatus(data.status);
      setSendingProvider(data.status.sendingProvider);
      setMessage("Reset to environment defaults.");
    } catch {
      setError("Failed to reset Gmail settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
          <Mail className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Gmail sending
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            OAuth connection and send provider
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading configuration…
        </div>
      ) : (
        <>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">
                Active provider
              </dt>
              <dd className="mt-1 text-sm text-white">
                {status?.effectiveProvider ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Connection</dt>
              <dd className="mt-1 text-sm text-white">
                {status?.connected ? "Connected" : "Not connected"}
              </dd>
            </div>
            {status?.accountAddress && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">
                  Gmail account
                </dt>
                <dd className="mt-1 text-sm text-white">
                  {status.accountAddress}
                </dd>
              </div>
            )}
            {status?.connectedAt && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">
                  Connected since
                </dt>
                <dd className="mt-1 text-sm text-white">
                  {new Date(status.connectedAt).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6">
            <label
              htmlFor="gmail-sending-provider"
              className="mb-2 block text-xs font-medium text-slate-400"
            >
              Sending provider
            </label>
            <select
              id="gmail-sending-provider"
              value={sendingProvider}
              onChange={(e) =>
                setSendingProvider(e.target.value as "mock" | "gmail")
              }
              className={selectClassName}
            >
              <option value="mock">Mock (no delivery)</option>
              <option value="gmail">Gmail</option>
            </select>
            <p className="mt-1 text-xs text-slate-600">
              Env default: {status?.envProvider ?? "mock"}
              {!status?.oauthConfigured && " · Google OAuth not configured"}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || testing || disconnecting}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save settings"
              )}
            </button>
            <a
              href="/auth/oauth?redirect=/settings"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              {status?.connected ? "Reconnect Gmail" : "Connect Gmail"}
            </a>
            {status?.connected && (
              <button
                type="button"
                onClick={handleTest}
                disabled={saving || testing || disconnecting}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Test connection
                  </>
                )}
              </button>
            )}
            {status?.connected && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={saving || testing || disconnecting}
                className="text-sm text-rose-400 transition-colors hover:text-rose-300 disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            )}
            {status?.hasUserSettings && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving || testing || disconnecting}
                className="text-sm text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
              >
                Reset to defaults
              </button>
            )}
          </div>

          {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

          <p className="mt-3 text-xs text-slate-600">
            Connect Gmail to send real outreach. Enable provider token storage in
            Supabase Auth settings.
          </p>
        </>
      )}
    </div>
  );
}
