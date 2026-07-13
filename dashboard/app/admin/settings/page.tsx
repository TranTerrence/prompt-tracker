import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OrgDataRequest, SocraticTemplate } from "@/lib/types";
import SettingsForm from "./settings-form";
import ApiKeysPanel, { type ApiKeyRow } from "./api-keys-panel";

export default async function AdminSettingsPage() {
  const { org } = await requireAdmin();
  const supabase = await createClient();

  const [{ data: templates }, { data: dataRequests }, { data: apiKeys }] =
    await Promise.all([
      supabase
        .from("socratic_templates")
        .select("id, org_id, key, question, active")
        .eq("org_id", org.id),
      supabase
        .from("org_data_requests")
        .select("org_id, category, requested, purpose")
        .eq("org_id", org.id),
      supabase
        .from("org_api_keys")
        .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Paramètres
      </h1>
      <SettingsForm
        org={org}
        templates={(templates ?? []) as SocraticTemplate[]}
        dataRequests={(dataRequests ?? []) as OrgDataRequest[]}
      />
      <ApiKeysPanel keys={(apiKeys ?? []) as ApiKeyRow[]} />
    </div>
  );
}
