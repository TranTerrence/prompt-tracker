"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: boolean; message: string };

/**
 * Gestion du code de classe par son professeur.
 *
 * Les gardes réelles sont en SQL (`auth_manages_group`, migration 0020) :
 * admin de l'organisation OU professeur membre du groupe. Une garde
 * TypeScript plus stricte ne ferait que diverger de la règle qui compte, et
 * une plus laxiste ne protégerait rien — PostgREST est joignable directement.
 */
async function callRpc(
  fn: string,
  args: Record<string, unknown>,
  groupId: string,
  successMessage: string
): Promise<ActionResult> {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.message.includes("forbidden"))
      return { ok: false, message: "Tu ne gères pas cette classe." };
    return { ok: false, message: error.message };
  }
  revalidatePath(`/teacher/classe/${groupId}`);
  revalidatePath("/admin/users");
  return {
    ok: true,
    message: typeof data === "string" ? `${successMessage} ${data}` : successMessage,
  };
}

export async function regenerateCode(groupId: string) {
  return callRpc("regenerate_group_code", { p_group: groupId }, groupId, "Nouveau code :");
}

export async function setCodeActive(groupId: string, active: boolean) {
  return callRpc(
    "set_group_code_active",
    { p_group: groupId, p_active: active },
    groupId,
    active ? "Code activé." : "Code désactivé."
  );
}

export async function setCodeExpiry(groupId: string, date: string | null) {
  // Fin de journée locale : une date « valable jusqu'au 15 septembre » doit
  // inclure le 15 septembre entier, pas expirer à minuit le matin même.
  const expiresAt = date ? new Date(`${date}T23:59:59`).toISOString() : null;
  return callRpc(
    "set_group_code_expiry",
    { p_group: groupId, p_expires_at: expiresAt },
    groupId,
    date ? "Échéance enregistrée." : "Échéance retirée."
  );
}

export async function removeStudent(groupId: string, userId: string) {
  return callRpc(
    "remove_group_member",
    { p_group: groupId, p_user: userId },
    groupId,
    "Élève retiré de la classe."
  );
}
