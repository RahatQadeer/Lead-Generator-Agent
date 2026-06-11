"use client";

import { useState } from "react";
import { Mail, Loader2, X } from "lucide-react";
import { getToneLabel } from "@/lib/email-generation/tone-guidance";
import type { EmailGenerationPreview, EmailTone } from "@/types/email-generation";
import { EMAIL_TONES } from "@/types/email-generation";

interface GenerateEmailButtonProps {
  contactId: string;
  leadName: string;
  hasEmail: boolean;
  followUpsPaused?: boolean;
}

function formatPainPoints(points: string[]): string {
  return points.join("\n");
}

function parsePainPointsText(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function GenerateEmailButton({
  contactId,
  leadName,
  hasEmail,
  followUpsPaused = false,
}: GenerateEmailButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailGenerationPreview | null>(null);
  const [painPointsText, setPainPointsText] = useState("");
  const [tone, setTone] = useState<EmailTone>("professional");
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; tone: EmailTone; isDefault: boolean }>
  >([]);
  const [templateId, setTemplateId] = useState<string>("");

  async function loadContext() {
    setLoadingContext(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/emails/context?contactId=${contactId}`);
      const data = await res.json();

      if (!data.success) {
        setMessage(data.error?.message ?? "Failed to load lead context.");
        return;
      }

      setPreview(data.preview);
      setPainPointsText(formatPainPoints(data.preview.painPoints));
      setTone(data.preview.defaultTone);
      setTemplates(data.templates ?? []);
      const defaultForTone = (data.templates ?? []).find(
        (template: { tone: EmailTone; isDefault: boolean }) =>
          template.tone === data.preview.defaultTone && template.isDefault
      );
      setTemplateId(defaultForTone?.id ?? "");
      setOpen(true);
    } catch {
      setMessage("Failed to load personalization context.");
    } finally {
      setLoadingContext(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setMessage(null);

    const painPoints = parsePainPointsText(painPointsText);

    try {
      const res = await fetch("/api/emails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          painPoints,
          tone,
          templateId: templateId || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.error?.message ?? "Failed to generate email.");
        return;
      }

      setMessage(
        `${getToneLabel(tone)} draft saved for ${leadName}. View it on the Emails page.`
      );
      setOpen(false);
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

  if (followUpsPaused) {
    return (
      <p className="text-xs text-amber-400">Follow-ups stopped — lead replied</p>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-end gap-2">
      {!open ? (
        <button
          type="button"
          onClick={loadContext}
          disabled={loadingContext}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
        >
          {loadingContext ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </>
          ) : (
            <>
              <Mail className="h-3.5 w-3.5" />
              Generate email
            </>
          )}
        </button>
      ) : (
        <div className="w-full rounded-xl border border-cyan-500/20 bg-slate-950/80 p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white">Personalize outreach</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {preview && (
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-slate-500">Lead</dt>
                <dd className="text-slate-200">
                  {preview.leadName} · {preview.leadRole}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Company</dt>
                <dd className="text-slate-200">{preview.leadCompany}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Industry</dt>
                <dd className="text-slate-200">
                  {preview.industry ?? "Not specified"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Tone</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {EMAIL_TONES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setTone(option);
                        const defaultForTone = templates.find(
                          (template) =>
                            template.tone === option && template.isDefault
                        );
                        setTemplateId(defaultForTone?.id ?? "");
                      }}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        tone === option
                          ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-200"
                          : "border-white/10 bg-slate-900 text-slate-400 hover:border-white/20 hover:text-slate-200"
                      }`}
                    >
                      {getToneLabel(option)}
                    </button>
                  ))}
                </dd>
              </div>
              {templates.filter((template) => template.tone === tone).length >
                0 && (
                <div>
                  <label
                    htmlFor={`template-${contactId}`}
                    className="text-slate-500"
                  >
                    Template
                  </label>
                  <select
                    id={`template-${contactId}`}
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/40 focus:outline-none"
                  >
                    <option value="">Built-in / AI default</option>
                    {templates
                      .filter((template) => template.tone === tone)
                      .map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.isDefault ? " (default)" : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor={`pain-points-${contactId}`} className="text-slate-500">
                  Pain points
                </label>
                <textarea
                  id={`pain-points-${contactId}`}
                  value={painPointsText}
                  onChange={(e) => setPainPointsText(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                  placeholder="One pain point per line"
                />
                <p className="mt-1 text-slate-600">
                  Auto-suggested from industry, role, and tech stack. Edit before generating.
                </p>
              </div>
            </dl>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !painPointsText.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-medium text-cyan-200 transition-colors hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Mail className="h-3.5 w-3.5" />
                Generate {getToneLabel(tone).toLowerCase()} draft
              </>
            )}
          </button>
        </div>
      )}

      {message && (
        <p className="max-w-xs text-right text-xs text-slate-400">{message}</p>
      )}
    </div>
  );
}
