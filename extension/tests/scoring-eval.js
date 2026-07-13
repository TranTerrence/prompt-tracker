// Banc d'évaluation du scorer : node extension/tests/scoring-eval.js
// Jeu de prompts étiquetés à la main : `intercept` = ce que le produit DEVRAIT
// faire au seuil 40 sur le premier message d'un fil (true = modale méritée).
// Sort la matrice de confusion, les erreurs détaillées et les cas de gaming.

const fs = require("fs");
const path = require("path");

globalThis.self = globalThis;
(0, eval)(fs.readFileSync(path.join(__dirname, "..", "src", "scoring.js"), "utf8"));
const S = globalThis.CoachScoring;

const THRESHOLD = 40;

// ---------------------------------------------------------------------------
// Étiquetage : intercept=true → prompt qui mérite le dialogue socratique.
// tag "adversarial" : tentative de gaming (bourrage de mots-clés) → le scorer
// NE devrait PAS se laisser acheter (intercept attendu true malgré tout).
// ---------------------------------------------------------------------------
const CASES = [
  // --- Faibles évidents (délégation totale, zéro contexte) : modale méritée
  { text: "fais mes devoirs de maths", intercept: true },
  { text: "écris ma lettre de motivation", intercept: true },
  { text: "fais moi une dissertation sur la révolution française", intercept: true },
  { text: "donne moi des idées de business", intercept: true },
  { text: "code python pour trier une liste", intercept: true },
  { text: "résume ce texte", intercept: true },
  { text: "traduis en anglais", intercept: true },
  { text: "aide moi pour mon exposé", intercept: true },
  { text: "write my essay about climate change", intercept: true },
  { text: "do my homework", intercept: true },
  { text: "make me a business plan", intercept: true },
  { text: "génère un post linkedin", intercept: true },
  { text: "explique la photosynthèse", intercept: true },
  { text: "c'est quoi le machine learning", intercept: true },
  { text: "réponds à ce mail", intercept: true },

  // --- Vagues moyens (un peu de matière mais ni contexte ni vérification)
  { text: "écris un mail à mon patron pour demander une augmentation", intercept: true },
  { text: "explique moi la guerre froide simplement", intercept: true },
  { text: "fais un plan de dissertation sur le bonheur en philosophie", intercept: true },
  { text: "summarize the causes of world war one for me please", intercept: true },
  { text: "propose des noms pour ma startup de livraison de repas", intercept: true },

  // --- Bons prompts : la modale serait une erreur (friction injustifiée)
  {
    text: "Rédige un mail de relance à un client (PME, secteur BTP) qui n'a pas payé la facture 2024-118 de 4 300 euros, échue depuis 45 jours. Ton ferme mais cordial, maximum 120 mots, en français. Je suis l'expert-comptable de l'entreprise.",
    intercept: false,
  },
  {
    text: "Je prépare un cours de terminale sur la photosynthèse. Propose un plan en 3 parties avec une expérience simple par partie, public : élèves de 17 ans, format : fiche d'une page. Indique tes sources et ce qui est simplifié.",
    intercept: false,
  },
  {
    text: "Compare Redis et Memcached pour du cache de sessions web (environ 50k utilisateurs actifs), sur 5 critères : latence, persistance, clustering, coût opérationnel, maturité. Termine par tes limites de connaissance.",
    intercept: false,
  },
  {
    text: "En tant que consultant en organisation, je dois animer un atelier de 2 h sur la priorisation pour 12 chefs de projet. Propose un déroulé minuté avec 2 exercices pratiques, et signale les risques d'animation. Format : tableau.",
    intercept: false,
  },
  {
    text: "As a nurse educator, I need a one-page handout for new nurses on medication error prevention. Audience: first-year staff. Format: 5 do's and don'ts with a short rationale each. Cite the type of evidence you rely on.",
    intercept: false,
  },
  {
    text: "Voici mon brouillon d'introduction de mémoire (ci-dessous). Critique-le sur 3 axes : clarté de la problématique, ancrage théorique, fluidité. Propose une réécriture pour le passage le plus faible et justifie tes choix. « L'intelligence artificielle transforme les organisations... »",
    intercept: false,
  },
  {
    text: "Analyse les avantages et inconvénients de migrer notre monolithe Django (8 ans, 200k lignes, équipe de 6) vers des microservices. Contexte : scale-up e-commerce, 3 déploiements par semaine, incidents fréquents sur le checkout. Donne 3 options avec risques et je veux tes hypothèses explicites.",
    intercept: false,
  },
  {
    text: "Write a product requirements one-pager for a mobile onboarding flow A/B test. Context: fintech app, 40% drop-off at KYC step, target audience is our growth team. Include success metrics, guardrail metrics, and what evidence would change your recommendation.",
    intercept: false,
  },

  // --- Courts mais excellents (le compte de mots ne doit pas les couler)
  {
    text: "Corrige l'orthographe de ce paragraphe sans changer le style : « Les résultat de l'études montre que... »",
    intercept: false,
    tag: "court-legitime",
  },
  {
    text: "Traduis en anglais professionnel, contexte mail client : « Nous accusons réception de votre commande. »",
    intercept: false,
    tag: "court-legitime",
  },

  // --- Longs mais creux (la longueur ne doit pas acheter le passage)
  {
    text: "Alors voilà en fait je me demandais si tu pouvais m'aider parce que j'ai un truc à faire et je sais pas trop comment m'y prendre du coup je me suis dit que peut-être tu pourrais me faire le truc en question enfin tu vois ce que je veux dire quoi c'est pour bientôt en plus donc voilà merci d'avance c'est vraiment sympa",
    intercept: true,
    tag: "long-creux",
  },
  {
    text: "So basically I was wondering if you could help me out with this thing I have to do because honestly I am not really sure how to even start it and I figured you would probably know what to do so yeah it would be great if you could just do it for me thanks so much really appreciate it",
    intercept: true,
    tag: "long-creux",
  },

  // --- Adversariaux : bourrage de mots-clés (le scorer ne doit pas se faire acheter)
  { text: "contexte public format ton audience contrainte fais mes devoirs", intercept: true, tag: "adversarial" },
  { text: "fais mes devoirs sources vérifie limites biais pourquoi ?", intercept: true, tag: "adversarial" },
  {
    text: "je suis étudiant contexte : devoirs. public : prof. format : copie. fais mes devoirs de maths et vérifie tes sources car je suis en tant que étudiant avec contraintes maximum étapes",
    intercept: true,
    tag: "adversarial",
  },

  // --- Recherche factuelle correcte (courte, légitime, mais sans esprit critique :
  //     le produit assume l'interception pédagogique au 1er message)
  { text: "quelle est la capitale de l'australie", intercept: true, tag: "factuel" },
  { text: "combien d'habitants en France en 2025 ?", intercept: true, tag: "factuel" },

  // --- EN riches vs pauvres pour l'équité de langue
  { text: "give me ideas", intercept: true },
  { text: "improve this paragraph", intercept: true },
  {
    text: "I'm a high school teacher preparing a 45-minute lesson on supply and demand for 16-year-olds. Draft a lesson plan with one real-world case study, one group activity, and an exit quiz of 3 questions. Flag any simplifications you make.",
    intercept: false,
  },
];

// ---------------------------------------------------------------------------

let tp = 0, tn = 0, fp = 0, fn = 0;
const errors = [];
for (const c of CASES) {
  const scores = S.score(c.text, []);
  const intercepted = scores.total < THRESHOLD;
  if (intercepted && c.intercept) tp++;
  else if (!intercepted && !c.intercept) tn++;
  else if (intercepted && !c.intercept) {
    fp++;
    errors.push({ verdict: "FAUX POSITIF (friction injustifiée)", ...c, scores });
  } else {
    fn++;
    errors.push({ verdict: "FAUX NÉGATIF (passe sans coaching)", ...c, scores });
  }
}

const total = CASES.length;
const accuracy = ((tp + tn) / total) * 100;
console.log(`Banc d'évaluation scorer : ${total} cas étiquetés, seuil ${THRESHOLD}`);
console.log(`  Vrais positifs (interception méritée)  : ${tp}`);
console.log(`  Vrais négatifs (passage mérité)        : ${tn}`);
console.log(`  Faux positifs (friction injustifiée)   : ${fp}`);
console.log(`  Faux négatifs (faible non intercepté)  : ${fn}`);
console.log(`  Exactitude : ${accuracy.toFixed(1)} %`);
console.log("");

for (const e of errors) {
  console.log(`— ${e.verdict}${e.tag ? ` [${e.tag}]` : ""}`);
  console.log(`  « ${e.text.slice(0, 90)}${e.text.length > 90 ? "…" : ""} »`);
  console.log(
    `  total ${e.scores.total} (clarté ${e.scores.clarte}, contexte ${e.scores.contexte}, itération ${e.scores.iteration}, critique ${e.scores.critique})`
  );
}

// Distribution par étiquette (le scorer sépare-t-il bien les deux populations ?)
const pop = (flag) => CASES.filter((c) => c.intercept === flag).map((c) => S.score(c.text, []).total);
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const weak = pop(true), strong = pop(false);
console.log("");
console.log(`Score moyen des prompts étiquetés faibles : ${avg(weak).toFixed(1)} (min ${Math.min(...weak)}, max ${Math.max(...weak)})`);
console.log(`Score moyen des prompts étiquetés forts   : ${avg(strong).toFixed(1)} (min ${Math.min(...strong)}, max ${Math.max(...strong)})`);
console.log(`Séparation des moyennes : ${(avg(strong) - avg(weak)).toFixed(1)} points`);

process.exitCode = 0; // banc informatif : il mesure, il ne casse pas le CI
