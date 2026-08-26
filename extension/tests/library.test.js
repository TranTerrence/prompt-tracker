// Tests de normalizeLibrary (background.js) : node extension/tests/library.test.js
// Zéro dépendance : assert natif, chargement par eval indirect. background.js
// est un service worker qui s'accroche à chrome.* dès le chargement : on stubbe
// juste assez pour que le fichier s'évalue, rien d'autre n'est exercé ici.
//
// L'INVARIANT CENTRAL : quoi que le réseau envoie — et l'URL de bibliothèque
// est configurée par l'organisation, pas par nous — la sortie est bornée,
// typée, ou null. Jamais une chaîne non tronquée, jamais un champ inconnu,
// jamais une exception.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

globalThis.self = globalThis;
const noopListener = { addListener() {} };
globalThis.chrome = {
  runtime: {
    onInstalled: noopListener,
    onStartup: noopListener,
    onMessage: noopListener,
    getURL: (p) => p,
  },
  storage: { local: { get: (_k, cb) => cb({}) }, onChanged: noopListener },
  alarms: { create() {}, onAlarm: noopListener },
  action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
  tabs: { create() {} },
  permissions: { contains: (_p, cb) => cb(false) },
};
(0, eval)(fs.readFileSync(path.join(__dirname, "..", "src", "background.js"), "utf8"));
const norm = globalThis.normalizeLibrary;
assert.strictEqual(typeof norm, "function", "normalizeLibrary doit être globale");

/* ---------- Enveloppes invalides → null, sans lever ---------- */

for (const bad of [null, undefined, 42, "x", {}, { prompts: "x" }, { prompts: {} }, { prompts: [] }]) {
  assert.strictEqual(norm(bad), null, `enveloppe invalide: ${JSON.stringify(bad)}`);
}

/* ---------- Entrées irrécupérables : sautées, jamais fatales ---------- */

// body est le seul champ requis ; tout le reste se répare.
assert.strictEqual(
  norm({ prompts: [null, 42, "x", {}, { body: "" }, { body: "   " }, { body: 7 }, { title: "sans corps" }] }),
  null,
  "que des entrées sans body → null"
);
const mixed = norm({ prompts: [null, { body: "le seul valide" }, { body: 12 }] });
assert.strictEqual(mixed.length, 1);
assert.strictEqual(mixed[0].body, "le seul valide");

/* ---------- Bornes de taille ---------- */

const long = norm({
  prompts: [{ body: "b".repeat(10000), title: "t".repeat(500), category: "c".repeat(100), author: "a".repeat(200) }],
})[0];
assert.strictEqual(long.body.length, 4000, "body tronqué à 4000");
assert.strictEqual(long.title.length, 120, "title tronqué à 120");
assert.strictEqual(long.category.length, 40, "category tronquée à 40");
assert.strictEqual(long.author.length, 80, "author tronqué à 80");

// Sans titre : les 60 premiers caractères du corps.
const untitled = norm({ prompts: [{ body: "x".repeat(200) }] })[0];
assert.strictEqual(untitled.title, "x".repeat(60));

// Les chaînes sont nettoyées, pas gardées brutes.
assert.strictEqual(norm({ prompts: [{ body: "  espaces  " }] })[0].body, "espaces");

/* ---------- Champs à domaine fermé ---------- */

const kinds = norm({
  prompts: [{ body: "a", kind: "peer" }, { body: "b", kind: "admin" }, { body: "c", kind: 42 }, { body: "d" }],
});
assert.deepStrictEqual(kinds.map((p) => p.kind), ["peer", "official", "official", "official"]);

const langs = norm({
  prompts: [{ body: "a", lang: "fr" }, { body: "b", lang: "en" }, { body: "c", lang: "de" }, { body: "d", lang: "FR" }, { body: "e", lang: 1 }],
});
assert.deepStrictEqual(langs.map((p) => p.lang), ["fr", "en", null, null, null], "seuls fr/en exacts passent");

const counts = norm({
  prompts: [
    { body: "a", copies: 12, helpful: 0 },
    { body: "b", copies: -3, helpful: NaN },
    { body: "c", copies: Infinity, helpful: "12" },
    { body: "d", copies: 3.9 },
  ],
});
assert.strictEqual(counts[0].copies, 12);
assert.strictEqual(counts[0].helpful, 0);
assert.strictEqual(counts[1].copies, null, "négatif → null");
assert.strictEqual(counts[1].helpful, null, "NaN → null");
assert.strictEqual(counts[2].copies, null, "Infinity → null");
assert.strictEqual(counts[2].helpful, null, "chaîne → null (pas de coercition)");
assert.strictEqual(counts[3].copies, 3, "décimal → plancher");

/* ---------- Identité et plafond ---------- */

const ids = norm({ prompts: [{ body: "a" }, { body: "b", id: "mien" }, { body: "c" }] });
assert.deepStrictEqual(ids.map((p) => p.id), ["p0", "mien", "p2"], "id manquant → rang");

const flood = norm({ prompts: Array.from({ length: 250 }, (_, i) => ({ body: `p ${i}` })) });
assert.strictEqual(flood.length, 200, "plafond à 200 entrées");

// Les champs inconnus n'existent pas en sortie : le contrat est fermé.
const shaped = norm({ prompts: [{ body: "a", evil: "<script>", tracking_id: "x" }] })[0];
assert.deepStrictEqual(
  Object.keys(shaped).sort(),
  ["author", "body", "category", "copies", "helpful", "id", "kind", "lang", "title"],
  "sortie = exactement les neuf champs du format v1"
);

console.log("library.test.js : tous les tests passent.");
