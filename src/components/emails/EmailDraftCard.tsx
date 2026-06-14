import { getToneLabel } from "@/lib/email-generation/tone-guidance";
import { formatReplySnippetForDisplay } from "@/lib/reply-tracking/extract-reply-text";
import { FollowUpStoppedBadge } from "@/components/emails/FollowUpStoppedBadge";
import { ReplyBadge } from "@/components/emails/ReplyBadge";
import { SendEmailButton } from "@/components/emails/SendEmailButton";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { getProfileDisplayName } from "@/lib/profile/initials";
import type { SenderProfile } from "@/lib/profile/initials";
import { textPrimaryClassName, textSecondaryClassName } from "@/lib/ui/styles";
import type { SavedEmail } from "@/types/email-generation";
import type { EmailSendingProviderName } from "@/types/email-sending";

interface EmailDraftCardProps {
  email: SavedEmail;
  sendingProvider: EmailSendingProviderName;
  sender: SenderProfile;
}

export function EmailDraftCard({
  email,
  sendingProvider,
  sender,
}: EmailDraftCardProps) {
  const { personalization } = email;
  const senderName = getProfileDisplayName(sender);

  return (
    <article className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <UserAvatar
            email={email.recipientEmail ?? `${personalization.leadName}@lead.local`}
            fullName={personalization.leadName}
            size="md"
            ringClassName="ring-2 ring-gray-100"
          />
          <div className="min-w-0 flex-1">
          <p className="break-words font-semibold text-gray-900">
            {personalization.leadName}
          </p>
          <p className={`mt-0.5 break-words text-sm ${textSecondaryClassName}`}>
            {personalization.leadRole}
            {personalization.leadCompany
              ? ` · ${personalization.leadCompany}`
              : ""}
          </p>
          {email.recipientEmail && (
            <p className={`mt-1 break-all text-sm ${textSecondaryClassName}`}>
              {email.recipientEmail}
            </p>
          )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            {getToneLabel(personalization.tone)}
          </span>
          <ReplyBadge
            replyStatus={email.replyStatus}
            repliedAt={email.repliedAt}
          />
          {email.replyStatus === "replied" && (
            <FollowUpStoppedBadge reason="replied" />
          )}
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-600">
            {email.status}
          </span>
        </div>
      </div>

      {email.replySnippet && email.replyStatus === "replied" && (
        <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">
            Reply
          </p>
          <p className={`mt-1 break-words text-sm ${textPrimaryClassName}`}>
            {formatReplySnippetForDisplay(email.replySnippet)}
          </p>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
        <div className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-3">
          <UserAvatar
            email={sender.email}
            fullName={sender.full_name}
            avatarUrl={sender.avatar_url}
            size="xs"
            ringClassName="ring-1 ring-white"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Sending as
            </p>
            <p className="truncate text-xs font-medium text-gray-800">
              {senderName}
              <span className="font-normal text-gray-500"> · {sender.email}</span>
            </p>
          </div>
        </div>
        <p className="break-words text-sm font-semibold text-gray-900">
          {email.subject}
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600">
          {email.body}
        </p>
      </div>

      {(personalization.painPoints.length > 0 ||
        email.provider ||
        email.model ||
        email.sentAt) && (
        <div className="mt-3 space-y-2">
          {personalization.painPoints.length > 0 && (
            <p className="rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs leading-relaxed text-violet-800">
              <span className="font-semibold text-violet-600">Pain points · </span>
              {personalization.painPoints.join(" · ")}
            </p>
          )}

          <p className="rounded-lg border border-stone-200/70 bg-stone-50/90 px-3 py-2 text-xs text-stone-500">
            {email.provider}
            {email.model ? ` · ${email.model}` : ""}
            {email.sentAt
              ? ` · Sent ${new Date(email.sentAt).toLocaleDateString()}`
              : ""}
          </p>
        </div>
      )}

      {email.status === "draft" && (
        <div className="mt-4 flex justify-end">
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
