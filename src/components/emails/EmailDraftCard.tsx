import { getToneLabel } from "@/lib/email-generation/tone-guidance";
import { FollowUpStoppedBadge } from "@/components/emails/FollowUpStoppedBadge";
import { ReplyBadge } from "@/components/emails/ReplyBadge";
import { SendEmailButton } from "@/components/emails/SendEmailButton";
import type { SavedEmail } from "@/types/email-generation";
import type { EmailSendingProviderName } from "@/types/email-sending";

interface EmailDraftCardProps {
  email: SavedEmail;
  sendingProvider: EmailSendingProviderName;
}

export function EmailDraftCard({ email, sendingProvider }: EmailDraftCardProps) {
  const { personalization } = email;

  return (
    <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            {personalization.leadName}
            {personalization.leadRole ? ` · ${personalization.leadRole}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {personalization.leadCompany}
            {personalization.industry ? ` · ${personalization.industry}` : ""}
          </p>
          {email.recipientEmail && (
            <p className="mt-0.5 text-xs text-slate-500">To: {email.recipientEmail}</p>
          )}
          <p className="mt-0.5 text-xs text-slate-600">
            {email.provider}
            {email.model ? ` · ${email.model}` : ""}
            {email.sentAt
              ? ` · Sent ${new Date(email.sentAt).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
            {getToneLabel(personalization.tone)}
          </span>
          <ReplyBadge
            replyStatus={email.replyStatus}
            repliedAt={email.repliedAt}
          />
          {email.replyStatus === "replied" && (
            <FollowUpStoppedBadge reason="replied" />
          )}
          <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs capitalize text-slate-300">
            {email.status}
          </span>
        </div>
      </div>

      {email.replySnippet && email.replyStatus === "replied" && (
        <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
          <p className="text-xs font-medium text-sky-400">Reply preview</p>
          <p className="mt-1 text-sm text-slate-300">{email.replySnippet}</p>
        </div>
      )}

      {personalization.painPoints.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">Pain points addressed</p>
          <ul className="mt-1 space-y-1">
            {personalization.painPoints.map((point) => (
              <li key={point} className="text-xs text-slate-400">
                · {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-sm font-medium text-cyan-300">{email.subject}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
        {email.body}
      </p>

      {email.status === "draft" && (
        <div className="mt-4 flex justify-end border-t border-white/5 pt-4">
          <SendEmailButton
            emailId={email.id}
            recipientEmail={email.recipientEmail}
            sendingProvider={sendingProvider}
          />
        </div>
      )}
    </article>
  );
}
