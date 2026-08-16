"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_CATEGORIES, type ConsentCategory } from "@/lib/types";

export type ConsentState = { error: string | null; saved: boolean };
export type PurgeState = { error: string | null; purged: number | null };

/**
 * Enregistre les choix de partage, catégorie par catégorie.
 *
 * Toute catégorie absente du formulaire est explicitement remise à false : un
 * décochage doit révoquer, pas être ignoré. La table `consents` porte la RLS
 * `consents_own` et le trigger `log_consent` tient le journal d'audit.
 */
export async function saveConsents(
  _prev: ConsentState,
  formData: FormData
): Promise<ConsentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnecte-toi.", saved: false };

  const rows = CONSENT_CATEGORIES.map((category: ConsentCategory) => ({
    user_id: user.id,
    category,
    granted: formData.get(category) === "on",
  }));

  const { error } = await supabase
    .from("consents")
    .upsert(rows, { onConflict: "user_id,category" });
  if (error) return { error: error.message, saved: false };

  revalidatePath("/me/donnees");
  return { error: null, saved: true };
}

/**
 * Droit à l'effacement. Efface le CONTENU déjà partagé (textes, raisonnements,
 * réflexions, clés de conversation) et conserve les indicateurs — c'est la
 * frontière annoncée partout ailleurs dans le produit.
 */
export async function purgeContent(): Promise<PurgeState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("purge_my_content");
  if (error) return { error: error.message, purged: null };
  const res = (data ?? {}) as { events_purged?: number; posts_purged?: number };
  revalidatePath("/me/donnees");
  revalidatePath("/me");
  return {
    error: null,
    purged: (res.events_purged ?? 0) + (res.posts_purged ?? 0),
  };
}
