"use server";

import { createClient } from "@/lib/supabase/server";

export type PairState = { error: string | null; approved: boolean };

/**
 * Autorise le navigateur qui a ouvert la demande.
 *
 * L'utilisateur est nécessairement connecté ici (la page est derrière le
 * proxy) : c'est ce qui donne sa valeur au geste. Le code seul, sans session
 * authentifiée, n'ouvre rien.
 */
export async function approvePairing(
  _prev: PairState,
  formData: FormData
): Promise<PairState> {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return { error: "Code d'appairage manquant.", approved: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_pairing", { p_user_code: code });

  if (error) {
    if (error.message.includes("invalid_pairing_code"))
      return {
        error:
          "Cette demande a expiré ou a déjà été utilisée. Relance « Lier mon compte » depuis l'extension.",
        approved: false,
      };
    if (error.message.includes("rate_limited"))
      return { error: "Trop de tentatives. Réessaie dans une heure.", approved: false };
    return { error: error.message, approved: false };
  }
  return { error: null, approved: true };
}
