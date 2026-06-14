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
import type { OutlookSettingsStatus } from "@/types/outlook-settings";

interface OutlookSettingsCardProps {
  embedded?: boolean;
}

export function OutlookSettingsCard({
  embedded = false,
}: OutlookSettingsCardProps) {
  const [status, setStatus] = useState<OutlookSettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingProvider, setSendingProvider] = useState<"mock" | "outlook">(
    "mock"
  );

  async function loadStatus() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/outlook/status");
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to load Outlook settings.");
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
      const res = await fetch("/api/outlook/settings", {
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
      setMessage("Outlook settings saved.");
    } catch {
      setError("Failed to save Outlook settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/outlook/test", { method: "POST" });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? data.result?.message ?? "Test failed.");
        return;
      }

      setMessage(data.result.message);
    } catch {
      setError("Failed to test Outlook connection.");
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/outlook/connection", { method: "DELETE" });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to disconnect Outlook.");
        return;
      }

      setStatus(data.status);
      setMessage("Outlook disconnected.");
    } catch {
      setError("Failed to disconnect Outlook.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/outlook/settings", { method: "DELETE" });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to reset settings.");
        return;
      }

      setStatus(data.status);
      setSendingProvider(data.status.sendingProvider);
      setMessage("Reset to environment defaults.");
    } catch {
      setError("Failed to reset Outlook settings.");
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
                <dt className={labelClassName}>Outlook account</dt>
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
            <label htmlFor="outlook-sending-provider" className={labelClassName}>
              Sending provider
            </label>
            <select
              id="outlook-sending-provider"
              value={sendingProvider}
              onChange={(e) =>
                setSendingProvider(e.target.value as "mock" | "outlook")
              }
              className={`mt-2 ${selectClassName}`}
            >
              <option value="mock">Mock (no delivery)</option>
              <option value="outlook">Outlook</option>
            </select>
            <p className={`mt-1 ${hintClassName}`}>
              Env default: {status?.envProvider ?? "mock"}
              {!status?.oauthConfigured && " · Microsoft OAuth not configured"}
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
              href="/auth/outlook?redirect=/settings"
              className={btnSecondaryClassName}
            >
              {status?.connected ? "Reconnect Outlook" : "Connect Outlook"}
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
            Connect a Microsoft account with Mail.Send permission via Microsoft
            Graph.
          </p>
    </>
  );

  if (embedded) return content;

  return (
    <SettingsCard
      icon={Mail}
      iconClassName="bg-blue-50 text-blue-600"
      title="Outlook sending"
      description="OAuth connection and send provider"
    >
      {content}
    </SettingsCard>
  );
}
