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

    // Le prompt brut et le dialogue transitent ici : exiger les consentements
    // prompt_text ET socratic_dialogue (défense en profondeur, même règle
    // « demandé ET consenti » que le trigger enforce_consent).
    const [textOk, dialogueOk] = await Promise.all([
      supabase.rpc("effective_capture", { p_org: profile.org_id, p_user: userData.user.id, p_cat: "prompt_text" }),
      supabase.rpc("effective_capture", { p_org: profile.org_id, p_user: userData.user.id, p_cat: "socratic_dialogue" }),
    ]);
    if (!textOk.data || !dialogueOk.data) {
      return new Response(JSON.stringify({ error: "llm_no_consent" }), { status: 403, headers: cors });
    }

    // Entrée v2 (champs additifs, rétro-compatible avec les anciens clients) :
    // lang pilote la langue, depth l'exigence (1 clarifier, 2 faire produire,
    // 3 challenger), intent="reroll" une relance explicite de l'utilisateur.
    const { prompt, dialogue, lang, intent, rejected, askedQuestions, depth } = await req.json();
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000) {
      return new Response(JSON.stringify({ error: "invalid_prompt" }), { status: 400, headers: cors });
    }
    const rounds: { question: string; answer: string }[] = Array.isArray(dialogue) ? dialogue.slice(0, 30) : [];
    const language = lang === "en" ? "en" : "fr";
    const level = Math.min(3, Math.max(1, Number(depth) || Math.min(3, 1 + rounds.length)));
    const clip = (arr: unknown, n: number) =>
      (Array.isArray(arr) ? arr : []).slice(0, n).map((s) => String(s).slice(0, 300));
    const rejectedQs = clip(rejected, 5);
    const alreadyAsked = clip(askedQuestions, 5);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "llm_not_configured" }), { status: 503, headers: cors });
    }

    const transcript = rounds
      .map((r) => `Q: ${String(r.question).slice(0, 500)}\nR: ${String(r.answer || "(passée)").slice(0, 1000)}`)
      .join("\n");
    const contextBlocks = [
      `Demande initiale de l'utilisateur à l'IA :\n${prompt}`,
      `Dialogue socratique déjà mené :\n${transcript || "(aucun échange encore)"}`,
    ];
    if (alreadyAsked.length) {
      contextBlocks.push(`Questions déjà posées (interdiction de les répéter ou reformuler) :\n${alreadyAsked.join("\n")}`);
    }

    // Échelle d'exigence : à 3, jamais une simple clarification. La relance
    // exige une question DIFFERENTE et PLUS exigeante, pas une redite polie.
    const levelRule =
      level === 1
        ? "Niveau demandé 1/3 : clarifier l'intention et le besoin réel."
        : level === 2
          ? "Niveau demandé 2/3 : faire produire l'utilisateur (un exemple concret, une tentative, une contrainte précise)."
          : "Niveau demandé 3/3 : challenger. Exige une preuve, un contre-argument ou un critère de réussite vérifiable. À ce niveau, ne pose jamais une simple question de clarification.";
    const rerollRule =
      intent === "reroll" && rejectedQs.length
        ? ` L'utilisateur vient d'écarter cette question : « ${rejectedQs[0]} ». Pose une question DIFFERENTE et PLUS exigeante sur le même fil de raisonnement, jamais une reformulation cosmétique.`
        : "";
    const langRule =
      language === "en"
        ? "Answer ONLY with the question, no quotes, no preamble, in English."
        : "Réponds UNIQUEMENT avec la question, sans guillemets ni préambule, en français, avec tutoiement.";
    const system =
      "Tu es un pédagogue socratique exigeant. Génère LA prochaine question du dialogue (une seule, une phrase) qui pousse le raisonnement de l'utilisateur un cran plus loin, sans jamais donner la réponse à sa place. Appuie-toi sur sa dernière réponse et sur son sujet précis. Ne répète ni ne reformule aucune question déjà posée. " +
      levelRule +
      rerollRule +
      " " +
      langRule;

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
        system,
        messages: [{ role: "user", content: contextBlocks.join("\n\n") }],
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
