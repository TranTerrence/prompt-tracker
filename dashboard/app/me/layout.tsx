import ThemedShell from "@/components/ThemedShell";
import { requireSession } from "@/lib/auth";

export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, profile } = await requireSession();
  return (
    <ThemedShell org={org} profile={profile}>
      {children}
    </ThemedShell>
  );
}
