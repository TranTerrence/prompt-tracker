import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SocraticTemplate } from "@/lib/types";
import SettingsForm from "./settings-form";

export default async function AdminSettingsPage() {
  const { org } = await requireAdmin();
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("socratic_templates")
    .select("id, org_id, key, question, active")
    .eq("org_id", org.id);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Paramètres
      </h1>
      <SettingsForm org={org} templates={(templates ?? []) as SocraticTemplate[]} />
    </div>
  );
}
