import { createHash } from "crypto";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const JOIN_COOKIE = "pt_join";
const JOIN_COOKIE_MAX_AGE = 3600; // 1 h : le temps d'une inscription + confirmation

export type JoinTarget = {
  org_name: string;
  group_name: string;
  brand_color: string | null;
  logo_url: string | null;
};

/**
 * Seau de limitation par appelant. Postgres ne voit pas l'IP (toutes les
 * requêtes arrivent par le même pool), c'est donc à la route de la fournir.
 * Hashée avec le jour : jamais d'IP en clair en base, et le seau tourne seul.
 */
export async function bucketOf(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${day}`).digest("hex").slice(0, 32);
}

/**
 * Résout un code de classe en « tu rejoins X chez Y », sans jamais exposer
 * d'identifiant ni d'effectif. Appelée UNIQUEMENT côté serveur : le navigateur
 * n'atteint pas la RPC, sinon la limitation par IP n'aurait aucun sens.
 *
 * Renvoie null pour tout code non exploitable — inexistant, désactivé ou
 * expiré sont indistinguables par conception.
 */
export async function resolveJoinCode(
  code: string
): Promise<{ target: JoinTarget | null; rateLimited: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("peek_join_code", {
    p_code: code,
    p_bucket: await bucketOf(),
  });
  if (error) {
    return { target: null, rateLimited: error.message.includes("rate_limited") };
  }
  return { target: data as JoinTarget, rateLimited: false };
}

/** Normalisation d'affichage et de saisie : majuscules, sans espaces. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Mémorise la classe visée pendant l'inscription.
 *
 * Le cookie est le porteur le plus robuste des trois : il survit à la
 * confirmation d'e-mail Supabase (retour par navigation top-level, SameSite
 * Lax passe), là où un paramètre d'URL se perd. httpOnly : aucun script de
 * page n'a de raison de le lire.
 */
export async function rememberJoinCode(code: string) {
  const jar = await cookies();
  jar.set(JOIN_COOKIE, normalizeCode(code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: JOIN_COOKIE_MAX_AGE,
  });
}

export async function readJoinCode(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(JOIN_COOKIE)?.value || null;
}

export async function clearJoinCode() {
  const jar = await cookies();
  jar.delete(JOIN_COOKIE);
}
