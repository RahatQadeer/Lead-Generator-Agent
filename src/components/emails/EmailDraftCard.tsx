import type { SavedEmail } from "@/types/email-generation";

interface EmailDraftCardProps {
  email: SavedEmail;
}

export function EmailDraftCard({ email }: EmailDraftCardProps) {
  return (
    <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{email.leadName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {email.provider}
            {email.model ? ` · ${email.model}` : ""}
          </p>
        </div>
        <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs capitalize text-slate-300">
          {email.status}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-cyan-300">{email.subject}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
        {email.body}
      </p>
    </article>
  );
}
