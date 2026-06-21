"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { getToneLabel } from "@/lib/email-generation/tone-guidance";
import { inputClassName, selectClassName } from "@/components/ui/Field";
import { SettingsCard } from "@/components/ui/SettingsCard";
import {
  alertErrorClassName,
  alertSuccessClassName,
  btnGhostClassName,
  btnIconClassName,
  btnPrimaryClassName,
  btnSmPrimaryClassName,
  hintClassName,
  labelClassName,
  tagDefaultClassName,
  textSecondaryClassName,
} from "@/lib/ui/styles";
import { EMAIL_TONES, type EmailTone } from "@/types/email-generation";
import type {
  EmailTemplate,
  EmailTemplatePlaceholder,
} from "@/types/email-templates";
import { getApiErrorMessage } from "@/lib/ui/user-messages";

interface TemplateFormState {
  name: string;
  tone: EmailTone;
  subjectTemplate: string;
  bodyTemplate: string;
  isDefault: boolean;
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  tone: "professional",
  subjectTemplate: "Partnership idea for {{company}}",
  bodyTemplate: [
    "Hi {{firstName}},",
    "",
    "I came across {{company}} and was impressed by what your team is building in {{industry}}.",
    "",
    "Many {{leadRole}}s I speak with are focused on {{painPoint}}. That is exactly where {{sender}} helps.",
    "",
    "Would you be open to a brief call next week?",
    "",
    "Best regards,",
    "{{sender}}",
  ].join("\n"),
  isDefault: false,
};

const TONE_ACCENT: Record<EmailTone, string> = {
  professional: "border-l-violet-400",
  friendly: "border-l-emerald-400",
  formal: "border-l-sky-400",
  direct: "border-l-amber-400",
};

interface EmailTemplatesSettingsCardProps {
  embedded?: boolean;
}

export function EmailTemplatesSettingsCard({
  embedded = false,
}: EmailTemplatesSettingsCardProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [placeholders, setPlaceholders] = useState<EmailTemplatePlaceholder[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((a, b) =>
        a.tone === b.tone ? a.name.localeCompare(b.name) : a.tone.localeCompare(b.tone)
      ),
    [templates]
  );

  async function loadTemplates() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/email-templates");
      const data = await res.json();

      if (!data.success) {
        setError(getApiErrorMessage(data.error, "Failed to load email templates."));
        return;
      }

      setTemplates(data.templates);
      setPlaceholders(data.placeholders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setMessage(null);
    setError(null);
  }

  function openEditForm(template: EmailTemplate) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      tone: template.tone,
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
      isDefault: template.isDefault,
    });
    setShowForm(true);
    setMessage(null);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(
        editingId ? `/api/email-templates/${editingId}` : "/api/email-templates",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();

      if (!data.success) {
        setError(getApiErrorMessage(data.error, "Failed to save template."));
        return;
      }

      await loadTemplates();
      closeForm();
      setMessage(editingId ? "Template updated." : "Template created.");
    } catch {
      setError("Failed to save email template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(templateId: string) {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/email-templates/${templateId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!data.success) {
        setError(getApiErrorMessage(data.error, "Failed to delete template."));
        return;
      }

      await loadTemplates();
      if (editingId === templateId) closeForm();
      setMessage("Template deleted.");
    } catch {
      setError("Failed to delete email template.");
    } finally {
      setSaving(false);
    }
  }

  const content = loading ? (
    <div className={`flex items-center gap-2 ${textSecondaryClassName}`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading templates…
    </div>
  ) : (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className={`${hintClassName} min-w-0`}>
          {templates.length} template{templates.length === 1 ? "" : "s"} · defaults
          apply per tone when generating outreach
        </p>
        <button
          type="button"
          onClick={openCreateForm}
          className={btnSmPrimaryClassName}
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      {placeholders.length > 0 && (
        <div className="mt-4 rounded-xl border border-cyan-100/80 bg-gradient-to-br from-cyan-50/40 to-white p-4">
          <p className={labelClassName}>Placeholders</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {placeholders.map((placeholder) => (
              <span
                key={placeholder.key}
                title={placeholder.description}
                className={`${tagDefaultClassName} !bg-white`}
              >
                {placeholder.key}
              </span>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-gray-50/40 p-4 sm:p-5">
          <p className="text-sm font-semibold text-gray-900">
            {editingId ? "Edit template" : "Create template"}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="template-name" className={labelClassName}>
                Name
              </label>
              <input
                id="template-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`mt-2 ${inputClassName}`}
                placeholder="Professional outreach"
              />
            </div>
            <div>
              <label htmlFor="template-tone" className={labelClassName}>
                Tone
              </label>
              <select
                id="template-tone"
                value={form.tone}
                onChange={(e) =>
                  setForm({ ...form, tone: e.target.value as EmailTone })
                }
                className={`mt-2 ${selectClassName}`}
              >
                {EMAIL_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {getToneLabel(tone)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="template-subject" className={labelClassName}>
              Subject template
            </label>
            <input
              id="template-subject"
              value={form.subjectTemplate}
              onChange={(e) =>
                setForm({ ...form, subjectTemplate: e.target.value })
              }
              className={`mt-2 ${inputClassName}`}
            />
          </div>

          <div>
            <label htmlFor="template-body" className={labelClassName}>
              Body template
            </label>
            <textarea
              id="template-body"
              value={form.bodyTemplate}
              onChange={(e) =>
                setForm({ ...form, bodyTemplate: e.target.value })
              }
              rows={8}
              className={`mt-2 ${inputClassName} font-mono text-xs`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) =>
                setForm({ ...form, isDefault: e.target.checked })
              }
              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500/20"
            />
            Set as default for this tone
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className={btnPrimaryClassName}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save template"
              )}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className={btnGhostClassName}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {sortedTemplates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-gray-700">No templates yet</p>
            <p className={`mt-1 ${hintClassName}`}>
              Create one to customize how outreach emails are composed.
            </p>
          </div>
        ) : (
          sortedTemplates.map((template) => (
            <div
              key={template.id}
              className={`group relative overflow-hidden rounded-xl border border-gray-100 border-l-4 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${
                TONE_ACCENT[template.tone] ?? "border-l-gray-300"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold text-gray-900">
                      {template.name}
                    </p>
                    {template.isDefault && (
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    {getToneLabel(template.tone)} tone
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">
                    {template.subjectTemplate}
                  </p>
                </div>
                <div className="flex gap-1 opacity-100 sm:opacity-70 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEditForm(template)}
                    className={btnIconClassName}
                    aria-label={`Edit ${template.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Delete ${template.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
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
      icon={FileText}
      iconClassName="bg-cyan-50 text-cyan-600"
      title="Email templates"
      description="Reusable outreach subject and body patterns"
    >
      {content}
    </SettingsCard>
  );
}
