"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Sparkles } from "lucide-react";
import { selectClassName } from "@/components/ui/Field";
import { SettingsCard } from "@/components/ui/SettingsCard";
import {
  alertErrorClassName,
  alertSuccessClassName,
  btnGhostClassName,
  btnPrimaryClassName,
  btnSecondaryClassName,
  hintClassName,
  labelClassName,
  textSecondaryClassName,
} from "@/lib/ui/styles";
import type { GmailSettingsStatus } from "@/types/gmail-settings";

interface GmailSettingsCardProps {
  embedded?: boolean;
}

export function GmailSettingsCard({ embedded = false }: GmailSettingsCardProps) {
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

  const content = loading ? (
    <div className={`flex items-center gap-2 ${textSecondaryClassName}`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading configuration…
    </div>
  ) : (
    <>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className={labelClassName}>Active provider</dt>
              <dd className="mt-1 break-words text-sm text-gray-900">
                {status?.effectiveProvider ?? "—"}
              </dd>
            </div>
            <div>
              <dt className={labelClassName}>Connection</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {status?.connected ? "Connected" : "Not connected"}
              </dd>
            </div>
            {status?.accountAddress && (
              <div className="sm:col-span-2">
                <dt className={labelClassName}>Gmail account</dt>
                <dd className="mt-1 break-all text-sm text-gray-900">
                  {status.accountAddress}
                </dd>
              </div>
            )}
            {status?.connectedAt && (
              <div className="sm:col-span-2">
                <dt className={labelClassName}>Connected since</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(status.connectedAt).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6">
            <label htmlFor="gmail-sending-provider" className={labelClassName}>
              Sending provider
            </label>
            <select
              id="gmail-sending-provider"
              value={sendingProvider}
              onChange={(e) =>
                setSendingProvider(e.target.value as "mock" | "gmail")
              }
              className={`mt-2 ${selectClassName}`}
            >
              <option value="mock">Mock (no delivery)</option>
              <option value="gmail">Gmail</option>
            </select>
            <p className={`mt-1 ${hintClassName}`}>
              Env default: {status?.envProvider ?? "mock"}
              {!status?.oauthConfigured && " · Google OAuth not configured"}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || testing || disconnecting}
              className={btnPrimaryClassName}
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
              href="/auth/oauth?redirect=/settings&connect=gmail"
              className={btnSecondaryClassName}
            >
              {status?.connected ? "Reconnect Gmail" : "Connect Gmail"}
            </a>
            {status?.connected && (
              <button
                type="button"
                onClick={handleTest}
                disabled={saving || testing || disconnecting}
                className={btnSecondaryClassName}
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
                className="text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            )}
            {status?.hasUserSettings && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving || testing || disconnecting}
                className={btnGhostClassName}
              >
                Reset to defaults
              </button>
            )}
          </div>

          {message && (
            <div className={`mt-3 ${alertSuccessClassName}`} role="status">
              {message}
            </div>
          )}
          {error && (
            <div className={`mt-3 ${alertErrorClassName}`} role="alert">
              {error}
            </div>
          )}

          <p className={`mt-3 ${hintClassName}`}>
            Connect Gmail to send real outreach. Enable provider token storage in
            Supabase Auth settings.
          </p>
    </>
  );

  if (embedded) return content;

  return (
    <SettingsCard
      icon={Mail}
      iconClassName="bg-emerald-50 text-emerald-600"
      title="Gmail sending"
      description="OAuth connection and send provider"
    >
      {content}
    </SettingsCard>
  );
}
