// Tests du module pur models.js : node extension/tests/models.test.js
// Zéro dépendance : assert natif, chargement par eval (le module expose
// CoachModels sur self, simulé ici par globalThis).

const fs = require("fs");
const path = require("path");
const assert = require("assert");

globalThis.self = globalThis;
(0, eval)(fs.readFileSync(path.join(__dirname, "..", "src", "models.js"), "utf8"));
const M = globalThis.CoachModels;

const SITES = Object.keys(M.CATALOG);
const ALL_IDS = new Set(SITES.flatMap((s) => M.CATALOG[s].map(([id]) => id)));

/* ---------- L'INVARIANT CENTRAL ----------------------------------------
   Quoi qu'on lise dans la page, la sortie appartient à un ensemble FERMÉ :
   un identifiant du catalogue, "autre", ou null. Jamais le texte lu.
   C'est la garantie qui fait tenir la promesse « jamais aucun contenu » ;
   tout le reste du fichier n'en est que des cas particuliers.            */

const ADVERSARIAL = [
  "Assistant thèse de Marie",
  "contact@ecole-saint-joseph.fr",
  "Coach Dupont & Associés — dossier Legrand",
  "Mon GPT perso : rapport trimestriel ACME",
  "<script>alert(1)</script>",
  "Relecteur de mémoire (confidentiel)",
  "'; drop table prompt_events; --",
  "🙂 mon petit assistant",
  "a".repeat(5000),
  "  \n\t  ",
  "GPT",
  "Explorer",
];

for (const site of SITES) {
  for (const raw of ADVERSARIAL) {
    const out = M.normalize(site, raw);
    assert.ok(
      out === null || out === "autre" || ALL_IDS.has(out),
      `fuite de texte libre : normalize(${site}, ${JSON.stringify(raw.slice(0, 40))}) → ${JSON.stringify(out)}`
    );
  }
}

// Les libellés adverses qui ne ressemblent à aucun modèle tombent bien sur
// "autre" (et non sur un identifiant par accident de regex).
assert.strictEqual(M.normalize("chatgpt", "Assistant thèse de Marie"), "autre");
assert.strictEqual(M.normalize("chatgpt", "contact@ecole-saint-joseph.fr"), "autre");
assert.strictEqual(M.normalize("claude", "Relecteur de mémoire (confidentiel)"), "autre");
assert.strictEqual(M.normalize("grok", "Mon GPT perso : rapport trimestriel ACME"), "autre");

/* ---------- null : rien de lisible, distinct de "autre" ---------- */

assert.strictEqual(M.normalize("chatgpt", ""), null);
assert.strictEqual(M.normalize("chatgpt", "   \n  "), null);
assert.strictEqual(M.normalize("chatgpt", null), null);
assert.strictEqual(M.normalize("chatgpt", undefined), null);
assert.strictEqual(M.normalize("chatgpt", 42), null);
assert.strictEqual(M.normalize("chatgpt", { toString: () => "GPT-5" }), null);
// Site inconnu : aucun catalogue, mais un libellé a bien été lu.
assert.strictEqual(M.normalize("site-inconnu", "GPT-5"), "autre");

/* ---------- forme des identifiants : la base porte le même CHECK ----------
   Migration 0018 : check (model is null or model ~ '^[a-z0-9][a-z0-9._-]{0,39}$').
   Un identifiant hors forme serait rejeté à l'insertion, donc silencieusement
   perdu. On l'attrape ici, pas en production.                              */

for (const id of [...ALL_IDS, "autre"]) {
  assert.ok(M.ID_SHAPE.test(id), `identifiant hors forme, refusé par la base : ${JSON.stringify(id)}`);
}

/* ---------- ordre du catalogue : le spécifique avant le général ----------
   « gpt-5.1 » doit être testé avant « gpt-5 », sinon il n'est jamais atteint.
   Ces cas sont exactement ceux qui régressent quand on ajoute un modèle en
   fin de liste par réflexe.                                              */

assert.strictEqual(M.normalize("chatgpt", "GPT-5.1"), "gpt-5.1");
assert.strictEqual(M.normalize("chatgpt", "GPT-5"), "gpt-5");
assert.strictEqual(M.normalize("chatgpt", "GPT-5 Pro"), "gpt-5-pro");
assert.strictEqual(M.normalize("chatgpt", "GPT-5 Thinking"), "gpt-5-thinking");
assert.strictEqual(M.normalize("chatgpt", "GPT-4o"), "gpt-4o");
assert.strictEqual(M.normalize("chatgpt", "GPT-4.1"), "gpt-4.1");

assert.strictEqual(M.normalize("claude", "Claude Opus 4.5"), "opus-4.5");
assert.strictEqual(M.normalize("claude", "Sonnet 4.5"), "sonnet-4.5");
assert.strictEqual(M.normalize("claude", "Claude Sonnet 4"), "sonnet-4");
assert.strictEqual(M.normalize("claude", "Haiku 4.5"), "haiku-4.5");
// Repli générique : un « Opus 6 » inconnu reste reconnu comme un Opus plutôt
// que de tomber dans "autre" — dégradation utile, pas silencieuse.
assert.strictEqual(M.normalize("claude", "Claude Opus 6"), "opus");

assert.strictEqual(M.normalize("gemini", "3 Pro"), "gemini-3-pro");
assert.strictEqual(M.normalize("gemini", "Gemini 2.5 Flash"), "gemini-2.5-flash");
assert.strictEqual(M.normalize("mistral", "Mistral Large 2"), "mistral-large");
assert.strictEqual(M.normalize("grok", "Grok 4.1"), "grok-4.1");
assert.strictEqual(M.normalize("grok", "Grok 4 Heavy"), "grok-4-heavy");
assert.strictEqual(M.normalize("grok", "Grok 4"), "grok-4");

/* ---------- troncature : un libellé long ne fait pas exploser la regex ---------- */

assert.strictEqual(M.normalize("chatgpt", "GPT-5" + " ".repeat(500) + "bla"), "gpt-5");
// Au-delà de MAX_RAW le modèle n'est plus cherché : la fin est coupée.
assert.strictEqual(M.normalize("chatgpt", "x".repeat(200) + " GPT-5"), "autre");

/* ---------- version du catalogue ---------- */

assert.ok(Number.isInteger(M.VERSION) && M.VERSION >= 1, "VERSION doit être un entier ≥ 1");

console.log("models.test.js : OK");
