"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clearJoinCode, normalizeCode, rememberJoinCode } from "@/lib/join";

export type JoinActionState = { error: string | null };

/**
 * L'élève n'a pas de compte : on mémorise la classe et on l'envoie s'inscrire.
 * Le code voyage par trois porteurs redondants (cookie httpOnly, redirection
 * de confirmation d'e-mail, paramètre d'URL) parce qu'aucun des trois ne
 * survit à tous les parcours d'inscription.
 */
export async function startJoin(code: string) {
  await rememberJoinCode(code);
  redirect(`/login?join=${encodeURIComponent(normalizeCode(code))}&mode=signup`);
}

/**
 * Rattachement effectif. `p_baseline_ack: true` : l'écran qui appelle cette
 * action a affiché la divulgation, le bouton EST l'acte affirmatif. L'accord
 * et le rattachement sont écrits dans la même transaction — c'est ce couplage
 * qui empêche de se retrouver rattaché sans rien qui remonte.
 */
export async function confirmJoin(
  _prev: JoinActionState,
  formData: FormData
): Promise<JoinActionState> {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!code) return { error: "Code manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_group_with_code", {
    p_code: code,
    p_baseline_ack: true,
  });

  if (error) {
    if (error.message.includes("invalid_code"))
      return { error: "Ce code n'est plus valide. Demande le lien à jour à ton enseignant." };
    if (error.message.includes("already_in_other_org"))
      return { error: "Ton compte est déjà rattaché à une autre organisation." };
    if (error.message.includes("rate_limited"))
      return { error: "Trop de tentatives. Réessaie dans une heure." };
    return { error: error.message };
  }

  await clearJoinCode();
  redirect("/join/done");
}
