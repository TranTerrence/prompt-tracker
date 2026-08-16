"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  invitationUrl,
  originOf,
  parseRoster,
  type InviteOutcome,
} from "@/lib/invitations";

export type InviteResult = {
  ok: boolean;
  message: string;
  outcomes: InviteOutcome[];
};

/**
 * Invite une liste d'adresses à une classe.
 *
 * Pas de `requireAdmin` : l'autorisation est portée par `auth_manages_group`
 * en SQL (admin de l'org OU professeur du groupe), donc une garde TypeScript
 * plus restrictive ne ferait que diverger. `requireSession` suffit à écarter
 * les visiteurs.
 *
 * Les jetons ne sont renvoyés qu'ICI, une seule fois : la base n'en garde que
 * le hash. D'où le retour immédiat des liens complets — c'est la dernière
 * occasion de les copier.
 */
export async function inviteToGroup(
  groupId: string,
  roster: string,
  ttlDays = 30
): Promise<InviteResult> {
  await requireSession();
  const { emails, names } = parseRoster(roster);
  if (emails.length === 0)
    return { ok: false, message: "Aucune adresse trouvée.", outcomes: [] };
  if (emails.length > 200)
    return {
      ok: false,
      message: `${emails.length} adresses : le maximum est de 200 par envoi.`,
      outcomes: [],
    };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitations", {
    p_group: groupId,
    p_emails: emails,
    p_names: names,
    p_ttl_days: ttlDays,
  });

  if (error) {
    if (error.message.includes("forbidden"))
      return { ok: false, message: "Tu ne gères pas cette classe.", outcomes: [] };
    return { ok: false, message: error.message, outcomes: [] };
  }

  const origin = await originOf();
  const rows = (data ?? []) as { email: string; status: string; token?: string }[];
  const outcomes: InviteOutcome[] = rows.map((r) => ({
    email: r.email,
    status: r.status as InviteOutcome["status"],
    url: r.token ? invitationUrl(origin, r.token) : undefined,
  }));

  const invited = outcomes.filter((o) => o.status === "invited").length;
  revalidatePath("/admin/users");
  revalidatePath(`/teacher/classe/${groupId}`);
  return {
    ok: true,
    message: `${invited} invitation(s) créée(s) sur ${outcomes.length} ligne(s).`,
    outcomes,
  };
}

export async function revokeInvitation(id: string, groupId: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_id: id });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  revalidatePath(`/teacher/classe/${groupId}`);
  return { ok: true, message: "Invitation révoquée." };
}

/**
 * Relance : génère un NOUVEAU jeton (l'ancien cesse de fonctionner) et renvoie
 * le lien à jour. Un lien relancé remplace le précédent, il ne s'y ajoute pas.
 */
export async function resendInvitation(
  id: string,
  groupId: string
): Promise<{ ok: boolean; message: string; url?: string }> {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resend_invitation", { p_id: id });
  if (error) return { ok: false, message: error.message };
  const row = data as { email: string; token: string };
  revalidatePath("/admin/users");
  revalidatePath(`/teacher/classe/${groupId}`);
  return {
    ok: true,
    message: `Nouveau lien pour ${row.email}.`,
    url: invitationUrl(await originOf(), row.token),
  };
}
