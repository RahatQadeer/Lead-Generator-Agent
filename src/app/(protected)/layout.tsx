import { AppShell } from "@/components/layout/AppShell";
import { getAuthContext } from "@/lib/auth/get-auth-context";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getAuthContext();

  return <AppShell profile={profile}>{children}</AppShell>;
}
