import { SectionCard } from "@/components/ui/SectionCard";

interface DashboardSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardSection({
  title,
  description,
  action,
  children,
}: DashboardSectionProps) {
  return (
    <SectionCard title={title} description={description} action={action}>
      {children}
    </SectionCard>
  );
}
