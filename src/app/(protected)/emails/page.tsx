import { Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";

export default function EmailsPage() {
  return (
    <>
      <PageHeader
        icon={Mail}
        label="Emails"
        title="Outreach campaigns"
        description="Review AI-generated emails, edit before sending, and track delivery status."
      />
      <EmptyState
        icon={Mail}
        title="No emails yet"
        description="Once you have qualified leads, AI will draft personalized outreach emails ready for your review."
      />
    </>
  );
}
