"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: boolean; message: string };

/** Rattache à l'organisation un utilisateur existant (profil sans org) par e-mail. */
export async function attachUserByEmail(
  formData: FormData
): Promise<ActionResult> {
  const { org } = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Adresse e-mail requise." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ org_id: org.id })
    .eq("email", email)
    .is("org_id", null)
    .select("id");

  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      message:
        "Aucun profil sans organisation trouvé avec cette adresse. L'utilisateur doit d'abord créer son compte.",
    };
  }
  revalidatePath("/admin/users");
  return { ok: true, message: "Utilisateur rattaché à l'organisation." };
}

export async function setRole(
  userId: string,
  role: "admin" | "teacher" | "member"
): Promise<ActionResult> {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .eq("org_id", org.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  return { ok: true, message: "Rôle mis à jour." };
}

/** Régénère le code d'un groupe (l'ancien cesse immédiatement de fonctionner). */
export async function regenerateGroupCode(groupId: string): Promise<ActionResult> {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_group_code", {
    p_group: groupId,
  });
  void org;
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  return { ok: true, message: `Nouveau code : ${data}` };
}

export async function setGroupCodeActive(
  groupId: string,
  active: boolean
): Promise<ActionResult> {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({ join_code_active: active })
    .eq("id", groupId)
    .eq("org_id", org.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  return { ok: true, message: active ? "Code activé." : "Code désactivé." };
}

export async function setDisabled(
  userId: string,
  disabled: boolean
): Promise<ActionResult> {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ disabled })
    .eq("id", userId)
    .eq("org_id", org.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  return { ok: true, message: disabled ? "Compte désactivé." : "Compte activé." };
}

export async function createGroup(formData: FormData): Promise<ActionResult> {
  const { org } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Nom du groupe requis." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .insert({ org_id: org.id, name });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  return { ok: true, message: "Groupe créé." };
}

export async function addToGroup(
  groupId: string,
  userId: string
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, user_id: userId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  return { ok: true, message: "Membre ajouté au groupe." };
}

export async function removeFromGroup(
  groupId: string,
  userId: string
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  return { ok: true, message: "Membre retiré du groupe." };
}
