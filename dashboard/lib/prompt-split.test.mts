// Test DIFFÉRENTIEL du découpage : node --test lib/prompt-split.test.ts
//
// Il ne teste pas le parseur contre des chaînes écrites à la main, mais contre
// la VRAIE fonction de l'extension. Si quelqu'un reformule COMPILE_HEADERS ou
// change le format des lignes dans scoring.js, ce fichier échoue au prochain
// lancement — là où le précédent (dayStreakInfo, lib/stats.ts) se contente d'un
// commentaire disant que les deux implémentations doivent s'accorder. Un
// commentaire ne peut pas échouer.
//
// Chargement par eval, comme extension/tests/scoring.test.js et
// scripts/export-question-bank.mjs : scoring.js expose CoachScoring sur `self`.

import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { splitCompiledPrompt } from "./prompt-split.ts";

const here = dirname(fileURLToPath(import.meta.url));
(globalThis as unknown as { self: unknown }).self = globalThis;
(0, eval)(readFileSync(join(here, "..", "..", "extension", "src", "scoring.js"), "utf8"));
type Answer = { key: string; axis: string; label?: string; answer: string };
type Scoring = { compilePrompt: (prompt: string, answers: Answer[], lang: string) => string };
const S = (globalThis as unknown as { CoachScoring: Scoring }).CoachScoring;

const ANSWERS = [
  { key: "ctx-1", axis: "contexte", label: "Mon contexte", answer: "pour le lycée" },
  { key: "hyp-1", axis: "hypothese", label: "Ma tentative", answer: "je pense qu'il faut poser l'équation" },
  { key: "ctx-2", axis: "contexte", label: "Mon contexte", answer: "terminale\nDS demain" },
];

test("aller-retour contre le vrai compilePrompt, dans les deux langues", () => {
  for (const lang of ["fr", "en"]) {
    const compiled = S.compilePrompt("fais mes devoirs de maths", ANSWERS, lang);
    const split = splitCompiledPrompt(compiled);
    assert.strictEqual(split.compiled, true, `reconnu comme compilé (${lang})`);
    assert.strictEqual(split.draft, "fais mes devoirs de maths", `premier jet retrouvé (${lang})`);
    assert.strictEqual(split.scaffolding.length, ANSWERS.length, `toutes les réponses (${lang})`);
    for (const a of ANSWERS) {
      assert.ok(
        split.scaffolding.some((s) => s.answer === a.answer),
        `réponse retrouvée intacte : ${JSON.stringify(a.answer)} (${lang})`,
      );
    }
  }
});

test("une réponse multiligne survit entière", () => {
  const compiled = S.compilePrompt("ma demande", ANSWERS, "fr");
  const split = splitCompiledPrompt(compiled);
  const multi = split.scaffolding.find((s) => s.answer.includes("\n"));
  assert.ok(multi, "la réponse à sauts de ligne est bien rattachée");
  assert.strictEqual(multi!.answer, "terminale\nDS demain");
});

test("un brouillon qui contient lui-même l'en-tête coupe à la DERNIÈRE occurrence", () => {
  const piege = "Voici mon plan.\nMa réflexion préalable :\nje ne sais pas encore";
  const compiled = S.compilePrompt(piege, ANSWERS, "fr");
  const split = splitCompiledPrompt(compiled);
  assert.strictEqual(split.draft, piege, "le brouillon est rendu entier, en-tête compris");
  assert.strictEqual(split.scaffolding.length, ANSWERS.length);
});

test("un en-tête écrit par l'étudiant, sans lignes, n'est pas un prompt compilé", () => {
  const brut = "Explique-moi Candide.\nMa réflexion préalable :\nrien pour l'instant";
  const split = splitCompiledPrompt(brut);
  assert.strictEqual(split.compiled, false, "aucun brouillon n'est fabriqué");
  assert.strictEqual(split.draft, brut, "le texte est rendu tel quel");
});

test("un texte brut (issues sent / sent_anyway / cancelled) se replie proprement", () => {
  // compilePrompt sans réponse rend le prompt inchangé : c'est le cas de trois
  // issues sur quatre, où content.js stocke le brouillon et non le compilé.
  const brut = S.compilePrompt("fais mes devoirs", [], "fr");
  const split = splitCompiledPrompt(brut);
  assert.strictEqual(split.compiled, false);
  assert.strictEqual(split.draft, "fais mes devoirs");
  assert.deepStrictEqual(split.scaffolding, []);
  assert.strictEqual(split.header, null);
});

test("une réponse contenant deux-points n'affole pas la regex de libellé", () => {
  const answers = [{ key: "k", axis: "contexte", label: "Mon contexte", answer: "le plan est : A puis B" }];
  const split = splitCompiledPrompt(S.compilePrompt("ma demande", answers, "fr"));
  assert.strictEqual(split.scaffolding.length, 1);
  assert.strictEqual(split.scaffolding[0].label, "Mon contexte");
  assert.strictEqual(split.scaffolding[0].answer, "le plan est : A puis B");
});

test("tous les libellés de la banque tiennent dans la borne {1,40}", () => {
  // Si un libellé dépassait, stripScaffolding ET ce parseur cesseraient tous
  // deux de le reconnaître — de la même façon, ce qui est le but de recopier
  // la borne à l'identique, mais autant le savoir avant l'utilisateur.
  for (const lang of ["fr", "en"]) {
    for (const axis of ["contexte", "hypothese", "critique", "intention", "connaissance", "approfondissement"]) {
      const answers: Answer[] = [{ key: "k", axis, answer: "x" }];
      const split = splitCompiledPrompt(S.compilePrompt("d", answers, lang));
      assert.strictEqual(split.scaffolding.length, 1, `libellé de repli reconnu (${lang}/${axis})`);
    }
  }
});

test("le vide et l'absence ne lèvent pas", () => {
  assert.strictEqual(splitCompiledPrompt("").compiled, false);
  assert.strictEqual(splitCompiledPrompt("").draft, "");
});
