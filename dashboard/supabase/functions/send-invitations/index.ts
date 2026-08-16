// Envoi des invitations de classe par e-mail.
//
// Canal SECONDAIRE, à dessein. Le canal principal est « copier les liens »
// dans le dashboard : il n'a aucune dépendance de délivrabilité et fonctionne
// le jour de la rentrée. Cette fonction n'est utile que si un fournisseur
// d'envoi est configuré ; sans `RESEND_API_KEY`, elle répond explicitement
// `email_not_configured` plutôt que d'échouer en silence — un envoi qui ne
// part pas sans le dire est précisément ce qu'on veut éviter partout ici.
//
// Elle porte la service_role pour pouvoir écrire `sent_at` / `send_error` sur
// des lignes que l'appelant n'a pas le droit de modifier directement.
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

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

function body(orgName: string, groupName: string, url: string) {
  const org = escapeHtml(orgName);
  const group = escapeHtml(groupName);
  return {
    subject: `${orgName} t'invite à rejoindre ${groupName}`,
    text:
      `Tu es invité à rejoindre ${groupName} (${orgName}) sur Prompt Tracker.\n\n` +
      `${url}\n\n` +
      `Ce lien est personnel et valable 30 jours. Il t'expliquera ce qui est partagé ` +
      `avant que tu décides quoi que ce soit : des indicateurs de progression, jamais ` +
      `le texte de tes prompts.\n`,
    html:
      `<p>Tu es invité à rejoindre <strong>${group}</strong> (${org}) sur Prompt Tracker.</p>` +
      `<p><a href="${url}">Rejoindre ma classe</a></p>` +
      `<p style="color:#6e655a;font-size:13px">Ce lien est personnel et valable 30 jours. ` +
      `Il t'expliquera ce qui est partagé avant que tu décides quoi que ce soit : des ` +
      `indicateurs de progression, jamais le texte de tes prompts.</p>`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("INVITATION_FROM") ?? "Prompt Tracker <onboarding@resend.dev>";
  if (!apiKey) {
    return json(
      {
        error: "email_not_configured",
        hint: "Aucun fournisseur d'envoi configuré. Utilise « Copier les liens » dans le dashboard.",
      },
      503,
    );
  }

  try {
    // L'appelant doit être un utilisateur connecté qui gère la classe. On
    // revérifie ici : cette fonction voit passer des adresses d'élèves.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

    const { group_id: groupId, invitations } = await req.json();
    if (typeof groupId !== "string" || !Array.isArray(invitations)) {
      return json({ error: "invalid_request" }, 400);
    }

    // Contrôle d'accès délégué au SQL, sous l'identité de l'appelant.
    const asCaller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: manages } = await asCaller.rpc("auth_manages_group", { p_group: groupId });
    if (!manages) return json({ error: "forbidden" }, 403);

    const { data: group } = await supabase
      .from("groups")
      .select("name, organizations(name, brand_name)")
      .eq("id", groupId)
      .single();
    const org = group?.organizations as { name: string; brand_name: string | null } | null;
    const orgName = org?.brand_name || org?.name || "Ton établissement";
    const groupName = group?.name ?? "ta classe";

    // Séquentiel, pas en parallèle : les fournisseurs d'envoi limitent le
    // débit, et une classe de 30 en rafale se fait jeter.
    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const inv of invitations.slice(0, 200)) {
      const { id, email, url } = inv ?? {};
      if (typeof email !== "string" || typeof url !== "string") continue;
      const content = body(orgName, groupName, url);
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: email, ...content }),
        });
        const ok = res.ok;
        const error = ok ? null : `${res.status} ${(await res.text()).slice(0, 200)}`;
        if (typeof id === "string") {
          await supabase
            .from("group_invitations")
            .update({ sent_at: ok ? new Date().toISOString() : null, send_error: error })
            .eq("id", id);
        }
        results.push({ email, ok, ...(error ? { error } : {}) });
      } catch (e) {
        results.push({ email, ok: false, error: String(e) });
      }
    }

    return json({ sent: results.filter((r) => r.ok).length, results });
  } catch {
    return json({ error: "send_failed" }, 500);
  }
});
