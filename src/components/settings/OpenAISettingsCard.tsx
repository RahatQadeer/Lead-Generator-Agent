"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { inputClassName, selectClassName } from "@/components/ui/Field";
import type { OpenAISettingsStatus } from "@/types/openai-settings";

const MODEL_OPTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
];

export function OpenAISettingsCard() {
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
        setError(data.error?.message ?? "Failed to load OpenAI settings.");
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
        setError(data.error?.message ?? "Failed to save settings.");
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
        setError(data.error?.message ?? data.result?.message ?? "Test failed.");
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
        setError(data.error?.message ?? "Failed to reset settings.");
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

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <Bot className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            OpenAI generation
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Email and follow-up AI provider
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
              <dt className="text-xs font-medium text-slate-500">API key</dt>
              <dd className="mt-1 text-sm text-white">
                {status?.apiKeyConfigured
                  ? `${status.apiKeyPreview} (${status.keySource})`
                  : "Not configured"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="generation-provider"
                className="mb-2 block text-xs font-medium text-slate-400"
              >
                Provider
              </label>
              <select
                id="generation-provider"
                value={generationProvider}
                onChange={(e) =>
                  setGenerationProvider(e.target.value as "mock" | "openai")
                }
                className={selectClassName}
              >
                <option value="mock">Mock (templates)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="openai-model"
                className="mb-2 block text-xs font-medium text-slate-400"
              >
                Model
              </label>
              <input
                id="openai-model"
                list="openai-models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputClassName}
                placeholder="gpt-4o-mini"
              />
              <datalist id="openai-models">
                {MODEL_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="openai-api-key"
                className="mb-2 block text-xs font-medium text-slate-400"
              >
                API key
              </label>
              <input
                id="openai-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={inputClassName}
                placeholder={
                  status?.apiKeyPreview
                    ? `Configured: ${status.apiKeyPreview}`
                    : "sk-..."
                }
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-slate-600">
                Leave blank to keep the current key. Environment variable{" "}
                <code className="text-slate-500">OPENAI_API_KEY</code> is used
                as fallback.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || testing}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
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
            {status?.hasUserSettings && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving || testing}
                className="text-sm text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
              >
                Reset to defaults
              </button>
            )}
          </div>

          {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
        </>
      )}
    </div>
  );
}
