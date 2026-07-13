import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile } from "@/lib/types";

export type SessionContext = {
  userId: string;
  profile: Profile;
  org: Organization;
};

/**
 * Récupère l'utilisateur connecté, son profil et son organisation.
 * Redirige vers /login si non connecté, vers /pending si non rattaché à une org.
 */
export async function requireSession(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile || !profile.org_id) redirect("/pending");

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.org_id)
    .maybeSingle<Organization>();

  if (!org) redirect("/pending");

  return { userId: user.id, profile, org };
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.profile.role !== "admin") redirect("/me");
  return ctx;
}

/**
 * Vue professeur : réservée au rôle teacher (l'admin a sa propre vue org-wide).
 * La RLS scope naturellement la lecture aux étudiants de ses groupes.
 */
export async function requireTeacher(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.profile.role === "admin") redirect("/admin");
  if (ctx.profile.role !== "teacher") redirect("/me");
  return ctx;
}
