#!/usr/bin/env node
// Exporte la banque de questions socratiques de l'extension vers un JSON lu
// par le dashboard : scripts/export-question-bank.mjs
//
// POURQUOI CE SCRIPT. La banque vit dans `extension/src/scoring.js` et nulle
// part ailleurs — c'est elle que l'extension sert, hors ligne, sans réseau.
// Le dashboard doit pourtant la connaître pour proposer la surcharge par
// organisation. Recopier les ~66 entrées à la main dans du TypeScript créerait
// deux sources de vérité qui divergeraient au premier correctif de formulation.
// On l'extrait donc, et l'écran d'administration lit le résultat.
//
// À REJOUER après toute modification de BANKS dans scoring.js.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "extension", "src", "scoring.js"), "utf8");

// Même motif de chargement que les tests : le module s'expose sur `self`.
globalThis.self = globalThis;
new Function(src)();

// BANKS n'est pas exporté (c'est un détail d'implémentation du module) : on le
// relit dans la source, qui est un littéral objet pur.
const literal = src.match(/const BANKS = (\{[\s\S]*?\n {2}\});/);
if (!literal) {
  console.error("BANKS introuvable dans scoring.js — le format a changé ?");
  process.exit(1);
}
const BANKS = new Function(`return (${literal[1]})`)();

const axes = Object.keys(BANKS.fr);
const entries = [];
for (const axis of axes) {
  const fr = BANKS.fr[axis].questions;
  const en = (BANKS.en[axis] || { questions: [] }).questions;
  const byKey = new Map(en.map((q) => [q.key, q]));
  for (const q of fr) {
    const twin = byKey.get(q.key);
    if (!twin) {
      console.error(`Clé « ${q.key} » absente de la banque anglaise (axe ${axis}).`);
      process.exit(1);
    }
    entries.push({
      axis,
      axis_label: BANKS.fr[axis].label,
      axis_label_en: (BANKS.en[axis] || {}).label ?? BANKS.fr[axis].label,
      key: q.key,
      level: q.level ?? 1,
      cats: q.cats ?? null,
      profiles: q.profiles ?? null,
      question_fr: q.q,
      question_en: twin.q,
    });
  }
}

const keys = entries.map((e) => e.key);
const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
if (dupes.length) {
  // Une clé en double rendrait la surcharge d'organisation ambiguë : deux
  // questions différentes réécrites par une seule ligne en base.
  console.error(`Clés dupliquées dans la banque : ${[...new Set(dupes)].join(", ")}`);
  process.exit(1);
}

const out = join(root, "dashboard", "lib", "question-bank.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      _comment:
        "GÉNÉRÉ par scripts/export-question-bank.mjs depuis extension/src/scoring.js. Ne pas éditer à la main : la banque de référence est celle de l'extension.",
      axes: axes.map((a) => ({ key: a, label: BANKS.fr[a].label })),
      questions: entries,
    },
    null,
    2
  ) + "\n",
  "utf8"
);
console.log(`${entries.length} questions exportées vers ${out.replace(root + "/", "")}`);
