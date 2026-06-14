"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Mail, Loader2, X } from "lucide-react";
import { getToneLabel } from "@/lib/email-generation/tone-guidance";
import { inputClassName, selectClassName } from "@/components/ui/Field";
import {
  alertErrorClassName,
  btnIconClassName,
  btnIconSmPrimaryClassName,
  btnSecondaryClassName,
  btnSmPrimaryClassName,
  cardClassName,
  hintClassName,
  labelClassName,
  pillActiveClassName,
  pillInactiveClassName,
} from "@/lib/ui/styles";
import type { EmailGenerationPreview, EmailTone } from "@/types/email-generation";
import { EMAIL_TONES } from "@/types/email-generation";

interface GenerateEmailButtonProps {
  contactId: string;
  leadName: string;
  hasEmail: boolean;
  followUpsPaused?: boolean;
  iconOnly?: boolean;
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
  iconOnly = false,
}: GenerateEmailButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<EmailGenerationPreview | null>(null);
  const [painPointsText, setPainPointsText] = useState("");
  const [tone, setTone] = useState<EmailTone>("professional");
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; tone: EmailTone; isDefault: boolean }>
  >([]);
  const [templateId, setTemplateId] = useState<string>("");

  function closePanel() {
    setOpen(false);
    setSaved(false);
    setFormError(null);
  }

  async function loadContext() {
    setLoadingContext(true);
    setToastMessage(null);
    setFormError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/emails/context?contactId=${contactId}`);
      const data = await res.json();

      if (!data.success) {
        setToastMessage(data.error?.message ?? "Failed to load lead context.");
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
      setToastMessage("Failed to load personalization context.");
    } finally {
      setLoadingContext(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setFormError(null);

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
        setFormError(data.error?.message ?? "Failed to generate email.");
        return;
      }

      setSaved(true);
    } catch {
      setFormError("Failed to connect to email generation service.");
    } finally {
      setLoading(false);
    }
  }

  const personalizePanel = open ? (
    <div
      role="dialog"
      aria-modal={iconOnly ? true : undefined}
      aria-labelledby={`personalize-title-${contactId}`}
      className={`${cardClassName} flex max-h-[min(90vh,40rem)] flex-col p-4 ${
        iconOnly ? "w-full max-w-md" : "w-full max-h-[70vh]"
      }`}
    >
      <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
        <p
          id={`personalize-title-${contactId}`}
          className="text-sm font-semibold text-gray-900"
        >
          {saved ? "Draft saved" : "Personalize outreach"}
        </p>
        <button
          type="button"
          onClick={closePanel}
          className={btnIconClassName}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {saved ? (
        <div className="flex flex-col items-center px-2 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-4 text-base font-semibold text-gray-900">
            Email draft ready
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
            <span className="font-medium text-gray-900">
              {getToneLabel(tone)}
            </span>{" "}
            outreach saved for{" "}
            <span className="font-medium text-gray-900">{leadName}</span>.
          </p>
          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
            <Link
              href="/emails"
              onClick={closePanel}
              className={`${btnSmPrimaryClassName} w-full justify-center`}
            >
              <Mail className="h-3.5 w-3.5" />
              View on Emails
            </Link>
            <button
              type="button"
              onClick={closePanel}
              className={`${btnSecondaryClassName} w-full justify-center`}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          {formError && (
            <div className={`mb-3 shrink-0 ${alertErrorClassName}`} role="alert">
              {formError}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
            {preview && (
          <dl className="space-y-2 text-xs">
            <div>
              <dt className={labelClassName}>Lead</dt>
              <dd className="break-words text-gray-900">
                {preview.leadName} · {preview.leadRole}
              </dd>
            </div>
            <div>
              <dt className={labelClassName}>Company</dt>
              <dd className="break-words text-gray-900">
                {preview.leadCompany}
              </dd>
            </div>
            <div>
              <dt className={labelClassName}>Industry</dt>
              <dd className="break-words text-gray-900">
                {preview.industry ?? "Not specified"}
              </dd>
            </div>
            <div>
              <dt className={labelClassName}>Tone</dt>
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
                    className={
                      tone === option
                        ? pillActiveClassName
                        : pillInactiveClassName
                    }
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
                  className={labelClassName}
                >
                  Template
                </label>
                <select
                  id={`template-${contactId}`}
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className={`mt-1 ${selectClassName}`}
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
              <label
                htmlFor={`pain-points-${contactId}`}
                className={labelClassName}
              >
                Pain points
              </label>
              <textarea
                id={`pain-points-${contactId}`}
                value={painPointsText}
                onChange={(e) => setPainPointsText(e.target.value)}
                rows={4}
                className={`mt-1 ${inputClassName}`}
                placeholder="One pain point per line"
              />
              <p className={`mt-1 ${hintClassName}`}>
                Auto-suggested from industry, role, and tech stack. Edit before
                generating.
              </p>
            </div>
          </dl>
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !painPointsText.trim()}
            className={`mt-4 w-full shrink-0 ${btnSmPrimaryClassName}`}
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
        </>
      )}
    </div>
  ) : null;

  if (!hasEmail) {
    if (iconOnly) {
      return (
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-300"
          title="No email on file"
          aria-label="No email on file"
        >
          <Mail className="h-4 w-4" />
        </span>
      );
    }
    return <p className={hintClassName}>No email — cannot generate outreach</p>;
  }

  if (followUpsPaused) {
    if (iconOnly) {
      return (
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-400"
          title="Follow-ups stopped — lead replied"
          aria-label="Follow-ups stopped — lead replied"
        >
          <Mail className="h-4 w-4" />
        </span>
      );
    }
    return (
      <p className="text-xs text-amber-700">Follow-ups stopped — lead replied</p>
    );
  }

  return (
    <div
      className={
        iconOnly
          ? "flex flex-col items-end gap-2"
          : "flex w-full max-w-sm flex-col items-end gap-2"
      }
    >
      <button
        type="button"
        onClick={loadContext}
        disabled={loadingContext}
        className={iconOnly ? btnIconSmPrimaryClassName : btnSmPrimaryClassName}
        aria-label={loadingContext ? "Loading email context" : "Generate email"}
        title="Generate email"
      >
        {loadingContext ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
      </button>

      {open && iconOnly && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]"
            onClick={closePanel}
            aria-label="Close personalize outreach"
          />
          <div className="relative z-10 w-full max-w-md">{personalizePanel}</div>
        </div>
      )}

      {open && !iconOnly && personalizePanel}

      {toastMessage && !open && (
        <div
          className="fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0"
          role="alert"
        >
          <div className={`${alertErrorClassName} shadow-lg`}>{toastMessage}</div>
        </div>
      )}
    </div>
  );
}
