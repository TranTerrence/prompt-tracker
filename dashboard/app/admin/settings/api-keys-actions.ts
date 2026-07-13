"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type CreateResult =
  | { ok: true; key: string; prefix: string }
  | { ok: false; message: string };

// Crée une clé API d'organisation. La clé en clair n'est JAMAIS stockée :
// générée ici, renvoyée une seule fois, hash SHA-256 en base (RLS admin).
export async function createApiKey(formData: FormData): Promise<CreateResult> {
  const { org, userId } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Donne un nom à la clé (ex. « SI pédagogique »)." };

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
