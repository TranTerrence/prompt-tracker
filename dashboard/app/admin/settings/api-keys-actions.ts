"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SCOPE_VALUES } from "@/lib/api-scopes";

type CreateResult =
  | { ok: true; key: string; prefix: string }
  | { ok: false; message: string };

// Crée une clé API d'organisation. La clé en clair n'est JAMAIS stockée :
// générée ici, renvoyée une seule fois, hash SHA-256 en base (RLS admin).
export async function createApiKey(formData: FormData): Promise<CreateResult> {
  const { org, userId } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Donne un nom à la clé (ex. « SI pédagogique »)." };

  // Les scopes n'étaient jamais écrits : toute clé héritait du défaut de la
  // colonne, et il n'existait aucune interface pour les choisir. La liste est
  // filtrée contre la liste blanche — un scope arbitraire posté à la main ne
  // doit pas atterrir en base.
  const scopes = formData
    .getAll("scopes")
    .map(String)
    .filter((s) => SCOPE_VALUES.includes(s));
  if (scopes.length === 0)
    return { ok: false, message: "Choisis au moins une permission." };

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(32);
  let secret = "";
  for (const b of bytes) secret += alphabet[b % alphabet.length];
  const key = `pt_live_${secret}`;
  const prefix = key.slice(0, 12);

  const supabase = await createClient();
  const { error } = await supabase.from("org_api_keys").insert({
    org_id: org.id,
    name,
    key_hash: createHash("sha256").update(key).digest("hex"),
    key_prefix: prefix,
    scopes,
    created_by: userId,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/settings");
  return { ok: true, key, prefix };
}

export async function revokeApiKey(
  keyId: string
): Promise<{ ok: boolean; message: string }> {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("org_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("org_id", org.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/settings");
  return { ok: true, message: "Clé révoquée : elle cesse de fonctionner immédiatement." };
}
