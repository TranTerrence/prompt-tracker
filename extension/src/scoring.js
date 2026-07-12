// Analyse 100 % locale des prompts : catégorie + score qualité sur 4 rubriques,
// banque de questions socratiques et compilation du prompt final.
// Bilingue FR/EN : heuristiques et banques couvrent les deux langues ; la langue
// est passée par l'appelant (state.lang / paramètre lang), défaut français.
// Module pur (aucune dépendance chrome) — testable en node.

const CoachScoring = (() => {
  const CATEGORIES = [
    { key: "code", re: /\b(code|script|fonction|function|bug|erreur|error|python|javascript|sql|api|regex|debug)\b/i },
    { key: "rédaction", re: /\b(rédige|écris|écrire|mail|email|lettre|letter|article|post|texte|message|réponds|write|draft|reply)\b/i },
    { key: "résumé", re: /\b(résume|résumé|synthèse|synthétise|tl;?dr|points clés|summar(y|ize)|key points)\b/i },
    { key: "traduction", re: /\b(traduis|traduction|translate|translation|en anglais|en français|in english|in french)\b/i },
    { key: "analyse", re: /\b(analyse|analyze|compare|évalue|evaluate|avantages|inconvénients|pros and cons|pour et contre|critique)\b/i },
    { key: "brainstorming", re: /\b(idées|ideas|brainstorm|propose|suggère|suggest|imagine|liste de|list of)\b/i },
    { key: "recherche", re: /\b(qu'est[- ]ce|c'est quoi|qui est|quand|combien|pourquoi|explique|définis|définition|what is|who is|when|how many|why|explain|define)\b/i },
  ];

  const CONTEXT_MARKERS = /\b(contexte|context|je suis|i am|i'm|nous sommes|mon objectif|my goal|pour (un|une|mon|ma|mes|des)|for (a|an|my|our)|à destination de|public|audience|ton|tone|format|contrainte|constraint|en tant que|as a|tu es|you are|agis comme|act as|maximum|minimum|étapes?|steps?)\b/i;
  const ITERATION_MARKERS = /\b(reformule|rephrase|améliore|improve|plutôt|instead|à la place|reprends|corrige|fix|ajuste|adjust|modifie|modify|précédent|previous|ta (réponse|proposition)|your (answer|response)|cette (réponse|version)|this (answer|version)|plus (court|long|simple|détaillé)|(shorter|longer|simpler)|autrement|version)\b/i;
  const CRITICAL_MARKERS = /\b(sources?|vérifie|verify|fiable|reliable|limites?|limitations?|risques?|risks?|biais|bias|alternatives?|contre[- ]arguments?|counter[- ]?arguments?|pourquoi|why|justifie|justify|nuance|incertitudes?|uncertaint(y|ies)|hypothèses?|assumptions?|es[- ]tu sûr|are you sure)\b/i;
  const ACTION_VERB = /\b(rédige|écris|explique|analyse|compare|résume|traduis|propose|liste|crée|génère|corrige|améliore|évalue|décris|calcule|trouve|donne|fais|montre|aide|write|explain|analyze|compare|summarize|translate|suggest|list|create|generate|fix|improve|evaluate|describe|calculate|find|give|make|show|help)\b/i;
  const FULL_DELEGATION = /^\s*(fais|écris|rédige|génère|crée|fais[- ]moi|donne[- ]moi|do|write|generate|create|make me|give me)\b/i;

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function categorize(text) {
    for (const c of CATEGORIES) if (c.re.test(text)) return c.key;
    return "autre";
  }

  // Chaque rubrique vaut 0–25 ; le score total est sur 100.
  function score(text, previousPrompts = []) {
    const words = wordCount(text);

    let clarte = 0;
    if (words >= 8) clarte += 10;
    if (words >= 20) clarte += 5;
    if (ACTION_VERB.test(text)) clarte += 7;
    if (/[?.!]/.test(text)) clarte += 3;

    let contexte = 0;
    if (CONTEXT_MARKERS.test(text)) contexte += 15;
    if (words >= 30) contexte += 5;
    if (/:\s|«|"|```/.test(text)) contexte += 5; // matière fournie (citation, données, code)

    let iteration = 0;
    if (ITERATION_MARKERS.test(text)) iteration += 20;
    if (previousPrompts.length > 0 && words < wordCount(previousPrompts[previousPrompts.length - 1] || "") * 3) iteration += 5;

    let critique = 0;
    if (CRITICAL_MARKERS.test(text)) critique += 20;
    if (/\b(2|deux|two|3|trois|three|plusieurs|several) (options|versions|approches|approaches|angles)\b/i.test(text)) critique += 5;

    const clamp = (v) => Math.min(25, v);
    const scores = {
      clarte: clamp(clarte),
      contexte: clamp(contexte),
      iteration: clamp(iteration),
      critique: clamp(critique),
    };
    scores.total = scores.clarte + scores.contexte + scores.iteration + scores.critique;
    return scores;
  }

  // Retourne une suggestion socratique légère (toast) ou null.
  function socraticSuggestion(text, scores, recentEvents = [], lang = "fr") {
    const S = SUGGESTIONS[lang] || SUGGESTIONS.fr;
    if (wordCount(text) < 8) return S.short;
    if (FULL_DELEGATION.test(text) && scores.contexte < 10) return S.delegation;
    if (categorize(text) === "recherche" && scores.critique === 0) return S.sources;
    const lastThree = recentEvents.slice(-3);
    if (lastThree.length === 3 && lastThree.every((e) => e.scores.iteration === 0) && scores.iteration === 0) return S.dig;
    return null;
  }

  const SUGGESTIONS = {
    fr: {
      short: "Quel résultat précis attends-tu ? Ajoute le contexte, le public visé et le format souhaité — ta réponse n'en sera que meilleure.",
      delegation: "Qu'as-tu déjà essayé ou pensé ? Décris ta piste : l'IA la renforcera au lieu de penser à ta place.",
      sources: "Avant de réutiliser la réponse, demande-lui ses sources et ses limites. Une IA affirme avec le même aplomb quand elle se trompe.",
      dig: "Tu enchaînes les nouveaux sujets : creuse plutôt. Demande une critique ou une amélioration de la dernière réponse.",
    },
    en: {
      short: "What exact outcome do you expect? Add the context, audience and desired format — your answer will only get better.",
      delegation: "What have you already tried or thought? Describe your lead: the AI will strengthen it instead of thinking for you.",
      sources: "Before reusing the answer, ask for its sources and limitations. An AI asserts with the same confidence when it's wrong.",
      dig: "You keep jumping to new topics: dig instead. Ask for a critique or an improvement of the last answer.",
    },
  };

  // Banques de questions métacognitives, par langue puis par axe de raisonnement.
  // Le dialogue est infini par construction ; `label` sert au regroupement dans
  // le prompt final compilé. Les clés sont stables entre langues (templates org).
  const BANKS = {
    fr: {
      intention: {
        label: "Ce que je veux obtenir",
        questions: [
          { key: "clarte", q: "Quel résultat précis attends-tu ? (livrable, format, longueur)" },
          { key: "intention-2", q: "À quoi verras-tu que la réponse est réussie ?" },
          { key: "intention-3", q: "Que feras-tu concrètement de la réponse une fois obtenue ?" },
          { key: "intention-4", q: "Quelle est la vraie question derrière ta question ?" },
        ],
      },
      connaissance: {
        label: "Ce que je sais déjà ou ai tenté",
        questions: [
          { key: "delegation", q: "Qu'as-tu déjà essayé ou pensé toi-même ? Décris ta piste : l'IA la renforcera au lieu de penser à ta place." },
          { key: "connaissance-2", q: "Que sais-tu déjà sur ce sujet, même approximativement ?" },
          { key: "connaissance-3", q: "Quelle partie pourrais-tu faire sans l'IA ?" },
          { key: "connaissance-4", q: "Où as-tu déjà cherché avant de demander ici ?" },
        ],
      },
      hypothese: {
        label: "Mon hypothèse",
        questions: [
          { key: "hypothese-1", q: "Quelle est TA réponse provisoire, même imparfaite ?" },
          { key: "hypothese-2", q: "Qu'est-ce qui te fait penser que c'est la bonne piste ?" },
          { key: "hypothese-3", q: "Quelle serait la réponse opposée à la tienne — et qu'est-ce qui la rendrait crédible ?" },
        ],
      },
      contexte: {
        label: "Mon contexte",
        questions: [
          { key: "contexte", q: "Quel est le contexte ? (qui es-tu, pour qui, avec quelles contraintes)" },
          { key: "contexte-2", q: "Quelles contraintes la réponse doit-elle absolument respecter ?" },
          { key: "contexte-3", q: "Qui utilisera le résultat, et qu'est-ce qui compte pour cette personne ?" },
        ],
      },
      critique: {
        label: "Comment je vérifierai",
        questions: [
          { key: "critique", q: "Comment vérifieras-tu la réponse ? Pense à demander sources, limites ou alternatives." },
          { key: "critique-2", q: "Quel serait le pire effet d'une réponse fausse ici ?" },
          { key: "critique-3", q: "Sur quoi l'IA risque-t-elle le plus de se tromper dans ce sujet ?" },
        ],
      },
      approfondissement: {
        label: "Ma réflexion",
        questions: [
          { key: "iteration", q: "En quoi ta demande a-t-elle évolué depuis le début de cette réflexion ?" },
          { key: "appro-2", q: "Qu'est-ce qui te ferait changer d'avis sur ce que tu viens de dire ?" },
          { key: "appro-3", q: "Si tu devais expliquer ton besoin à un enfant de 10 ans, tu dirais quoi ?" },
          { key: "appro-4", q: "Qu'est-ce qui te manque vraiment pour avancer seul ?" },
          { key: "appro-5", q: "Quelle question devrais-tu te poser que tu évites ?" },
          { key: "appro-6", q: "Quel serait ton plan en trois étapes si l'IA n'existait pas ?" },
        ],
      },
    },
    en: {
      intention: {
        label: "What I want to get",
        questions: [
          { key: "clarte", q: "What exact outcome do you expect? (deliverable, format, length)" },
          { key: "intention-2", q: "How will you know the answer is a success?" },
          { key: "intention-3", q: "What will you concretely do with the answer once you have it?" },
          { key: "intention-4", q: "What is the real question behind your question?" },
        ],
      },
      connaissance: {
        label: "What I already know or tried",
        questions: [
          { key: "delegation", q: "What have you already tried or thought yourself? Describe your lead: the AI will strengthen it instead of thinking for you." },
          { key: "connaissance-2", q: "What do you already know about this topic, even roughly?" },
          { key: "connaissance-3", q: "Which part could you do without the AI?" },
          { key: "connaissance-4", q: "Where did you already look before asking here?" },
        ],
      },
      hypothese: {
        label: "My hypothesis",
        questions: [
          { key: "hypothese-1", q: "What is YOUR provisional answer, even an imperfect one?" },
          { key: "hypothese-2", q: "What makes you think it's the right lead?" },
          { key: "hypothese-3", q: "What would the opposite answer be — and what would make it credible?" },
        ],
      },
      contexte: {
        label: "My context",
        questions: [
          { key: "contexte", q: "What is the context? (who you are, for whom, with what constraints)" },
          { key: "contexte-2", q: "Which constraints must the answer absolutely respect?" },
          { key: "contexte-3", q: "Who will use the result, and what matters to that person?" },
        ],
      },
      critique: {
        label: "How I will verify",
        questions: [
          { key: "critique", q: "How will you verify the answer? Think about asking for sources, limitations or alternatives." },
          { key: "critique-2", q: "What would be the worst effect of a wrong answer here?" },
          { key: "critique-3", q: "Where is the AI most likely to be wrong on this topic?" },
        ],
      },
      approfondissement: {
        label: "My reflection",
        questions: [
          { key: "iteration", q: "How has your request evolved since the start of this reflection?" },
          { key: "appro-2", q: "What would make you change your mind about what you just said?" },
          { key: "appro-3", q: "If you had to explain your need to a 10-year-old, what would you say?" },
          { key: "appro-4", q: "What do you really lack to move forward on your own?" },
          { key: "appro-5", q: "What question should you be asking yourself that you're avoiding?" },
          { key: "appro-6", q: "What would your three-step plan be if AI didn't exist?" },
        ],
      },
    },
  };

  const COMPILE_HEADERS = { fr: "Ma réflexion préalable :", en: "My prior reasoning:" };

  // Prochaine question du dialogue. Ne retourne jamais null : quand tout a été
  // posé, l'axe « approfondissement » recycle (sans reproposer la dernière).
  // Les templates de l'organisation écrasent les questions de même clé.
  function nextQuestion(state, templates = {}) {
    const { originalPrompt = "", scores, asked = [], lang = "fr" } = state;
    const bank = BANKS[lang] || BANKS.fr;
    const askedSet = new Set(asked);

    const weakAxes = [
      ["intention", scores.clarte],
      ["contexte", scores.contexte],
      ["critique", scores.critique],
    ]
      .filter(([, v]) => v < 13)
      .sort((a, b) => a[1] - b[1])
      .map(([axis]) => axis);

    const order = [];
    if (FULL_DELEGATION.test(originalPrompt)) order.push("connaissance");
    order.push(...weakAxes, "connaissance", "hypothese", "intention", "contexte", "critique", "approfondissement");
    const seen = new Set();
    const axes = order.filter((a) => !seen.has(a) && seen.add(a));

    const wrap = (axis, entry) => ({
      key: entry.key,
      axis,
      label: bank[axis].label,
      question: templates[entry.key] || entry.q,
    });

    // Rotation entre les axes (un tour = un axe différent) pour un vrai
    // ping-pong varié, en commençant par les axes prioritaires.
    for (let i = 0; i < axes.length; i++) {
      const axis = axes[(asked.length + i) % axes.length];
      const entry = bank[axis].questions.find((e) => !askedSet.has(e.key));
      if (entry) return wrap(axis, entry);
    }

    // Banque épuisée : on recycle l'approfondissement, jamais deux fois de suite la même.
    const pool = bank.approfondissement.questions.filter((e) => e.key !== asked[asked.length - 1]);
    return wrap("approfondissement", pool[asked.length % pool.length]);
  }

  // Assemble le prompt final : la demande initiale + la réflexion construite
  // pendant le dialogue, regroupée par axe. Les réponses vides sont ignorées.
  function compilePrompt(originalPrompt, answers, lang = "fr") {
    const filled = (answers || []).filter((a) => a.answer && a.answer.trim());
    if (!filled.length) return originalPrompt;
    const fallbackLabel = (BANKS[lang] || BANKS.fr).approfondissement.label;
    const byLabel = new Map();
    for (const a of filled) {
      const label = a.label || fallbackLabel;
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label).push(a.answer.trim());
    }
    const lines = [];
    for (const [label, items] of byLabel) {
      for (const item of items) lines.push(`- ${label} : ${item}`);
    }
    return `${originalPrompt.trim()}\n\n${COMPILE_HEADERS[lang] || COMPILE_HEADERS.fr}\n${lines.join("\n")}`;
  }

  return { categorize, score, socraticSuggestion, nextQuestion, compilePrompt, wordCount };
})();

if (typeof self !== "undefined") self.CoachScoring = CoachScoring;
