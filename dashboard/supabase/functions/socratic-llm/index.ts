// Génère la PROCHAINE question socratique d'un dialogue itératif (une seule),
// à partir du prompt initial et de tout l'échange déjà mené.
// Appelé par l'extension seulement si l'organisation a activé llm_enabled.
// Le texte du prompt et du dialogue transitent ici mais ne sont JAMAIS stockés.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, disabled, organizations(llm_enabled)")
      .eq("id", userData.user.id)
      .single();
    const org = profile?.organizations as { llm_enabled: boolean } | null;
    if (!profile || profile.disabled || !org?.llm_enabled) {
      return new Response(JSON.stringify({ error: "llm_disabled" }), { status: 403, headers: cors });
    }

    const { prompt, dialogue } = await req.json();
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000) {
      return new Response(JSON.stringify({ error: "invalid_prompt" }), { status: 400, headers: cors });
    }
    const rounds: { question: string; answer: string }[] = Array.isArray(dialogue) ? dialogue.slice(0, 30) : [];

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "llm_not_configured" }), { status: 503, headers: cors });
    }

    const transcript = rounds
      .map((r) => `Q: ${String(r.question).slice(0, 500)}\nR: ${String(r.answer || "(passée)").slice(0, 1000)}`)
      .join("\n");
    const userContent = `Demande initiale de l'utilisateur à l'IA :\n${prompt}\n\nDialogue socratique déjà mené :\n${transcript || "(aucun échange encore)"}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 150,
        system:
          "Tu es un pédagogue socratique. Génère LA prochaine question (une seule, une phrase, en français, tutoiement) qui pousse le raisonnement de l'utilisateur un cran plus loin — son hypothèse, ce qu'il sait déjà, comment il vérifiera — sans jamais donner la réponse à sa place. Ne répète aucune question déjà posée dans le dialogue. Appuie-toi sur sa dernière réponse. Réponds UNIQUEMENT avec la question, sans guillemets ni préambule.",
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "llm_error" }), { status: 502, headers: cors });
    }
    const data = await res.json();
    const question = (data.content?.[0]?.text ?? "").trim();

    return new Response(JSON.stringify({ question: question || null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
