// Analyse 100 % locale des prompts : catégorie + score qualité sur 4 rubriques,
// banque de questions socratiques (instanciées avec les mots du prompt, profondeur
// contingente au niveau apparent), questions post-réponse, compilation du prompt
// final, et helpers de progression (streak de premiers jets, seuil adaptatif).
// Bilingue FR/EN ; la langue est passée par l'appelant, défaut français.
// Module pur (aucune dépendance chrome) : testable en node.

const CoachScoring = (() => {
  // FRONTIÈRES DE MOT UNICODE, ne pas revenir à « \b ».
  // « \b » raisonne en ASCII : « é » n'est pas un caractère de mot pour lui,
  // il n'y a donc AUCUNE frontière devant, et « \bécris » ne matche jamais.
  // Mesuré avant correction : « écris un mail… » perdait les 7 points de verbe
  // d'action que « rédige un mail… » obtenait, « donne les étapes » perdait
  // les 15 points de contexte que « give me the steps » obtenait, et « évalue
  // ces options » n'était pas classé en analyse. C'est un défaut de PARITÉ, et
  // il pénalisait le FRANÇAIS — l'inverse de ce que le retour terrain
  // supposait. D'où le barème v3 (scoringVersion dans content.js).
  // Le motif de gauche CONSOMME un caractère : tous les usages sont des
  // .test(), jamais des captures indexées.
  const CATEGORIES = [
    { key: "code", re: /(?:^|[^\p{L}\p{N}])(code|script|fonction|function|bug|erreur|error|python|javascript|sql|api|regex|debug)(?![\p{L}\p{N}])/iu },
    { key: "rédaction", re: /(?:^|[^\p{L}\p{N}])(rédige|écris|écrire|mail|email|lettre|letter|article|post|texte|message|réponds|write|draft|reply)(?![\p{L}\p{N}])/iu },
    { key: "résumé", re: /(?:^|[^\p{L}\p{N}])(résume|résumé|synthèse|synthétise|tl;?dr|points clés|summar(y|ize)|key points)(?![\p{L}\p{N}])/iu },
    { key: "traduction", re: /(?:^|[^\p{L}\p{N}])(traduis|traduction|translate|translation|en anglais|en français|in english|in french)(?![\p{L}\p{N}])/iu },
    { key: "analyse", re: /(?:^|[^\p{L}\p{N}])(analyse|analyze|compare|évalue|evaluate|avantages|inconvénients|pros and cons|pour et contre|critique)(?![\p{L}\p{N}])/iu },
    { key: "brainstorming", re: /(?:^|[^\p{L}\p{N}])(idées|ideas|brainstorm|propose|suggère|suggest|imagine|liste de|list of)(?![\p{L}\p{N}])/iu },
    { key: "recherche", re: /(?:^|[^\p{L}\p{N}])(qu'est[- ]ce|c'est quoi|qui est|quand|combien|pourquoi|explique|définis|définition|what is|who is|when|how many|why|explain|define)(?![\p{L}\p{N}])/iu },
  ];

  // « ton » n'est du contexte que suivi d'un adjectif de registre (sinon c'est
  // le possessif) ; « je suis / i am » est exclu devant une négation ou un
  // adverbe d'hésitation (« i am not sure » n'est pas un rôle).
  // L'espace qui suit « i am » est en LOOKAHEAD et non consommée : la
  // frontière droite du motif exige « pas de lettre après », et une
  // alternative qui se terminerait sur une espace ferait échouer cette
  // frontière dès que le mot suivant commence par une lettre — c'est-à-dire
  // toujours. Le banc d'évaluation a attrapé exactement ça.
  const CONTEXT_MARKERS = /(?:^|[^\p{L}\p{N}])(contexte|context|(?:je suis|i am|i'm)(?= (?!(?:pas|not|really|just|sure|très|vraiment)\b))|nous sommes|mon objectif|my goal|pour (un|une|mon|ma|mes|des)|for (a|an|my|our)|à destination de|public|audience|ton (?:professionnel|formel|neutre|amical|direct|soutenu|ferme|léger|sérieux)|tone|format|contrainte|constraint|en tant que|as a|tu es|you are|agis comme|act as|maximum|minimum|étapes?|steps?)(?![\p{L}\p{N}])/iu;
  const ITERATION_MARKERS = /(?:^|[^\p{L}\p{N}])(reformule|rephrase|améliore|improve|plutôt|instead|à la place|reprends|corrige|fix|ajuste|adjust|modifie|modify|précédent|previous|ta (réponse|proposition)|your (answer|response)|cette (réponse|version)|this (answer|version)|plus (court|long|simple|détaillé)|(shorter|longer|simpler)|autrement|version)(?![\p{L}\p{N}])/iu;
  // « pourquoi/why » retirés : un interrogatif naïf n'est pas une posture
  // critique (il déclenchait déjà la catégorie recherche).
  // « vérifi\w* » couvre les conjugaisons (je vérifierai, il vérifiera...) :
  // trouvaille terrain, le futur est la formulation naturelle de la vérification.
  const CRITICAL_MARKERS = /(?:^|[^\p{L}\p{N}])(sources?|cite[sz]?|citations?|evidence|preuves?|vérifi\w*|verify|verif\w*|fiable|reliable|limites?|limitations?|risques?|risks?|biais|bias|alternatives?|contre[- ]arguments?|counter[- ]?arguments?|justifie|justify|nuance|incertitudes?|uncertaint(y|ies)|hypothèses?|assumptions?|es[- ]tu sûr|are you sure)(?![\p{L}\p{N}])/iu;
  const ACTION_VERB = /(?:^|[^\p{L}\p{N}])(rédige|écris|explique|analyse|compare|résume|traduis|propose|liste|crée|génère|corrige|améliore|évalue|décris|calcule|trouve|donne|fais|montre|aide|write|draft|outline|do(?! (?:you|i|we|they|he|she|it)\b)|explain|analyze|compare|summarize|translate|suggest|list|create|generate|fix|improve|evaluate|describe|calculate|find|give|make|show|help)(?![\p{L}\p{N}])/iu;
  const FULL_DELEGATION = /^\s*(fais|écris|rédige|génère|crée|fais[- ]moi|donne[- ]moi|do|write|generate|create|make me|give me)\b/i;
  // Délégation détectée n'importe où (« ... fais mes devoirs ... ») : sert au
  // verrou anti-bourrage, que l'ancrage en début de texte laisserait contourner.
  const DELEGATION_ANYWHERE =
    new RegExp(
      "(?:^|[^\\p{L}\\p{N}])(fais|écris|rédige|génère|crée|do|write|generate|create|make)" +
        "(?![\\p{L}\\p{N}])[^.!?\\n]{0,30}(?:^|[^\\p{L}\\p{N}])(mes|mon|ma|my)(?![\\p{L}\\p{N}])",
      "iu"
    );

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function categorize(text) {
    for (const c of CATEGORIES) if (c.re.test(text)) return c.key;
    return "autre";
  }

  // Chaque rubrique vaut 0–25 ; le score total est sur 100.
  // Recalibration v2 (banc d'évaluation extension/tests/scoring-eval.js) :
  // les bonus de longueur comptent les mots UNIQUES (anti-répétition), la
  // « matière fournie » exige une vraie citation (pas un deux-points), et une
  // délégation totale sans matière ne peut pas acheter contexte/critique à
  // coups de mots-clés (règle nommée : « délégation sans matière »).
  function score(text, previousPrompts = []) {
    const words = wordCount(text);
    const uniqueWords = new Set(
      text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean)
    ).size;
    const hasMaterial = /[«"“].{15,}|```[\s\S]{15,}/.test(text);

    let clarte = 0;
    if (uniqueWords >= 8) clarte += 10;
    if (uniqueWords >= 20) clarte += 5;
    if (ACTION_VERB.test(text)) clarte += 7;
    if (/[?.!]/.test(text)) clarte += 3;

    let contexte = 0;
    if (CONTEXT_MARKERS.test(text)) contexte += 15;
    if (words >= 30) contexte += 5;
    if (hasMaterial) contexte += 5;

    let iteration = 0;
    if (ITERATION_MARKERS.test(text)) iteration += 20;

    let critique = 0;
    if (CRITICAL_MARKERS.test(text)) critique += 20;
    if (/\b(2|deux|two|3|trois|three|plusieurs|several) (options|versions|approches|approaches|angles)\b/i.test(text)) critique += 5;

    // Verrou anti-bourrage : une délégation sans matière ET sans élaboration
    // réelle (peu de vocabulaire distinct) ne peut pas acheter contexte et
    // esprit critique à coups de mots-clés. Une délégation RICHE (rôle,
    // contraintes, spécificités) n'est pas touchée.
    if ((FULL_DELEGATION.test(text) || DELEGATION_ANYWHERE.test(text)) && !hasMaterial && uniqueWords < 28) {
      contexte = Math.min(contexte, 6);
      critique = Math.min(critique, 6);
    }

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

  // Retire l'échafaudage de compilePrompt (en-tête + préfixes « - Label : »)
  // pour que le re-score de l'aperçu mesure le texte de l'utilisateur, pas la
  // structure injectée par le produit.
  function stripScaffolding(text) {
    const headers = new Set(Object.values(COMPILE_HEADERS).map((h) => h.trim()));
    return text
      .split("\n")
      .filter((line) => !headers.has(line.trim()))
      .map((line) => line.replace(/^\s*-\s[^:\n]{1,40}\s:\s/, ""))
      .join("\n");
  }

  /* ---------- Sujet du prompt (pour instancier les questions) ---------- */

  const STOPWORDS = {
    fr: new Set("le la les un une des du de d' l' et ou mais donc or ni car que qui quoi dont où je tu il elle on nous vous ils elles me te se moi toi lui leur y en ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leurs à au aux avec sans pour par sur sous dans chez vers entre est es suis sont être avoir ai as a avons avez ont fait faire fais peux peut veux veut dois doit très plus moins aussi comme si ne pas plaît plait merci stp svp bonjour salut alors bien tout toute tous toutes quelque chose".split(" ")),
    en: new Set("the a an and or but so nor for of to in on at by with without from into about as is are am be been was were do does did have has had can could will would should may might must i you he she it we they me him her us them my your his its our their this that these those what which who whom whose when where why how not no yes please thanks hello hi very more less also like if then than some any all just really something".split(" ")),
  };
  // Petits mots tolérés À L'INTÉRIEUR d'un groupe nominal (« devoirs de maths »).
  const CONNECTORS = new Set("de du des d' la le les l' à au aux en of the for to a an in on".split(" "));

  /* ---------- Langue du prompt (≠ langue d'interface) ---------- */

  // La banque de questions, l'extraction de sujet et l'en-tête de compilation
  // doivent suivre ce que l'utilisateur ÉCRIT, pas la locale de son navigateur.
  // Sans ça, un étudiant en Chrome français qui rédige en anglais reçoit des
  // questions françaises, et topic() passe les stopwords français sur du texte
  // anglais (sujets cassés du type « difference between TCP and UDP for a »).
  // C'est le vrai défaut derrière « ça ne marche pas en anglais » ; le barème,
  // lui, est bilingue depuis l'origine et mesuré à parité.
  // On ne décide PAS sur un compte de mots : les prompts qui déclenchent le
  // dialogue sont justement les plus courts (« do my homework », trois mots).
  // Un seuil de longueur les renvoyait tous au repli, c'est-à-dire à la langue
  // du navigateur — exactement le défaut à corriger. On décide sur la FORCE du
  // signal : au moins deux mots-outils exclusifs à une langue, et strictement
  // plus que l'autre. « do my homework » vaut deux (do, my) et tranche ;
  // « écris ça » n'en vaut aucun et retombe sur le repli, ce qui est honnête.
  const STRONG_SIGNAL = 2;

  // Les mots-outils ne suffisent pas toujours : « make me a business plan »
  // n'en a aucun d'exclusif (« me » et « a » existent dans les deux langues)
  // alors que « make » et « business » tranchent seuls. D'où ce petit lexique
  // d'appoint, volontairement court et sans ambigu : tout mot qui existe dans
  // les deux langues (compare, analyse, note, plan, message, format) en est
  // EXCLU, sans quoi il voterait des deux côtés. Frontières Unicode, pour la
  // même raison que les motifs du barème.
  const LANG_CUES = {
    fr: /(?:^|[^\p{L}\p{N}])(fais|écris|rédige|résume|traduis|explique|corrige|améliore|génère|crée|donne|montre|aide|cherche|trouve|calcule|décris|vérifie|devoirs|exposé|dissertation|mémoire|entreprise|réunion|élève|étudiant|leçon|chapitre|énoncé|brouillon|paragraphe)(?![\p{L}\p{N}])/iu,
    en: /(?:^|[^\p{L}\p{N}])(make|write|draft|summarize|translate|explain|fix|improve|generate|create|give|show|help|search|find|calculate|describe|check|homework|essay|assignment|report|business|meeting|student|evaluate|lesson|chapter|paragraph|outline)(?![\p{L}\p{N}])/iu,
  };

  function countCues(re, text) {
    return (text.match(new RegExp(re.source, re.flags + "g")) || []).length;
  }

  function detectLang(text, fallback = "fr") {
    const words = String(text || "")
      .toLowerCase()
      .replace(/['’]/g, "' ")
      .replace(/[«»"“”:;,.!?()[\]{}<>*_`~|]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    let fr = 0;
    let en = 0;
    for (const w of words) {
      // Un mot présent dans les deux listes (« a », « on », « or ») ne
      // départage rien : il ne compte pour personne.
      const inFr = STOPWORDS.fr.has(w);
      const inEn = STOPWORDS.en.has(w);
      if (inFr && !inEn) fr++;
      else if (inEn && !inFr) en++;
    }
    // Les diacritiques sont un indice fort mais pas un verdict : un seul « é »
    // venant d'un nom propre ou d'un copier-coller ne doit pas tout basculer.
    // On COMPTE les indices, on ne se contente pas de leur présence : « make
    // me a business plan » en a deux (make, business) et n'a aucun mot-outil
    // exclusif — sans le comptage, il resterait indécidable. Plafonnés à
    // STRONG_SIGNAL pour qu'un lexique d'appoint ne pèse jamais plus lourd
    // que la grammaire.
    fr += Math.min(STRONG_SIGNAL, countCues(LANG_CUES.fr, text));
    en += Math.min(STRONG_SIGNAL, countCues(LANG_CUES.en, text));
    if (/[àâäçéèêëîïôöùûüÿœæ]/i.test(text)) fr += STRONG_SIGNAL;
    if (fr >= STRONG_SIGNAL && fr > en) return "fr";
    if (en >= STRONG_SIGNAL && en > fr) return "en";
    return fallback; // signal trop faible : on ne devine pas
  }

  // Extrait le groupe nominal le plus riche du prompt (« devoirs de maths »),
  // pour instancier les gabarits de questions avec les mots de l'utilisateur
  // (King 1994 : les amorces marchent mieux ancrées dans la tâche réelle).
  // Retourne null quand rien d'assez consistant ne se dégage.
  function topic(text, lang = "fr") {
    const stop = STOPWORDS[lang] || STOPWORDS.fr;
    const words = text
      .replace(/['’]/g, "' ")
      .replace(/[«»"“”:;,.!?()[\]{}<>*_`~|]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const isContent = (w) => {
      const lower = w.toLowerCase();
      return !stop.has(lower) && !CONNECTORS.has(lower) && lower.length >= 3 && !/^\d+$/.test(lower) && !ACTION_VERB.test(lower);
    };

    let best = [];
    let bestContent = 0;
    let current = [];
    let currentContent = 0;
    const flush = () => {
      while (current.length && CONNECTORS.has(current[current.length - 1].toLowerCase())) current.pop();
      if (currentContent > bestContent || (currentContent === bestContent && current.length > best.length)) {
        best = current;
        bestContent = currentContent;
      }
      current = [];
      currentContent = 0;
    };
    for (const w of words) {
      if (isContent(w)) {
        current.push(w);
        currentContent++;
      } else if (CONNECTORS.has(w.toLowerCase()) && current.length) {
        current.push(w);
      } else {
        flush();
      }
    }
    flush();

    if (!bestContent) return null;
    let phrase = best.slice(0, 7).join(" ").replace(/' /g, "'");
    if (phrase.length > 42) phrase = phrase.slice(0, 42).replace(/\s+\S*$/, "");
    return phrase.length >= 3 ? phrase : null;
  }

  /* ---------- Typage des tours : suite ou ouvreur ---------- */

  // Amorces typiques d'une SUITE de conversation : raffinement, anaphore,
  // acquiescement. FR/EN mélangés comme les autres heuristiques du module.
  const FOLLOWUP_OPENER =
    /^\s*(et\b|ok\b|okay\b|oui\b|non\b|yes\b|no\b|mais\b|but\b|aussi\b|also\b|ensuite|maintenant|now\b|then\b|continue|poursuis|développe|détaille|approfondis|raccourcis|allonge|reformule|résume|traduis|corrige|améliore|refais|recommence|encore|plutôt|plus\b|moins\b|pareil|idem|vas[- ]y|go on|expand|elaborate|shorten|lengthen|rephrase|summarize|translate|fix\b|improve|redo|again|rather|instead|more\b|less\b|same\b|make it|ajoute|enlève|retire|change|remplace|add\b|remove|replace|ça\b|ca\b|celui|celle|cette réponse|le même|la même|this\b|that\b|it\b)/i;

  function contentTokens(text) {
    return new Set(
      text
        .toLowerCase()
        .replace(/['’]/g, "' ")
        .replace(/[«»"“”:;,.!?()[\]{}<>*_`~|]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.fr.has(w) && !STOPWORDS.en.has(w))
    );
  }

  // Une SUITE est un tour d'élaboration dans un fil déjà lancé : elle n'est
  // jamais un début de tâche, et ne doit donc jamais être jugée avec la
  // grille d'un premier prompt (erreur de catégorie). Heuristique : tour
  // court à amorce de raffinement/anaphore, ou fort recouvrement lexical
  // avec le prompt précédent.
  function isFollowUp(text, previousPrompts = []) {
    if (!previousPrompts.length) return false; // aucun historique : ouvreur
    if (wordCount(text) < 10 && FOLLOWUP_OPENER.test(text)) return true;
    const prev = contentTokens(previousPrompts[previousPrompts.length - 1] || "");
    const curr = contentTokens(text);
    if (!prev.size || !curr.size) return false;
    let inter = 0;
    for (const w of curr) if (prev.has(w)) inter++;
    const union = prev.size + curr.size - inter;
    return union > 0 && inter / union > 0.5;
  }

  /* ---------- Suggestion légère (toast avant-envoi) ---------- */

  // Retourne une suggestion socratique légère (toast) ou null. Sur une SUITE,
  // la brièveté est un usage normal du chat : jamais la suggestion « short »,
  // seules les opportunités critiques (sources, délégation, creuse) restent.
  function socraticSuggestion(text, scores, recentEvents = [], lang = "fr", isFollowUpTurn = false) {
    const S = SUGGESTIONS[lang] || SUGGESTIONS.fr;
    if (!isFollowUpTurn && wordCount(text) < 8) return S.short;
    if (FULL_DELEGATION.test(text) && scores.contexte < 10) return S.delegation;
    if (categorize(text) === "recherche" && scores.critique === 0) return S.sources;
    const lastThree = recentEvents.slice(-3);
    if (lastThree.length === 3 && lastThree.every((e) => e.scores.iteration === 0) && scores.iteration === 0) return S.dig;
    return null;
  }

  const SUGGESTIONS = {
    fr: {
      short: "Quel résultat précis attends-tu ? Ajoute le contexte, le public visé et le format souhaité : ta réponse n'en sera que meilleure.",
      delegation: "Qu'as-tu déjà essayé ou pensé ? Décris ta piste : l'IA la renforcera au lieu de penser à ta place.",
      sources: "Avant de réutiliser la réponse, demande-lui ses sources et ses limites. Une IA affirme avec le même aplomb quand elle se trompe.",
      dig: "Tu enchaînes les nouveaux sujets : creuse plutôt. Demande une critique ou une amélioration de la dernière réponse.",
    },
    en: {
      short: "What exact outcome do you expect? Add the context, audience and desired format : your answer will only get better.",
      delegation: "What have you already tried or thought? Describe your lead: the AI will strengthen it instead of thinking for you.",
      sources: "Before reusing the answer, ask for its sources and limitations. An AI asserts with the same confidence when it's wrong.",
      dig: "You keep jumping to new topics: dig instead. Ask for a critique or an improvement of the last answer.",
    },
  };

  /* ---------- Banques de questions (dialogue avant-envoi) ---------- */

  // Banques de questions métacognitives, par langue puis par axe de raisonnement.
  // `q` est la forme générique ; `qt`, quand elle existe, est la forme instanciée
  // avec {sujet} (les mots du prompt). {livrable} est remplacé selon le profil
  // d'usage (étudiant, consultant, salarié). nextQuestion ne rend jamais null :
  // c'est `coverage()` qui dit à l'appelant quand rendre la main, pas la banque
  // qui s'épuise ; `label` sert au regroupement dans le prompt final compilé.
  // Les clés sont stables entre langues (templates org).
  // Chaque entrée : { key (stable, contrat de surcharge org), q, qt? (forme
  // instanciée {sujet}), level (1 clarifier, 2 approfondir, 3 challenger),
  // cats? (catégories ciblées : sans correspondance, l'entrée est ignorée),
  // profiles? (profils onboarding ciblés). L'ORDRE du tableau est l'escalade :
  // les entrées douces d'abord, les exigeantes ensuite ; la sélection prend la
  // première entrée servable, la relance saute au niveau supérieur.
  const BANKS = {
    fr: {
      intention: {
        label: "Ce que je veux obtenir",
        questions: [
          { key: "clarte", level: 1, q: "Tu veux obtenir quoi, exactement : un texte, un plan, une explication, du code ?" },
          { key: "intention-code", level: 1, cats: ["code"], q: "Ton code doit faire quoi, exactement ?" },
          { key: "intention-redaction", level: 1, cats: ["rédaction"], q: "Ton texte doit produire quel effet sur celui qui le lit : convaincre, informer, rassurer ?" },
          { key: "intention-resume", level: 1, cats: ["résumé"], q: "Ce résumé va te servir à quoi : réviser, décider, transmettre ?" },
          { key: "intention-analyse", level: 1, cats: ["analyse"], q: "Cette analyse doit t'aider à décider quoi ?" },
          { key: "intention-2", level: 1, q: "Comment tu sauras que la réponse est bonne ?" },
          { key: "intention-3", level: 2, q: "Tu vas faire quoi de la réponse, juste après l'avoir reçue ?" },
          { key: "intention-5", level: 2, q: "Décris en une phrase la réponse que tu espères." },
          { key: "intention-4", level: 2, q: "Qu'est-ce que tu cherches vraiment à comprendre ?" },
          { key: "intention-6", level: 3, q: "Écris le critère précis qui te fera dire : cette réponse est utilisable telle quelle." },
          { key: "intention-7", level: 3, q: "De quel travail plus grand cette réponse n'est-elle qu'une étape, et qui jugera le résultat final ?" },
        ],
      },
      connaissance: {
        label: "Ce que je sais déjà ou ai tenté",
        questions: [
          { key: "delegation", level: 1, q: "Tu as déjà essayé quelque chose de ton côté ? Raconte, même si c'est court." },
          { key: "connaissance-code", level: 1, cats: ["code"], q: "Qu'est-ce qui se passe quand tu lances le code ? Colle le message d'erreur." },
          { key: "connaissance-redaction", level: 1, cats: ["rédaction"], q: "Tu as déjà des idées ou des bouts de phrases ? Colle-les ici, même en vrac." },
          { key: "connaissance-recherche", level: 1, cats: ["recherche"], q: "Tu crois savoir quoi sur ce sujet, avant de demander ?", qt: "Tu crois savoir quoi sur « {sujet} », avant de demander ?" },
          { key: "connaissance-2", level: 1, q: "Tu en sais déjà quoi, même vaguement ?", qt: "Tu sais déjà quoi sur « {sujet} », même vaguement ?" },
          { key: "connaissance-3", level: 1, q: "Quelle partie tu sais faire tout seul, là, maintenant ?" },
          { key: "connaissance-4", level: 2, q: "Tu as cherché où, avant de venir ici ?" },
          { key: "connaissance-5", level: 2, q: "Tu as un cours ou un document sur le sujet ? Lequel ?" },
          { key: "connaissance-6", level: 2, q: "Sur quelle partie tu veux que l'IA relise ton travail, plutôt que le faire à ta place ?" },
          { key: "connaissance-7", level: 3, q: "Rédige d'abord ta version, même mauvaise, en trois phrases. C'est elle que l'IA améliorera." },
          { key: "connaissance-8", level: 3, q: "Qu'apprendrais-tu en le faisant toi-même que tu n'apprendras pas en le déléguant ?" },
        ],
      },
      hypothese: {
        label: "Ma tentative",
        questions: [
          { key: "hypothese-1", level: 1, q: "Si tu devais répondre toi-même, tu dirais quoi ?", qt: "Si tu devais répondre toi-même sur « {sujet} », tu dirais quoi ?" },
          { key: "hypothese-code", level: 1, cats: ["code"], q: "D'après toi, ça casse où ?" },
          { key: "hypothese-4", level: 1, q: "Écris la première phrase de la réponse, toi-même." },
          { key: "hypothese-analyse", level: 2, cats: ["analyse"], q: "Ton avis pour l'instant, c'est quoi ?" },
          { key: "hypothese-2", level: 2, q: "Qu'est-ce qui te fait croire que c'est la bonne piste ?" },
          { key: "hypothese-5", level: 2, q: "De 0 à 10, tu as quelle confiance dans ta piste ?" },
          { key: "hypothese-3", level: 3, q: "Et si c'était l'inverse ? Qu'est-ce qui rendrait la réponse opposée crédible ?" },
          { key: "hypothese-6", level: 3, q: "Formule le meilleur argument CONTRE ta piste. S'il est solide, que reste-t-il de ta position ?" },
          { key: "hypothese-7", level: 3, q: "Quelle preuve accepterais-tu comme démonstration que ta piste est fausse ?" },
        ],
      },
      contexte: {
        label: "Mon contexte",
        questions: [
          { key: "contexte", level: 1, q: "Cette réponse va te servir à quoi ?" },
          { key: "contexte-2", level: 1, q: "Il y a des contraintes à respecter : longueur, délai, format ?" },
          { key: "contexte-3", level: 1, q: "Qui va lire {livrable} ?" },
          { key: "contexte-code", level: 1, cats: ["code"], q: "Ce code tourne où : quel langage, quelle version ?" },
          { key: "contexte-redaction", level: 1, cats: ["rédaction"], q: "Ton texte doit faire quelle longueur, et pour quand ?" },
          { key: "contexte-traduction", level: 1, cats: ["traduction"], q: "Cette traduction, c'est pour qui ?" },
          { key: "contexte-4", level: 2, q: "Qu'est-ce que l'IA ne peut pas deviner de ta situation ?" },
          { key: "contexte-5", level: 2, q: "Colle un bout de ta matière : l'énoncé, tes notes, ton brouillon." },
          { key: "contexte-6", level: 3, q: "Quel détail de ton contexte, s'il manquait, rendrait la réponse inutilisable ?" },
        ],
      },
      critique: {
        label: "Comment je vérifierai",
        questions: [
          { key: "critique", level: 1, q: "Comment tu vérifieras que la réponse est juste ?" },
          { key: "critique-recherche", level: 1, cats: ["recherche"], q: "Où tu pourras vérifier cette info, ailleurs que dans l'IA ?" },
          { key: "critique-4", level: 1, q: "Tu vas lui demander quelles sources ?" },
          { key: "critique-code", level: 2, cats: ["code"], q: "Tu vas tester ce code comment ?" },
          { key: "critique-analyse", level: 2, cats: ["analyse"], q: "Quels chiffres de la réponse tu vas vouloir vérifier ?" },
          { key: "critique-2", level: 2, q: "Que se passerait-il si la réponse était fausse et que tu ne t'en rendais pas compte ?" },
          { key: "critique-3", level: 2, q: "Sur quoi l'IA risque le plus de se tromper, ici ?", qt: "Sur « {sujet} », l'IA risque de se tromper où ?" },
          { key: "critique-5", level: 2, q: "Qu'est-ce que l'IA ne peut pas savoir dans ton cas ?" },
          { key: "critique-9", level: 2, q: "Tu t'attends à quoi de raté dans la réponse : du vague, des généralités, de la flatterie ?" },
          { key: "critique-6", level: 3, q: "Quel est le coût réel si tu utilises une réponse fausse : pour toi, pour qui te lit ?" },
          { key: "critique-7", level: 3, q: "Quelle partie de la réponse assumeras-tu de défendre sans pouvoir citer l'IA ?" },
          { key: "critique-8", level: 3, q: "Décide maintenant : qu'est-ce qui te fera rejeter la réponse plutôt que la retoucher ?" },
        ],
      },
      approfondissement: {
        label: "Ma réflexion",
        questions: [
          { key: "iteration", level: 1, q: "Ta demande a changé depuis tout à l'heure ?" },
          { key: "appro-7", level: 2, q: "Tu comprends quoi mieux qu'il y a cinq minutes ?" },
          { key: "appro-2", level: 2, q: "Qu'est-ce qui te ferait changer d'avis ?" },
          { key: "appro-3", level: 2, q: "Explique ton besoin comme à un enfant de 10 ans.", qt: "Explique « {sujet} » comme à un enfant de 10 ans." },
          { key: "appro-4", level: 2, q: "Qu'est-ce qui te manque vraiment pour avancer seul ?" },
          { key: "appro-6", level: 2, q: "Sans IA, quel serait ton plan en trois étapes ?" },
          { key: "appro-10", level: 2, q: "Qu'est-ce que tu comprends le moins bien, là-dedans ?", qt: "Dans « {sujet} », qu'est-ce que tu comprends le moins bien ?" },
          { key: "appro-12", level: 2, q: "Dans une semaine, tu veux avoir retenu quoi de ce travail ?" },
          { key: "appro-5", level: 3, q: "Quelle question évites-tu de te poser ?" },
          { key: "appro-8", level: 3, q: "Si tu ne pouvais poser qu'UNE question à un expert humain, laquelle ? Pose-la ici." },
          { key: "appro-9", level: 3, q: "Défends la position inverse pendant deux phrases. Qu'est-ce que ça t'apprend ?" },
          { key: "appro-11", level: 3, q: "Qu'est-ce qui, dans ta demande, relève de la facilité plutôt que du besoin ?" },
          { key: "appro-13", level: 3, profiles: ["student"], q: "Si ton enseignant te demandait de justifier chaque phrase de ta production, lesquelles tiendraient ?" },
          { key: "appro-14", level: 3, profiles: ["consultant", "employee"], q: "Si ton client ou ton équipe te demandait de justifier chaque affirmation, lesquelles tiendraient ?" },
        ],
      },
    },
    en: {
      intention: {
        label: "What I want to get",
        questions: [
          { key: "clarte", level: 1, q: "What do you want to get, exactly: a text, a plan, an explanation, some code?" },
          { key: "intention-code", level: 1, cats: ["code"], q: "What exactly should your code do?" },
          { key: "intention-redaction", level: 1, cats: ["rédaction"], q: "What effect should your text have on the person reading it: convince, inform, reassure?" },
          { key: "intention-resume", level: 1, cats: ["résumé"], q: "What is this summary for: revising, deciding, passing it on?" },
          { key: "intention-analyse", level: 1, cats: ["analyse"], q: "What should this analysis help you decide?" },
          { key: "intention-2", level: 1, q: "How will you know the answer is good?" },
          { key: "intention-3", level: 2, q: "What will you do with the answer, right after you get it?" },
          { key: "intention-5", level: 2, q: "Describe in one sentence the answer you are hoping for." },
          { key: "intention-4", level: 2, q: "What are you really trying to understand?" },
          { key: "intention-6", level: 3, q: "Write the precise criterion that will let you say: this answer is usable as is." },
          { key: "intention-7", level: 3, q: "What larger piece of work is this answer just one step of, and who will judge the final result?" },
        ],
      },
      connaissance: {
        label: "What I already know or tried",
        questions: [
          { key: "delegation", level: 1, q: "Have you already tried something on your own? Tell me, even if it's short." },
          { key: "connaissance-code", level: 1, cats: ["code"], q: "What happens when you run the code? Paste the error message." },
          { key: "connaissance-redaction", level: 1, cats: ["rédaction"], q: "Do you already have ideas or bits of sentences? Paste them here, even messy." },
          { key: "connaissance-recherche", level: 1, cats: ["recherche"], q: "What do you think you already know about this, before asking?", qt: "What do you think you already know about “{sujet}”, before asking?" },
          { key: "connaissance-2", level: 1, q: "What do you already know about this, even vaguely?", qt: "What do you already know about “{sujet}”, even vaguely?" },
          { key: "connaissance-3", level: 1, q: "Which part can you do on your own, right now?" },
          { key: "connaissance-4", level: 2, q: "Where did you look before coming here?" },
          { key: "connaissance-5", level: 2, q: "Do you have a course or a document on this? Which one?" },
          { key: "connaissance-6", level: 2, q: "On which part do you want the AI to proofread your work, rather than do it for you?" },
          { key: "connaissance-7", level: 3, q: "Write your own version first, even a bad one, in three sentences. That is what the AI will improve." },
          { key: "connaissance-8", level: 3, q: "What would you learn by doing it yourself that you will not learn by delegating it?" },
        ],
      },
      hypothese: {
        label: "My attempt",
        questions: [
          { key: "hypothese-1", level: 1, q: "If you had to answer yourself, what would you say?", qt: "If you had to answer yourself about “{sujet}”, what would you say?" },
          { key: "hypothese-code", level: 1, cats: ["code"], q: "Where do you think it breaks?" },
          { key: "hypothese-4", level: 1, q: "Write the first sentence of the answer yourself." },
          { key: "hypothese-analyse", level: 2, cats: ["analyse"], q: "What is your view, for now?" },
          { key: "hypothese-2", level: 2, q: "What makes you believe it's the right lead?" },
          { key: "hypothese-5", level: 2, q: "From 0 to 10, how confident are you in your lead?" },
          { key: "hypothese-3", level: 3, q: "And if it were the opposite? What would make the opposite answer credible?" },
          { key: "hypothese-6", level: 3, q: "State the best argument AGAINST your lead. If it holds, what remains of your position?" },
          { key: "hypothese-7", level: 3, q: "What evidence would you accept as proof that your lead is wrong?" },
        ],
      },
      contexte: {
        label: "My context",
        questions: [
          { key: "contexte", level: 1, q: "What will this answer be used for?" },
          { key: "contexte-2", level: 1, q: "Are there constraints to respect: length, deadline, format?" },
          { key: "contexte-3", level: 1, q: "Who will read {livrable}?" },
          { key: "contexte-code", level: 1, cats: ["code"], q: "Where does this code run: which language, which version?" },
          { key: "contexte-redaction", level: 1, cats: ["rédaction"], q: "How long should your text be, and by when?" },
          { key: "contexte-traduction", level: 1, cats: ["traduction"], q: "Who is this translation for?" },
          { key: "contexte-4", level: 2, q: "What can the AI not guess about your situation?" },
          { key: "contexte-5", level: 2, q: "Paste a bit of your material: the assignment, your notes, your draft." },
          { key: "contexte-6", level: 3, q: "Which detail of your context, if missing, would make the answer unusable?" },
        ],
      },
      critique: {
        label: "How I will verify",
        questions: [
          { key: "critique", level: 1, q: "How will you check that the answer is right?" },
          { key: "critique-recherche", level: 1, cats: ["recherche"], q: "Where will you be able to check this outside the AI?" },
          { key: "critique-4", level: 1, q: "Which sources will you ask it for?" },
          { key: "critique-code", level: 2, cats: ["code"], q: "How will you test this code?" },
          { key: "critique-analyse", level: 2, cats: ["analyse"], q: "Which numbers in the answer will you want to check?" },
          { key: "critique-2", level: 2, q: "What would happen if the answer were wrong and you didn't notice?" },
          { key: "critique-3", level: 2, q: "What is the AI most likely to get wrong here?", qt: "About “{sujet}”, what is the AI most likely to get wrong?" },
          { key: "critique-5", level: 2, q: "What can the AI not know in your case?" },
          { key: "critique-9", level: 2, q: "What do you expect to be off in the answer: vagueness, generalities, flattery?" },
          { key: "critique-6", level: 3, q: "What is the real cost if you use a wrong answer: for you, for whoever reads you?" },
          { key: "critique-7", level: 3, q: "Which part of the answer will you commit to defending without being able to cite the AI?" },
          { key: "critique-8", level: 3, q: "Decide now: what will make you reject the answer rather than patch it?" },
        ],
      },
      approfondissement: {
        label: "My reflection",
        questions: [
          { key: "iteration", level: 1, q: "Has your request changed since a moment ago?" },
          { key: "appro-7", level: 2, q: "What do you understand better than five minutes ago?" },
          { key: "appro-2", level: 2, q: "What would make you change your mind?" },
          { key: "appro-3", level: 2, q: "Explain your need as you would to a 10-year-old.", qt: "Explain “{sujet}” as you would to a 10-year-old." },
          { key: "appro-4", level: 2, q: "What do you really lack to move forward on your own?" },
          { key: "appro-6", level: 2, q: "Without AI, what would your three-step plan be?" },
          { key: "appro-10", level: 2, q: "What do you understand least well in all this?", qt: "In “{sujet}”, what do you understand least well?" },
          { key: "appro-12", level: 2, q: "A week from now, what do you want to have kept from this work?" },
          { key: "appro-5", level: 3, q: "Which question are you avoiding asking yourself?" },
          { key: "appro-8", level: 3, q: "If you could ask a human expert only ONE question, which one? Ask it here." },
          { key: "appro-9", level: 3, q: "Defend the opposite position for two sentences. What does that teach you?" },
          { key: "appro-11", level: 3, q: "What part of your request comes from convenience rather than need?" },
          { key: "appro-13", level: 3, profiles: ["student"], q: "If your teacher asked you to justify every sentence of your work, which ones would hold?" },
          { key: "appro-14", level: 3, profiles: ["consultant", "employee"], q: "If your client or your team asked you to justify every claim, which ones would hold?" },
        ],
      },
    },
  };

  // Vocabulaire du placeholder {livrable} selon le profil déclaré à l'onboarding.
  const DELIVERABLES = {
    fr: { student: "ton devoir", consultant: "ton livrable client", employee: "ton travail", default: "le résultat" },
    en: { student: "your assignment", consultant: "your client deliverable", employee: "your work", default: "the result" },
  };

  const COMPILE_HEADERS = { fr: "Ma réflexion préalable :", en: "My prior reasoning:" };

  // Axes exigeants (contre-factuel, vérification, méta) : différés pour les
  // prompts pauvres (Kalyuga : l'étayage profond nuit aux novices sans matière).
  const DEEP_AXES = new Set(["critique", "approfondissement"]);

  /* ---------- Couverture du dialogue : la fin naturelle ---------- */

  // Une rubrique sous ce seuil désigne un axe FAIBLE : c'est lui qu'il faut
  // travailler, et c'est sur lui que porte la promesse « une question par axe
  // faible, puis la main rendue ».
  const WEAK_RUBRIC = 13;

  function weakRubricAxes(scores) {
    return [
      ["intention", scores.clarte],
      ["contexte", scores.contexte],
      ["critique", scores.critique],
    ]
      .filter(([, v]) => v < WEAK_RUBRIC)
      .sort((a, b) => a[1] - b[1])
      .map(([axis]) => axis);
  }

  // Le dialogue est infini par construction (nextQuestion ne rend jamais null,
  // il recycle l'approfondissement). Sans borne, le recyclage se lit comme du
  // remplissage dès le deuxième tour — retour de terrain I-BE³. coverage() dit
  // à l'appelant QUAND rendre la main : quand chaque axe faible a reçu une
  // vraie réponse. La modale s'en sert pour basculer en clôture ; elle ne
  // ferme rien de force, l'utilisateur peut toujours demander une question de
  // plus. Même règle de priorité que nextQuestion : les axes faibles, plus la
  // tentative de l'utilisateur quand le prompt est une délégation totale.
  // Un axe n'est couvert que par une réponse NON VIDE : sinon il suffirait de
  // tout passer pour clore le dialogue.
  function coverage({ originalPrompt = "", scores, answers = [], lang = "fr" } = {}) {
    const bank = BANKS[lang] || BANKS.fr;
    const required = weakRubricAxes(scores);
    if (FULL_DELEGATION.test(originalPrompt)) required.unshift("hypothese");
    const answered = new Set(
      (answers || []).filter((a) => a.answer && a.answer.trim()).map((a) => a.axis)
    );
    const remaining = required.filter((a) => !answered.has(a));
    // Aucun axe faible : le prompt est déjà solide (interception venue du
    // filet anti-décrochage). Une seule vraie réponse suffit à rendre la main.
    const complete = required.length ? remaining.length === 0 : answered.size > 0;
    return {
      complete,
      axes: required,
      remaining,
      labels: required.map((a) => (bank[a] ? bank[a].label : a)),
    };
  }

  // Prochaine question du dialogue. Ne retourne jamais null : quand tout a été
  // posé, l'axe « approfondissement » recycle (sans reproposer la dernière).
  // Les templates de l'organisation écrasent les questions de même clé.
  // Profondeur contingente : prompt pauvre → clarifier d'abord, différer les axes
  // exigeants ; prompt déjà riche → creuser directement (hypothèses, vérification).
  // Délégation totale → la tentative de l'utilisateur d'abord (Buçinca : décider
  // avant de voir l'IA est la friction au meilleur ratio efficacité/acceptation).
  // state accepte en plus (champs additifs, tous optionnels) :
  //   answeredCount : réponses données ; la rotation d'axe s'indexe dessus
  //     (et non sur asked.length) pour qu'une relance ne fasse pas sauter d'axe ;
  //   reroll : relance explicite (« autre question ») : même axe, un cran
  //     d'exigence au-dessus, jamais une redite ;
  //   lastAxis, lastLevel : la question relancée (fournis par l'appelant).
  // Retour enrichi : { key, axis, label, question, level, source: "local",
  //   recycled } : recycled=true quand toutes les questions ADAPTÉES à ce
  //   prompt ont été posées (les entrées ciblées sur une autre catégorie ne
  //   sont jamais servies : une question code sur une dissertation est pire
  //   qu'une redite).
  function nextQuestion(state, templates = {}) {
    const { originalPrompt = "", scores, asked = [], lang = "fr", profile = null } = state;
    const bank = BANKS[lang] || BANKS.fr;
    const askedSet = new Set(asked);
    const words = wordCount(originalPrompt);
    const novice = scores.total < 25 || words < 12;
    const rich = scores.total >= 30 && words >= 20;
    const category = categorize(originalPrompt);
    const rot = Number.isFinite(state.answeredCount) ? state.answeredCount : asked.length;
    // Relance : viser strictement plus exigeant que la question écartée.
    const minLevel = state.reroll ? Math.min(3, (state.lastLevel || 1) + 1) : 0;

    const weakAxes = weakRubricAxes(scores);

    const order = [];
    if (state.reroll && state.lastAxis && bank[state.lastAxis]) order.push(state.lastAxis);
    if (FULL_DELEGATION.test(originalPrompt)) order.push("hypothese"); // tentative d'abord
    if (rich) order.push("hypothese", "critique");
    order.push(...weakAxes, "connaissance", "hypothese", "intention", "contexte", "critique", "approfondissement");
    const seen = new Set();
    let axes = order.filter((a) => !seen.has(a) && seen.add(a));
    if (novice && asked.length < 2) {
      axes = [...axes.filter((a) => !DEEP_AXES.has(a)), ...axes.filter((a) => DEEP_AXES.has(a))];
    }

    const subject = topic(originalPrompt, lang);
    const deliverable = (DELIVERABLES[lang] || DELIVERABLES.fr)[profile] || (DELIVERABLES[lang] || DELIVERABLES.fr).default;
    const fill = (q) => q.replace("{sujet}", subject || "").replace("{livrable}", deliverable);
    const wrap = (axis, entry, recycled) => ({
      key: entry.key,
      axis,
      label: bank[axis].label,
      question: templates[entry.key] || fill(subject && entry.qt ? entry.qt : entry.q),
      level: entry.level || 1,
      source: "local",
      recycled: Boolean(recycled),
    });

    // Une entrée est servable si : pas déjà posée, profil compatible, et
    // catégorie compatible (sans cats = générique ; avec cats = seulement si
    // le prompt est de cette catégorie). Les ciblées passent avant les
    // génériques ; l'ordre du tableau porte l'escalade d'exigence.
    const servable = (entries) => {
      const cands = entries.filter(
        (e) => !askedSet.has(e.key) && (!e.profiles || e.profiles.includes(profile))
      );
      const targeted = cands.filter((e) => e.cats && e.cats.includes(category));
      const generic = cands.filter((e) => !e.cats);
      return [...targeted, ...generic];
    };
    const pickEntry = (entries) => {
      const pool = servable(entries);
      if (!pool.length) return null;
      if (minLevel) {
        const harder = pool.filter((e) => (e.level || 1) >= minLevel);
        if (harder.length) return harder[0];
      }
      return pool[0];
    };

    // Rotation entre les axes (un tour = un axe différent) pour un vrai
    // ping-pong varié, en commençant par les axes prioritaires. Sur une
    // relance, l'axe de la question écartée reste prioritaire (pas de rotation).
    for (let i = 0; i < axes.length; i++) {
      const axis = state.reroll ? axes[i] : axes[(rot + i) % axes.length];
      const entry = pickEntry(bank[axis].questions);
      if (entry) return wrap(axis, entry);
    }

    // Banque épuisée : on recycle l'approfondissement, jamais deux fois de suite la même.
    const pool = bank.approfondissement.questions.filter(
      (e) => e.key !== asked[asked.length - 1] && (!e.profiles || e.profiles.includes(profile))
    );
    return wrap("approfondissement", pool[rot % pool.length], true);
  }

  // Assemble le prompt final : la demande initiale + la réflexion construite
  // pendant le dialogue, regroupée par axe. La tentative de l'utilisateur (axe
  // hypothèse) passe en tête : c'est elle que l'IA doit renforcer, pas remplacer.
  // Les réponses vides sont ignorées.
  function compilePrompt(originalPrompt, answers, lang = "fr") {
    const filled = (answers || []).filter((a) => a.answer && a.answer.trim());
    if (!filled.length) return originalPrompt;
    const ordered = [...filled.filter((a) => a.axis === "hypothese"), ...filled.filter((a) => a.axis !== "hypothese")];
    const fallbackLabel = (BANKS[lang] || BANKS.fr).approfondissement.label;
    const byLabel = new Map();
    for (const a of ordered) {
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

  /* ---------- Miroir d'après (une fois la réponse IA reçue) ---------- */

  // L'overreliance se joue APRÈS la réponse (Lee 2025) : trois gestes réflexifs,
  // jamais plus d'un par conversation. explain-back (auto-explication, Chi 1994),
  // lecture latérale (Wineburg 2019), désaccord (production générative, ICAP).
  const POST_QUESTIONS = {
    fr: {
      explain: "Reformule l'essentiel de cette réponse en une phrase, avec tes mots.",
      verify: "Quel point de cette réponse vérifieras-tu ailleurs avant de le réutiliser ?",
      disagree: "Sur quoi n'es-tu pas totalement d'accord avec cette réponse ?",
    },
    en: {
      explain: "Restate the gist of this answer in one sentence, in your own words.",
      verify: "Which point of this answer will you verify elsewhere before reusing it?",
      disagree: "What do you not fully agree with in this answer?",
    },
  };

  // Choisit le geste post-réponse : vérification prioritaire quand le prompt ne
  // montrait aucun esprit critique sur du factuel ; sinon rotation déterministe.
  function postQuestion({ category = "autre", scores = null, lang = "fr", count = 0 } = {}) {
    const bank = POST_QUESTIONS[lang] || POST_QUESTIONS.fr;
    let key;
    if (scores && scores.critique === 0 && (category === "recherche" || category === "analyse")) key = "verify";
    else key = ["explain", "disagree", "verify"][count % 3];
    return { key, question: bank[key] };
  }

  /* ---------- Progression : premiers jets, streak, seuil adaptatif ---------- */

  // Score du PREMIER JET : ce que l'utilisateur a écrit seul, avant tout coaching.
  // C'est la seule mesure honnête de l'apprentissage (P12) : les événements
  // interceptés portent scoreBefore, les autres ont leur score direct.
  function firstDraftScore(e) {
    if (!e) return null;
    if (e.scoreBefore !== null && e.scoreBefore !== undefined) return e.scoreBefore;
    return e.scores ? e.scores.total : null;
  }

  // Fading : la friction décroît avec la compétence démontrée. Chaque série de
  // 5 premiers jets consécutifs au-dessus du seuil de base relève le seuil
  // effectif de 2 points (plafond +15) : la barre monte avec l'utilisateur,
  // et retombe au premier jet raté (les difficultés restent désirables).
  function adaptiveThreshold(events, base, cap = 15) {
    let run = 0;
    for (let i = (events || []).length - 1; i >= 0; i--) {
      const s = firstDraftScore(events[i]);
      if (s === null) continue;
      if (s >= base) run++;
      else break;
    }
    return Math.min(95, base + Math.min(cap, 2 * Math.floor(run / 5)));
  }

  // Streak honnête : jours consécutifs (parmi les jours ACTIFS, les jours sans
  // prompt ne cassent rien) où la médiane des premiers jets atteint le seuil.
  // On célèbre l'autonomie, pas la dépendance au coaching.
  // Gel de série (mécanique Duolingo, RESEARCH P11) : chaque tranche de 7 jours
  // réussis consécutifs met un gel en réserve (2 max) ; un jour raté consomme
  // un gel au lieu de casser la série (il ne la fait pas avancer pour autant).
  // Tout est recalculé depuis l'historique : aucun état stocké, pas de triche.
  function dayStreakInfo(events, threshold, now = Date.now()) {
    const dayKeyOf = (ms) => {
      const d = new Date(ms);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    const byDay = new Map();
    for (const e of events || []) {
      const s = firstDraftScore(e);
      if (s === null || !e.ts) continue;
      const k = dayKeyOf(Date.parse(e.ts));
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(s);
    }
    const median = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const day = 24 * 3600 * 1000;
    let streak = 0;
    let freezes = 0;
    let successes = 0; // réussites consécutives, pour gagner les gels
    for (let i = 89; i >= 0; i--) {
      const scores = byDay.get(dayKeyOf(now - i * day));
      if (!scores) continue; // jour sans prompt : ni gagné ni perdu
      if (median(scores) >= threshold) {
        streak++;
        successes++;
        if (successes % 7 === 0 && freezes < 2) freezes++;
      } else if (freezes > 0) {
        freezes--; // jour gelé : la série tient, elle n'avance pas
        successes = 0;
      } else {
        streak = 0;
        successes = 0;
      }
    }
    return { streak, freezes };
  }

  function dayStreak(events, threshold, now = Date.now()) {
    return dayStreakInfo(events, threshold, now).streak;
  }

  return {
    categorize,
    score,
    stripScaffolding,
    topic,
    detectLang,
    coverage,
    isFollowUp,
    socraticSuggestion,
    nextQuestion,
    compilePrompt,
    postQuestion,
    firstDraftScore,
    adaptiveThreshold,
    dayStreak,
    dayStreakInfo,
    wordCount,
  };
})();

if (typeof self !== "undefined") self.CoachScoring = CoachScoring;
