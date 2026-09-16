// Les trois constantes qui disent QUELLE stack l'extension vise. Rien d'autre :
// pas de fonction, pas de requête, pas d'accès à chrome.* — ce fichier est
// chargé partout, y compris dans les content scripts des sites IA, où seul
// APP_URL sert (le lien « ? » de la modale). Le client REST/Auth complet
// (src/supabase.js) ne vit que dans le worker, le popup et la page de
// consentement.
//
// Production : Supabase hébergé, projet kbbrkrvacazkxraudvng (Paris,
// eu-west-3), derrière PostgREST/GoTrue ; la clé est la clé PUBLISHABLE du
// projet, publique par conception (la sécurité repose sur RLS). L'app
// (companion.mines.paris, alias historique ibe3.vercel.app) sert l'appairage (/extension/pair), la question socratique
// LLM et toutes les pages vers lesquelles l'extension renvoie (/help#method,
// /extension/privacy).
//
// Ce sont les TROIS SEULES valeurs à changer pour viser une autre stack : en
// dev, la stack locale d'I-BE³ (`pnpm dev` dans ibe3-companion) écoute sur
// 127.0.0.1:54421 (Supabase, avec la clé anon de `supabase start`) et sur
// localhost:3200 (app) — voir le README, section « Viser une autre stack ».
// Ne jamais commiter ni empaqueter des valeurs locales : scripts/package.sh
// refuse d'empaqueter si SUPABASE_URL ou APP_URL n'est pas en https.
const CoachConfig = {
  SUPABASE_URL: "https://kbbrkrvacazkxraudvng.supabase.co",
  SUPABASE_KEY: "sb_publishable_9VP7D7EGppB4a6722ylTrg_CuUbaHhN",
  APP_URL: "https://companion.mines.paris",
};

if (typeof self !== "undefined") self.CoachConfig = CoachConfig;
