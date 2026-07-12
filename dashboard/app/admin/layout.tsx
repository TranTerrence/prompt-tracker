import ThemedShell from "@/components/ThemedShell";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, profile } = await requireAdmin();
  return (
    <ThemedShell org={org} profile={profile}>
      {children}
    </ThemedShell>
  );
}
