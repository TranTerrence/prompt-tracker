// Tests du module pur scoring.js : node extension/tests/scoring.test.js
// Zéro dépendance : assert natif, chargement par eval (le module expose
// CoachScoring sur self, simulé ici par globalThis).

const fs = require("fs");
const path = require("path");
const assert = require("assert");

globalThis.self = globalThis;
(0, eval)(fs.readFileSync(path.join(__dirname, "..", "src", "scoring.js"), "utf8"));
const S = globalThis.CoachScoring;

/* ---------- topic : extraction du groupe nominal ---------- */

assert.strictEqual(S.topic("fais mes devoirs de maths", "fr"), "devoirs de maths");
assert.strictEqual(S.topic("explique la photosynthèse", "fr"), "photosynthèse");
assert.strictEqual(S.topic("write my cover letter for a marketing job", "en"), "cover letter for a marketing job");
assert.strictEqual(S.topic("fais le", "fr"), null);

/* ---------- tentative d'abord sur délégation totale ---------- */

const scoresDeleg = S.score("fais mes devoirs de maths");
const q1 = S.nextQuestion({ originalPrompt: "fais mes devoirs de maths", scores: scoresDeleg, asked: [], lang: "fr" });
assert.strictEqual(q1.axis, "hypothese");
assert.ok(q1.question.includes("devoirs de maths"), `question instanciée avec le sujet : ${q1.question}`);

/* ---------- novice : pas d'axe exigeant dans les 2 premiers tours ---------- */

const scoresNovice = S.score("la guerre froide");
const askedNovice = [];
for (let i = 0; i < 2; i++) {
  const q = S.nextQuestion({ originalPrompt: "la guerre froide", scores: scoresNovice, asked: askedNovice, lang: "fr" });
  assert.ok(!["critique", "approfondissement"].includes(q.axis), `tour ${i} trop profond : ${q.axis}`);
  askedNovice.push(q.key);
}

/* ---------- riche : creuse directement ---------- */

const richPrompt =
  "Analyse comparative des politiques de relance 2008 et 2020 : je suis étudiant en master, public universitaire, format note de 2 pages, appuie-toi sur des sources vérifiables";
const scoresRich = S.score(richPrompt);
const qRich = S.nextQuestion({ originalPrompt: richPrompt, scores: scoresRich, asked: [], lang: "fr" });
assert.ok(["hypothese", "critique", "intention", "contexte"].includes(qRich.axis), qRich.axis);

/* ---------- profil : {livrable} remplacé ---------- */

let found = null;
const askedProfile = [];
for (let i = 0; i < 20 && !found; i++) {
  const q = S.nextQuestion({ originalPrompt: "x", scores: S.score("x"), asked: askedProfile, lang: "fr", profile: "student" });
  askedProfile.push(q.key);
  if (q.key === "contexte-3") found = q;
}
assert.ok(found && found.question.includes("ton devoir"), `profil étudiant : ${found && found.question}`);

/* ---------- compile : tentative en tête ---------- */

const compiled = S.compilePrompt(
  "ma demande",
  [
    { key: "contexte", axis: "contexte", label: "Mon contexte", answer: "pour le lycée" },
    { key: "hypothese-1", axis: "hypothese", label: "Ma tentative", answer: "je pense que X" },
  ],
  "fr"
);
assert.ok(compiled.indexOf("Ma tentative") < compiled.indexOf("Mon contexte"), compiled);
assert.strictEqual(S.compilePrompt("brut", [], "fr"), "brut");

/* ---------- postQuestion ---------- */

assert.strictEqual(S.postQuestion({ category: "recherche", scores: { critique: 0 }, lang: "fr" }).key, "verify");
assert.strictEqual(S.postQuestion({ count: 0 }).key, "explain");
assert.strictEqual(S.postQuestion({ count: 1 }).key, "disagree");
assert.ok(S.postQuestion({ lang: "en", count: 2 }).question.includes("verify"));

/* ---------- progression : premiers jets, seuil adaptatif, streak ---------- */

assert.strictEqual(S.firstDraftScore({ scoreBefore: 22, scores: { total: 80 } }), 22);
assert.strictEqual(S.firstDraftScore({ scores: { total: 55 } }), 55);
assert.strictEqual(S.firstDraftScore(null), null);

const good = Array.from({ length: 10 }, () => ({ scores: { total: 60 } }));
assert.strictEqual(S.adaptiveThreshold(good, 40), 44);
assert.strictEqual(S.adaptiveThreshold([], 40), 40);
assert.strictEqual(S.adaptiveThreshold([...good, { scoreBefore: 10, scores: { total: 70 } }], 40), 40, "le jet raté remet la barre de base");

const now = Date.now();
const day = 86400000;
const ev = (offset, total, before) => ({ ts: new Date(now - offset * day).toISOString(), scores: { total }, scoreBefore: before ?? null });
assert.strictEqual(S.dayStreak([ev(0, 50), ev(1, 45), ev(3, 60)], 40, now), 3, "les jours vides sont ignorés");
assert.strictEqual(S.dayStreak([ev(0, 50), ev(1, 20), ev(2, 60)], 40, now), 1, "un jour raté casse la série");
assert.strictEqual(S.dayStreak([], 40, now), 0);

/* ---------- gel de série : 7 réussites consécutives = 1 gel (2 max) ---------- */

const week = Array.from({ length: 7 }, (_, i) => ev(i + 1, 60)); // J-7 à J-1 réussis
assert.deepStrictEqual(
  S.dayStreakInfo(week, 40, now),
  { streak: 7, freezes: 1 },
  "7 jours réussis mettent un gel en réserve"
);
assert.deepStrictEqual(
  S.dayStreakInfo([...week, ev(0, 20)], 40, now),
  { streak: 7, freezes: 0 },
  "le jour raté consomme le gel : la série tient sans avancer"
);
assert.strictEqual(
  S.dayStreak([...week.map((e) => ({ ...e, ts: new Date(Date.parse(e.ts) - day).toISOString() })), ev(1, 20), ev(0, 55)], 40, now),
  8,
  "après un jour gelé, la série reprend sa progression"
);
assert.deepStrictEqual(
  S.dayStreakInfo([ev(2, 60), ev(1, 20), ev(0, 55)], 40, now),
  { streak: 1, freezes: 0 },
  "sans gel en réserve, le jour raté casse la série"
);
assert.strictEqual(
  S.dayStreakInfo(Array.from({ length: 21 }, (_, i) => ev(i, 60)), 40, now).freezes,
  2,
  "jamais plus de 2 gels en réserve"
);

/* ---------- typage des tours : isFollowUp ---------- */

const prevPrompts = ["Rédige une note sur les politiques de relance de 2008 pour mon cours d'économie"];
assert.strictEqual(S.isFollowUp("continue", prevPrompts), true, "« continue » est une suite");
assert.strictEqual(S.isFollowUp("plus court", prevPrompts), true, "« plus court » est une suite");
assert.strictEqual(S.isFollowUp("et si on comparait avec 2020 ?", prevPrompts), true, "anaphore = suite");
assert.strictEqual(S.isFollowUp("oui mais pour un lycéen", prevPrompts), true);
assert.strictEqual(
  S.isFollowUp("une autre note sur les politiques de relance de 2008 économie", prevPrompts),
  true,
  "fort recouvrement lexical = suite"
);
assert.strictEqual(S.isFollowUp("continue", []), false, "sans historique : jamais une suite");
assert.strictEqual(
  S.isFollowUp(
    "Analyse l'impact des taux d'intérêt négatifs sur la rentabilité des banques européennes depuis 2014, avec des sources vérifiables",
    prevPrompts
  ),
  false,
  "tour substantiel sur nouveau sujet = ouvreur"
);

/* ---------- suggestion : pas de « trop court » sur une suite ---------- */

const shortScores = S.score("continue");
assert.ok(S.socraticSuggestion("continue", shortScores, [], "fr", false), "ouvreur court → suggestion");
assert.strictEqual(S.socraticSuggestion("continue", shortScores, [], "fr", true), null, "suite courte saine → silence");
assert.ok(
  S.socraticSuggestion("c'est quoi une dérivée ?", S.score("c'est quoi une dérivée ?"), [], "fr", true),
  "suite recherche sans esprit critique → suggestion sources conservée"
);

/* ---------- non-régression du score (recalibration v2) ---------- */

assert.strictEqual(S.score("fais mes devoirs").total < 40, true);
assert.ok(S.score(richPrompt).total >= 40, `prompt riche doit passer : ${S.score(richPrompt).total}`);
assert.strictEqual(S.categorize("résume ce document"), "résumé");

// Trouvaille terrain : la vérification au futur compte comme esprit critique
assert.ok(
  S.score("propose un plan et je vérifierai chaque citation dans mon édition").critique >= 20,
  "« je vérifierai » (futur) est de l'esprit critique"
);

// Bugs corrigés : possessif « ton », interrogatif « pourquoi »
assert.strictEqual(S.score("donne ton avis sur ce texte").contexte, 0, "« ton » possessif n'est pas du contexte");
assert.ok(S.score("réponds sur un ton professionnel s'il te plaît").contexte >= 15, "« ton professionnel » reste du contexte");
assert.strictEqual(S.score("pourquoi le ciel est bleu").critique, 0, "un interrogatif naïf n'est pas de l'esprit critique");
assert.strictEqual(S.score("I am not really sure what to do here can you help me with this task please").contexte, 0, "« I am not sure » n'est pas un rôle");

// Anti-gaming : répétition et bourrage de mots-clés
assert.ok(S.score("blabla ".repeat(30)).clarte <= 10, "la répétition n'achète pas la clarté");
assert.ok(
  S.score("je suis étudiant contexte : devoirs. public : prof. format : copie. fais mes devoirs de maths et vérifie tes sources car je suis en tant que étudiant avec contraintes maximum étapes").total < 40,
  "le bourrage de mots-clés sur une délégation sans matière n'achète pas le passage"
);

// L'échafaudage du prompt compilé ne se score pas lui-même
const scaffolded = S.compilePrompt(
  "fais mes devoirs",
  [{ key: "contexte", axis: "contexte", label: "Mon contexte", answer: "lycée" }],
  "fr"
);
const stripped = S.stripScaffolding(scaffolded);
assert.ok(!stripped.includes("Ma réflexion préalable"), "en-tête retiré");
assert.ok(!stripped.includes("Mon contexte :"), "labels retirés");
assert.ok(stripped.includes("lycée"), "la réponse de l'utilisateur reste");
assert.ok(
  S.score(stripped).total <= S.score(scaffolded).total,
  "le score de l'aperçu ne compte plus la structure injectée"
);

/* ---------- V3.9 : banque enrichie, sélection contextuelle, relance ---------- */

// Non-répétition : aucune clé servie deux fois avant l'épuisement (recycled)
{
  const asked = [];
  const seen = new Set();
  let recycledAt = null;
  for (let i = 0; i < 80; i++) {
    const q = S.nextQuestion({ originalPrompt: "la guerre froide", scores: S.score("la guerre froide"), asked, lang: "fr" });
    if (q.recycled) { recycledAt = i; break; }
    assert.ok(!seen.has(q.key), `clé répétée avant épuisement : ${q.key}`);
    seen.add(q.key);
    asked.push(q.key);
  }
  assert.ok(recycledAt !== null, "l'épuisement finit par arriver (recycled: true)");
  assert.ok(seen.size >= 40, `banque réellement enrichie : ${seen.size} questions servies`);
}

// Sélection contextuelle : un prompt code obtient des questions ciblées code,
// jamais une question ciblée sur une autre catégorie
{
  const codePrompt = "corrige ce bug python dans ma fonction";
  const asked = [];
  const served = [];
  for (let i = 0; i < 15; i++) {
    const q = S.nextQuestion({ originalPrompt: codePrompt, scores: S.score(codePrompt), asked, lang: "fr" });
    if (q.recycled) break;
    served.push(q.key);
    asked.push(q.key);
  }
  assert.ok(served.some((k) => k.includes("-code")), `au moins une question ciblée code : ${served.join(", ")}`);
  assert.ok(!served.some((k) => k.includes("redaction") || k.includes("traduction")), `jamais une question d'une autre catégorie : ${served.join(", ")}`);
}

// Relance : même axe, niveau strictement supérieur, clé écartée jamais reproposée
{
  const scores = S.score("la guerre froide");
  const first = S.nextQuestion({ originalPrompt: "la guerre froide", scores, asked: [], lang: "fr" });
  const re = S.nextQuestion({
    originalPrompt: "la guerre froide", scores, asked: [first.key], answeredCount: 0,
    reroll: true, lastAxis: first.axis, lastLevel: first.level, lang: "fr",
  });
  assert.notStrictEqual(re.key, first.key, "la clé écartée ne revient pas");
  assert.strictEqual(re.axis, first.axis, "la relance reste sur le même axe");
  assert.ok(re.level > first.level, `la relance est plus exigeante : ${first.level} -> ${re.level}`);
}

// Métadonnées de retour : level/source/recycled présents, rétro-compat surcharge org
{
  const q = S.nextQuestion({ originalPrompt: "fais mes devoirs de maths", scores: S.score("fais mes devoirs de maths"), asked: [], lang: "fr" });
  assert.strictEqual(q.source, "local");
  assert.ok(q.level >= 1 && q.level <= 3, `level valide : ${q.level}`);
  assert.strictEqual(q.recycled, false);
  const custom = S.nextQuestion(
    { originalPrompt: "fais mes devoirs de maths", scores: S.score("fais mes devoirs de maths"), asked: [], lang: "fr" },
    { [q.key]: "Question de l'organisation ?" }
  );
  assert.strictEqual(custom.question, "Question de l'organisation ?", "la surcharge org gagne toujours");
}

// Profils : une question ciblée student ne sort jamais pour un consultant
{
  const asked = [];
  for (let i = 0; i < 80; i++) {
    const q = S.nextQuestion({ originalPrompt: "la guerre froide", scores: S.score("la guerre froide"), asked, lang: "fr", profile: "consultant" });
    if (q.recycled) break;
    assert.notStrictEqual(q.key, "appro-13", "appro-13 est réservée au profil student");
    asked.push(q.key);
  }
}

console.log("scoring.test.js : toutes les assertions passent ✓");
