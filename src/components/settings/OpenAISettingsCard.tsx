"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { inputClassName, selectClassName } from "@/components/ui/Field";
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
import type { OpenAISettingsStatus } from "@/types/openai-settings";
import { getApiErrorMessage } from "@/lib/ui/user-messages";

const MODEL_OPTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
];

interface OpenAISettingsCardProps {
  embedded?: boolean;
}

export function OpenAISettingsCard({ embedded = false }: OpenAISettingsCardProps) {
  const [status, setStatus] = useState<OpenAISettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [generationProvider, setGenerationProvider] = useState<"mock" | "openai">(
    "mock"
  );
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/openai/status");
      const data = await res.json();

      if (!data.success) {
        setError(getApiErrorMessage(data.error, "Failed to load OpenAI settings."));
        return;
      }

      setStatus(data.status);
      setGenerationProvider(data.status.generationProvider);
      setModel(data.status.model);
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
      const res = await fetch("/api/openai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationProvider,
          model,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(getApiErrorMessage(data.error, "Failed to save settings."));
        return;
      }

      setStatus(data.status);
      setApiKey("");
      setMessage("OpenAI settings saved.");
    } catch {
      setError("Failed to save OpenAI settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/openai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(
          getApiErrorMessage(data.error, data.result?.message ?? "Test failed.")
        );
        return;
      }

      setMessage(data.result.message);
    } catch {
      setError("Failed to test OpenAI connection.");
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/openai/settings", { method: "DELETE" });
      const data = await res.json();

      if (!data.success) {
        setError(getApiErrorMessage(data.error, "Failed to reset settings."));
        return;
      }

      setStatus(data.status);
      setGenerationProvider(data.status.generationProvider);
      setModel(data.status.model);
      setApiKey("");
      setMessage("Reset to environment defaults.");
    } catch {
      setError("Failed to reset OpenAI settings.");
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
              <dt className={labelClassName}>API key</dt>
              <dd className="mt-1 break-all text-sm text-gray-900">
                {status?.apiKeyConfigured
                  ? `${status.apiKeyPreview} (${status.keySource})`
                  : "Not configured"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="generation-provider" className={labelClassName}>
                Provider
              </label>
              <select
                id="generation-provider"
                value={generationProvider}
                onChange={(e) =>
                  setGenerationProvider(e.target.value as "mock" | "openai")
                }
                className={`mt-2 ${selectClassName}`}
              >
                <option value="mock">Mock (templates)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label htmlFor="openai-model" className={labelClassName}>
                Model
              </label>
              <input
                id="openai-model"
                list="openai-models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={`mt-2 ${inputClassName}`}
                placeholder="gpt-4o-mini"
              />
              <datalist id="openai-models">
                {MODEL_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="openai-api-key" className={labelClassName}>
                API key
              </label>
              <input
                id="openai-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={`mt-2 ${inputClassName}`}
                placeholder={
                  status?.apiKeyPreview
                    ? `Configured: ${status.apiKeyPreview}`
                    : "sk-..."
                }
                autoComplete="off"
              />
              <p className={`mt-1 ${hintClassName}`}>
                Leave blank to keep the current key. Environment variable{" "}
                <code className="text-gray-600">OPENAI_API_KEY</code> is used as
                fallback.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || testing}
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
            <button
              type="button"
              onClick={handleTest}
              disabled={saving || testing}
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
            {status?.hasUserSettings && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving || testing}
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
    </>
  );

  if (embedded) return content;

  return (
    <SettingsCard
      icon={Bot}
      iconClassName="bg-violet-50 text-violet-600"
      title="OpenAI generation"
      description="Email and follow-up AI provider"
    >
      {content}
    </SettingsCard>
  );
}
