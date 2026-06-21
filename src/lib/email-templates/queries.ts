import { parseEmailTone } from "@/lib/email-generation/parse-tone";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { EmailTone } from "@/types/email-generation";
import type { EmailTemplate, EmailTemplateInput } from "@/types/email-templates";

type EmailTemplateRow = Database["public"]["Tables"]["email_templates"]["Row"];

function toTemplate(row: EmailTemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    tone: parseEmailTone(row.tone) ?? "professional",
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEmailTemplates(userId: string): Promise<EmailTemplate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("user_id", userId)
    .order("tone")
    .order("name");

  if (error || !data) {
    console.error("Failed to list email templates:", error?.message);
    return [];
  }

  return data.map(toTemplate);
}

export async function getEmailTemplateById(
  userId: string,
  templateId: string
): Promise<EmailTemplate | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("user_id", userId)
    .eq("id", templateId)
    .single();

  if (error || !data) return null;

  return toTemplate(data);
}

export async function getDefaultEmailTemplateForTone(
  userId: string,
  tone: EmailTone
): Promise<EmailTemplate | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("user_id", userId)
    .eq("tone", tone)
    .eq("is_default", true)
    .maybeSingle();

  if (error || !data) return null;

  return toTemplate(data);
}

async function clearDefaultForTone(
  userId: string,
  tone: EmailTone,
  excludeId?: string
): Promise<void> {
  const supabase = await createClient();

  let query = supabase
    .from("email_templates")
    .update({
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("tone", tone)
    .eq("is_default", true);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to clear default email template:", error.message);
  }
}

export async function createEmailTemplate(
  userId: string,
  input: EmailTemplateInput
): Promise<EmailTemplate | null> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (input.isDefault) {
    await clearDefaultForTone(userId, input.tone);
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      tone: input.tone,
      subject_template: input.subjectTemplate.trim(),
      body_template: input.bodyTemplate.trim(),
      is_default: Boolean(input.isDefault),
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to create email template:", error?.message);
    return null;
  }

  return toTemplate(data);
}

export async function updateEmailTemplate(
  userId: string,
  templateId: string,
  input: EmailTemplateInput
): Promise<EmailTemplate | null> {
  const supabase = await createClient();

  if (input.isDefault) {
    await clearDefaultForTone(userId, input.tone, templateId);
  }

  const { data, error } = await supabase
    .from("email_templates")
    .update({
      name: input.name.trim(),
      tone: input.tone,
      subject_template: input.subjectTemplate.trim(),
      body_template: input.bodyTemplate.trim(),
      is_default: Boolean(input.isDefault),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", templateId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to update email template:", error?.message);
    return null;
  }

  return toTemplate(data);
}

export async function deleteEmailTemplate(
  userId: string,
  templateId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("user_id", userId)
    .eq("id", templateId);

  if (error) {
    console.error("Failed to delete email template:", error.message);
    return false;
  }

  return true;
}
