"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AcceptState = { error: string | null };

/**
 * Acceptation d'une invitation nominative.
 *
 * `p_baseline_ack: true` pour la même raison que sur /join/<CODE> : l'écran
 * qui appelle cette action a affiché la divulgation, le bouton EST l'acte
 * affirmatif, et le rattachement s'écrit avec l'accord dans une seule
 * transaction. Aucun chemin ne peut rattacher sans consentement.
 */
export async function acceptInvitation(
  _prev: AcceptState,
  formData: FormData
): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { error: "Lien incomplet." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", {
    p_token: token,
    p_baseline_ack: true,
  });

  if (error) {
    if (error.message.includes("email_mismatch"))
      return {
        error:
          "Cette invitation est nominative : connecte-toi avec l'adresse à laquelle elle a été envoyée.",
      };
    if (error.message.includes("invalid_invitation"))
      return { error: "Cette invitation a expiré, a été révoquée ou a déjà été utilisée." };
    if (error.message.includes("already_in_other_org"))
      return { error: "Ton compte est déjà rattaché à une autre organisation." };
    return { error: error.message };
  }

  redirect("/join/done");
}
