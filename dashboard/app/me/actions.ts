"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AckState = { error: string | null };

/**
 * Accepte le socle de partage (indicateurs, jamais de contenu) a posteriori.
 *
 * Chemin d'un compte rattaché par un administrateur : il n'est jamais passé
 * par l'écran de divulgation d'une jonction, donc `baseline_consent_at` est
 * nul et l'extension ne pousse rien. Ce bouton est le seul moyen de le lever
 * depuis le web ; l'extension a le sien.
 */
export async function ackBaseline(): Promise<AckState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ack_baseline_consent", { p_version: 1 });
  if (error) {
    if (error.message.includes("no_org"))
      return { error: "Ton compte n'est rattaché à aucune classe." };
    return { error: error.message };
  }
  revalidatePath("/me");
  return { error: null };
}
