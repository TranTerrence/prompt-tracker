"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error: string | null };

// Rattachement par code de classe : la RPC security definer fait le travail
// atomiquement (org + groupe) et le verrou protect_profile_fields empêche
// tout autre chemin de modification.
export async function joinWithCode(
  _prev: JoinState,
  formData: FormData
): Promise<JoinState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Saisis le code de ta classe." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_group_with_code", { p_code: code });

  if (error) {
    if (error.message.includes("invalid_code"))
      return { error: "Code invalide, désactivé ou expiré." };
    if (error.message.includes("already_in_other_org"))
      return { error: "Ton compte est déjà rattaché à une autre organisation." };
    return { error: error.message };
  }
  redirect("/me");
}
