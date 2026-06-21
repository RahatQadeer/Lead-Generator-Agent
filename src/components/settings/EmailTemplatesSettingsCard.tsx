"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { getToneLabel } from "@/lib/email-generation/tone-guidance";
import { inputClassName, selectClassName } from "@/components/ui/Field";
import { EMAIL_TONES, type EmailTone } from "@/types/email-generation";
import type {
  EmailTemplate,
  EmailTemplatePlaceholder,
} from "@/types/email-templates";

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

export function EmailTemplatesSettingsCard() {
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
        setError(data.error?.message ?? "Failed to load email templates.");
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
        setError(data.error?.message ?? "Failed to save template.");
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
        setError(data.error?.message ?? "Failed to delete template.");
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

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 sm:p-8 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
            <FileText className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Email templates
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Reusable outreach subject and body patterns
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20"
        >
          <Plus className="h-4 w-4" />
          New template
        </button>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading templates…
        </div>
      ) : (
        <>
          {placeholders.length > 0 && (
            <div className="mt-6 rounded-xl border border-white/5 bg-slate-950/40 p-4">
              <p className="text-xs font-medium text-slate-400">
                Available placeholders
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {placeholders.map((placeholder) => (
                  <span
                    key={placeholder.key}
                    title={placeholder.description}
                    className="rounded-full border border-white/10 bg-slate-900 px-2.5 py-1 text-xs text-slate-300"
                  >
                    {placeholder.key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {showForm && (
            <div className="mt-6 space-y-4 rounded-xl border border-cyan-500/20 bg-slate-950/50 p-4">
              <p className="text-sm font-medium text-white">
                {editingId ? "Edit template" : "Create template"}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="template-name" className="mb-2 block text-xs text-slate-400">
                    Name
                  </label>
                  <input
                    id="template-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClassName}
                    placeholder="Professional outreach"
                  />
                </div>
                <div>
                  <label htmlFor="template-tone" className="mb-2 block text-xs text-slate-400">
                    Tone
                  </label>
                  <select
                    id="template-tone"
                    value={form.tone}
                    onChange={(e) =>
                      setForm({ ...form, tone: e.target.value as EmailTone })
                    }
                    className={selectClassName}
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
                <label
                  htmlFor="template-subject"
                  className="mb-2 block text-xs text-slate-400"
                >
                  Subject template
                </label>
                <input
                  id="template-subject"
                  value={form.subjectTemplate}
                  onChange={(e) =>
                    setForm({ ...form, subjectTemplate: e.target.value })
                  }
                  className={inputClassName}
                />
              </div>

              <div>
                <label htmlFor="template-body" className="mb-2 block text-xs text-slate-400">
                  Body template
                </label>
                <textarea
                  id="template-body"
                  value={form.bodyTemplate}
                  onChange={(e) =>
                    setForm({ ...form, bodyTemplate: e.target.value })
                  }
                  rows={10}
                  className={`${inputClassName} font-mono text-xs`}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                  className="rounded border-white/20 bg-slate-900"
                />
                Set as default for this tone
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
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
                  className="text-sm text-slate-500 transition-colors hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {sortedTemplates.length === 0 ? (
              <p className="text-sm text-slate-500">
                No templates yet. Create one to customize outreach generation.
              </p>
            ) : (
              sortedTemplates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-xl border border-white/5 bg-slate-950/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {template.name}
                        {template.isDefault && (
                          <span className="ml-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getToneLabel(template.tone)} tone
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        Subject: {template.subjectTemplate}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(template)}
                        className="rounded-lg border border-white/10 p-2 text-slate-300 transition-colors hover:bg-white/5"
                        aria-label={`Edit ${template.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(template.id)}
                        disabled={saving}
                        className="rounded-lg border border-white/10 p-2 text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
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

          {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

          <p className="mt-3 text-xs text-slate-600">
            Default templates apply automatically when generating outreach. You can
            also pick a specific template on the Leads page.
          </p>
        </>
      )}
    </div>
  );
}
