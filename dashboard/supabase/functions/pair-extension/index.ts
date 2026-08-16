// Échange une demande d'appairage APPROUVÉE contre un jeton de session pour
// l'extension. Deuxième et dernière fonction à porter la service_role (comme
// socratic-llm) : elle en a besoin pour `auth.admin.generateLink`, qui est la
// seule façon de fabriquer une session sans mot de passe.
//
// Ce qui sort d'ici : un `token_hash` à usage unique et l'e-mail du compte.
// L'extension échange elle-même ce hash contre une session via
// POST /auth/v1/verify. La service_role ne quitte jamais cette fonction et
// aucun refresh token n'y transite.
//
// L'appelant est un service worker d'extension (origine `chrome-extension://`
// variable selon l'installation) : restreindre l'origine n'aurait pas de sens.
// Le contrôle d'accès repose entièrement sur la connaissance du device_code,
// qui n'a de valeur qu'associé à une approbation faite par un utilisateur
// connecté sur le web.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { device_code: deviceCode } = await req.json();
    if (typeof deviceCode !== "string" || deviceCode.length < 32) {
      return json({ error: "invalid_device_code" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Consommation atomique : le filtre `redeemed_at is null` est DANS
    // l'update, donc deux appels concurrents avec le même device_code ne
    // peuvent pas produire deux sessions. Lire puis écrire laisserait une
    // fenêtre de rejeu.
    const { data: rows, error } = await supabase
      .from("pairing_requests")
      .update({ redeemed_at: new Date().toISOString() })
      .eq("device_code_hash", await sha256Hex(deviceCode))
      .is("redeemed_at", null)
      .not("approved_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .select("approved_by")
      .limit(1);

    if (error) return json({ error: "pairing_failed" }, 500);
    const approvedBy = rows?.[0]?.approved_by;
    // Indifférencié à dessein : inexistant, non approuvé, expiré et déjà
    // consommé donnent la même réponse. L'extension distingue déjà ces cas via
    // redeem_pairing, qui ne délivre aucun jeton.
    if (!approvedBy) return json({ error: "not_approved" }, 403);

    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(approvedBy);
    if (userError || !userData.user?.email) return json({ error: "pairing_failed" }, 500);

    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });
    if (linkError || !link.properties?.hashed_token) {
      return json({ error: "pairing_failed" }, 500);
    }

    return json({
      token_hash: link.properties.hashed_token,
      email: userData.user.email,
    });
  } catch {
    return json({ error: "pairing_failed" }, 500);
  }
});
