import ThemedShell from "@/components/ThemedShell";
import { requireTeacher } from "@/lib/auth";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, profile } = await requireTeacher();
  return (
    <ThemedShell org={org} profile={profile}>
      {children}
    </ThemedShell>
  );
}
