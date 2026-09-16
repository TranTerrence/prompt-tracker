// Tests du sélecteur de prompts (1.0.3) : node extension/tests/picker.test.js
// Zéro dépendance : assert natif, chargement par eval indirect ou sandbox
// `new Function`, comme les autres tests du dépôt.
//
// Trois couches, du plus pur au plus câblé :
//   1. CoachLibrary (src/library.js), sans DOM ni chrome.* : c'est lui qui
//      décide ce que le sélecteur montre, dans quel ordre, et ce qu'il écrit
//      dans le composeur. Une erreur ici se voit sur les cinq sites à la fois.
//   2. Le câblage : manifest (ordre de chargement, raccourci), locales.
//   3. Les deux bouts du fil : content.js reçoit `picker-insert`, le worker
//      reçoit `library-used`. Pas de site réel ici, seulement les contrats.
//
// L'INVARIANT CENTRAL : le sélecteur n'ENVOIE jamais. Il remplace ou complète
// le composeur, et rend la main. Aucun test ici ne voit passer submitText.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

globalThis.self = globalThis;
(0, eval)(read("src/library.js"));
const L = globalThis.CoachLibrary;
assert.strictEqual(typeof L, "object", "CoachLibrary doit être exposé sur self");

/* ---------- Jeu de données ---------- */

const P = {
  off1: { id: "6f0b7c3e-1111-4a2b-9c3d-000000000001", kind: "official", title: "Cadrer une dissertation", body: "Je prépare une dissertation sur [SUJET].", category: "rédaction", copies: 3, helpful: null, author: null, lang: "fr" },
  off2: { id: "6f0b7c3e-1111-4a2b-9c3d-000000000002", kind: "official", title: "Vérifier un résumé", body: "Voici mon résumé : …", category: "analyse", copies: 40, helpful: null, author: null, lang: "fr" },
  peer1: { id: "6f0b7c3e-2222-4a2b-9c3d-000000000003", kind: "peer", title: "Débugger sans la solution", body: "Voici mon code et l'erreur.", category: "code", copies: 12, helpful: 4, author: "Léa", lang: "fr" },
  peer2: { id: "6f0b7c3e-2222-4a2b-9c3d-000000000004", kind: "peer", title: "Plan en trois parties", body: "Je prépare une dissertation : où le plan dérape ?", category: "rédaction", copies: 27, helpful: 9, author: null, lang: "fr" },
  slug: { id: "school-intro", kind: "official", title: "Intro de l'école", body: "Présente-toi à l'IA.", category: null, copies: null, helpful: null, author: null, lang: null },
};
const ALL = [P.off1, P.peer1, P.off2, P.peer2, P.slug];

/* ---------- normSearch : sans accents, sans casse ---------- */

assert.strictEqual(L.normSearch("Rédaction Élève"), "redaction eleve");
assert.strictEqual(L.normSearch(""), "");
assert.strictEqual(L.normSearch(null), "", "null ne lève pas");

/* ---------- matches : chaque jeton, sur titre + corps + catégorie + auteur ---------- */

assert.ok(L.matches(P.off1, "dissertation"), "sur le corps");
assert.ok(L.matches(P.off1, "cadrer"), "sur le titre");
assert.ok(L.matches(P.off1, "redaction"), "catégorie, sans accent");
assert.ok(L.matches(P.peer1, "léa"), "auteur, avec accent dans la requête");
assert.ok(L.matches(P.off1, "  Dissertation   SUJET "), "plusieurs jetons, tous présents (ET)");
assert.ok(!L.matches(P.off1, "dissertation code"), "un jeton absent suffit à écarter");
assert.ok(L.matches(P.off1, ""), "requête vide : tout passe");
assert.ok(L.matches(P.off1, "   "), "requête blanche : tout passe");

/* ---------- sortLibrary : officiels d'abord, puis les plus repris ---------- */

assert.deepStrictEqual(
  L.sortLibrary(ALL).map((p) => p.id),
  [P.off2.id, P.off1.id, P.slug.id, P.peer2.id, P.peer1.id],
  "officiels devant, reprises décroissantes, null vaut 0"
);
assert.deepStrictEqual(L.sortLibrary(null), [], "null → []");
const before = [...ALL];
L.sortLibrary(ALL);
assert.deepStrictEqual(ALL, before, "ne trie pas en place");

/* ---------- groupLibrary : chaque prompt une fois, premier groupe qui le prend ---------- */

{
  const groups = L.groupLibrary({
    prompts: ALL,
    starred: [P.peer1.id, P.off1.id, "inconnu"],
    recent: [P.off1.id, P.peer2.id, "fantôme", P.off2.id],
    query: "",
  });
  assert.deepStrictEqual(
    groups.map((g) => g.key),
    ["starred", "recent", "official"],
    "ordre des groupes ; aucun pair restant → le groupe « peer » est omis"
  );
  const ids = (k) => groups.find((g) => g.key === k).items.map((p) => p.id);
  assert.deepStrictEqual(ids("starred"), [P.off1.id, P.peer1.id], "favoris : tri bibliothèque, ids inconnus ignorés");
  assert.deepStrictEqual(ids("recent"), [P.peer2.id, P.off2.id], "récents : ordre de récence, sans ceux déjà en favoris");
  assert.deepStrictEqual(ids("official"), [P.slug.id], "officiels restants");
  const seen = groups.flatMap((g) => g.items.map((p) => p.id));
  assert.strictEqual(new Set(seen).size, seen.length, "aucun doublon");
  assert.strictEqual(seen.length, ALL.length, "tout le monde est là");
}

{
  // Groupes vides omis, y compris quand rien n'est marqué.
  const groups = L.groupLibrary({ prompts: ALL, starred: null, recent: null, query: "" });
  assert.deepStrictEqual(groups.map((g) => g.key), ["official", "peer"]);
  assert.deepStrictEqual(
    groups[0].items.map((p) => p.id),
    [P.off2.id, P.off1.id, P.slug.id],
    "officiels par reprises décroissantes"
  );
}

{
  // La recherche s'applique DANS les groupes ; un groupe vidé disparaît.
  const groups = L.groupLibrary({ prompts: ALL, starred: [P.peer1.id], recent: [P.off2.id], query: "dissertation" });
  assert.deepStrictEqual(groups.map((g) => g.key), ["official", "peer"], "favori et récent ne matchent pas → omis");
  assert.deepStrictEqual(groups[0].items.map((p) => p.id), [P.off1.id]);
  assert.deepStrictEqual(groups[1].items.map((p) => p.id), [P.peer2.id]);
  assert.deepStrictEqual(L.groupLibrary({ prompts: ALL, query: "zzz" }), [], "aucun résultat → []");
  assert.deepStrictEqual(L.groupLibrary({ prompts: null }), [], "bibliothèque absente → []");
  assert.deepStrictEqual(L.groupLibrary({ prompts: [] }), [], "bibliothèque vide → []");
}

{
  // Un Set de favoris est accepté (c'est ce que le sélecteur construit).
  const groups = L.groupLibrary({ prompts: ALL, starred: new Set([P.slug.id]), recent: [] });
  assert.deepStrictEqual(groups[0].items.map((p) => p.id), [P.slug.id]);
}

/* ---------- flatten : l'ordre clavier est l'ordre d'affichage ---------- */

{
  const groups = L.groupLibrary({ prompts: ALL, starred: [P.peer1.id], recent: [P.off2.id] });
  const flat = L.flatten(groups);
  assert.deepStrictEqual(
    flat.map((p) => p.id),
    [P.peer1.id, P.off2.id, P.off1.id, P.slug.id, P.peer2.id]
  );
  assert.deepStrictEqual(L.flatten([]), []);
  assert.deepStrictEqual(L.flatten(null), []);
}

/* ---------- mergeInsert : remplacer le vide, compléter le brouillon ---------- */

assert.strictEqual(L.mergeInsert("", "Corps"), "Corps", "composeur vide → le corps seul");
assert.strictEqual(L.mergeInsert("   \n", "Corps"), "Corps", "blancs seuls = vide");
assert.strictEqual(L.mergeInsert(null, "Corps"), "Corps");
assert.strictEqual(L.mergeInsert("hello", "Corps"), "hello\n\nCorps", "brouillon gardé, une ligne vide, puis le corps");
assert.strictEqual(L.mergeInsert("hello  \n\n", "Corps \n"), "hello\n\nCorps", "blancs de fin retirés des deux côtés");
assert.strictEqual(L.mergeInsert("hello", "  indenté"), "hello\n\n  indenté", "les blancs de tête du corps sont gardés");

/* ---------- slashTrigger : « // » tapé, et rien d'autre ---------- */

assert.ok(L.slashTrigger({ text: "//", inputType: "insertText", isComposing: false }), "le cas nominal");
assert.ok(L.slashTrigger({ text: "  //  ", inputType: "insertText", isComposing: false }), "blancs autour tolérés");
assert.ok(L.slashTrigger({ text: "//" }), "inputType absent (Event générique, textarea) : accepté");
assert.ok(!L.slashTrigger({ text: "//", inputType: "insertFromPaste" }), "collage : jamais");
assert.ok(!L.slashTrigger({ text: "//", inputType: "insertText", isComposing: true }), "IME en composition : jamais");
assert.ok(!L.slashTrigger({ text: "//", inputType: "insertCompositionText" }), "texte de composition : jamais");
assert.ok(!L.slashTrigger({ text: "//", inputType: "historyUndo" }), "annulation : jamais");
assert.ok(!L.slashTrigger({ text: "//", inputType: "insertReplacementText" }), "autocorrection : jamais");
assert.ok(!L.slashTrigger({ text: "//x", inputType: "insertText" }), "« //x » n'est pas le déclencheur");
assert.ok(!L.slashTrigger({ text: "x //", inputType: "insertText" }), "« x // » non plus");
assert.ok(!L.slashTrigger({ text: "// todo", inputType: "insertText" }), "un commentaire de code non plus");
assert.ok(!L.slashTrigger({ text: "https://", inputType: "insertText" }), "une URL non plus");
assert.ok(!L.slashTrigger({ text: "/", inputType: "insertText" }), "un seul slash : c'est le menu du site, pas le nôtre");
assert.ok(!L.slashTrigger({ text: "", inputType: "insertText" }), "vide");
assert.ok(!L.slashTrigger({}), "sans texte");
assert.ok(!L.slashTrigger(null), "null ne lève pas");

/* ---------- pushRecent : en tête, sans doublon, plafonné ---------- */

assert.deepStrictEqual(L.pushRecent([], "a"), ["a"]);
assert.deepStrictEqual(L.pushRecent(["a", "b"], "c"), ["c", "a", "b"], "le plus récent en tête");
assert.deepStrictEqual(L.pushRecent(["a", "b", "c"], "b"), ["b", "a", "c"], "réinséré en tête, une seule fois");
assert.deepStrictEqual(L.pushRecent(null, "a"), ["a"], "liste absente");
assert.deepStrictEqual(L.pushRecent(["a"], ""), ["a"], "id vide ignoré");
assert.deepStrictEqual(L.pushRecent(["a"], null), ["a"], "id null ignoré");
{
  let list = [];
  for (let i = 0; i < 25; i++) list = L.pushRecent(list, `p${i}`);
  assert.strictEqual(list.length, L.RECENT_MAX, "plafonné à RECENT_MAX");
  assert.strictEqual(L.RECENT_MAX, 10);
  assert.strictEqual(list[0], "p24");
  assert.strictEqual(list[9], "p15");
}
{
  const input = ["a", "b"];
  L.pushRecent(input, "c");
  assert.deepStrictEqual(input, ["a", "b"], "ne mute pas l'entrée");
}

/* ---------- isUuid : seuls les ids Postgres appellent la RPC ---------- */

assert.ok(L.isUuid("6f0b7c3e-1111-4a2b-9c3d-000000000001"));
assert.ok(L.isUuid("6F0B7C3E-1111-4A2B-9C3D-000000000001"), "majuscules acceptées");
assert.ok(!L.isUuid("school-intro"), "slug d'un flux d'organisation");
assert.ok(!L.isUuid("p0"), "id de rang fabriqué par normalizeLibrary");
assert.ok(!L.isUuid(""));
assert.ok(!L.isUuid(null));
assert.ok(!L.isUuid(42));

/* ---------- shortcutLabel : la corde affichée suit la plateforme ---------- */

assert.strictEqual(L.shortcutLabel("MacIntel"), "⌘⇧.");
assert.strictEqual(L.shortcutLabel("iPad"), "⌘⇧.");
assert.strictEqual(L.shortcutLabel("Win32"), "Ctrl+Shift+.");
assert.strictEqual(L.shortcutLabel("Linux x86_64"), "Ctrl+Shift+.");
assert.strictEqual(L.shortcutLabel(undefined), "Ctrl+Shift+.");

console.log("picker.test.js : CoachLibrary ✓");
