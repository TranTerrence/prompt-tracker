"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; message: string };

/**
 * Ajoute une origine autorisée à encadrer les widgets (`frame-ancestors`).
 *
 * Sans au moins une origine, tout widget répond `frame-ancestors 'none'` :
 * l'échec est fermé par défaut, jamais ouvert.
 */
export async function addEmbedOrigin(formData: FormData): Promise<Result> {
  const { org } = await requireAdmin();
  const raw = String(formData.get("origin") ?? "").trim();
  if (!raw) return { ok: false, message: "Indique une origine (ex. https://ent.mon-lycee.fr)." };

  // Une origine, c'est schéma + hôte + port. Un chemin ou une requête n'a pas
  // de sens dans frame-ancestors et masquerait une erreur de saisie.
  let origin: string;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return { ok: false, message: "Seul HTTPS est accepté (localhost excepté pour vos tests)." };
    }
    origin = url.origin;
  } catch {
    return { ok: false, message: "Origine invalide. Attendu : https://ent.mon-lycee.fr" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("org_embed_origins")
    .upsert({ org_id: org.id, origin }, { onConflict: "org_id,origin" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/settings");
  return { ok: true, message: `${origin} peut désormais afficher vos widgets.` };
}

export async function removeEmbedOrigin(origin: string): Promise<Result> {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("org_embed_origins")
    .delete()
    .eq("org_id", org.id)
    .eq("origin", origin);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/settings");
  return { ok: true, message: `${origin} ne peut plus afficher vos widgets.` };
}

/**
 * Rotation du secret de signature : invalide d'un coup TOUS les jetons
 * d'affichage vivants de l'organisation. Le geste d'urgence si un jeton fuite
 * ailleurs que par la révocation de la clé qui l'a frappé.
 */
export async function rotateEmbedSecret(): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_embed_secret");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: "Secret renouvelé : tous les widgets déjà affichés cessent de fonctionner.",
  };
}
