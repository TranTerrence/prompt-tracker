// Analyse 100 % locale des prompts : catégorie + score qualité sur 4 rubriques,
// banque de questions socratiques (instanciées avec les mots du prompt, profondeur
// contingente au niveau apparent), questions post-réponse, compilation du prompt
// final, et helpers de progression (streak de premiers jets, seuil adaptatif).
// Bilingue FR/EN ; la langue est passée par l'appelant, défaut français.
// Module pur (aucune dépendance chrome) : testable en node.

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

  // « ton » n'est du contexte que suivi d'un adjectif de registre (sinon c'est
  // le possessif) ; « je suis / i am » est exclu devant une négation ou un
  // adverbe d'hésitation (« i am not sure » n'est pas un rôle).
  const CONTEXT_MARKERS = /\b(contexte|context|(?:je suis|i am|i'm) (?!(?:pas|not|really|just|sure|très|vraiment)\b)|nous sommes|mon objectif|my goal|pour (un|une|mon|ma|mes|des)|for (a|an|my|our)|à destination de|public|audience|ton (?:professionnel|formel|neutre|amical|direct|soutenu|ferme|léger|sérieux)|tone|format|contrainte|constraint|en tant que|as a|tu es|you are|agis comme|act as|maximum|minimum|étapes?|steps?)\b/i;
  const ITERATION_MARKERS = /\b(reformule|rephrase|améliore|improve|plutôt|instead|à la place|reprends|corrige|fix|ajuste|adjust|modifie|modify|précédent|previous|ta (réponse|proposition)|your (answer|response)|cette (réponse|version)|this (answer|version)|plus (court|long|simple|détaillé)|(shorter|longer|simpler)|autrement|version)\b/i;
  // « pourquoi/why » retirés : un interrogatif naïf n'est pas une posture
  // critique (il déclenchait déjà la catégorie recherche).
  // « vérifi\w* » couvre les conjugaisons (je vérifierai, il vérifiera...) :
  // trouvaille terrain, le futur est la formulation naturelle de la vérification.
  const CRITICAL_MARKERS = /\b(sources?|cite[sz]?|citations?|evidence|preuves?|vérifi\w*|verify|verif\w*|fiable|reliable|limites?|limitations?|risques?|risks?|biais|bias|alternatives?|contre[- ]arguments?|counter[- ]?arguments?|justifie|justify|nuance|incertitudes?|uncertaint(y|ies)|hypothèses?|assumptions?|es[- ]tu sûr|are you sure)\b/i;
  const ACTION_VERB = /\b(rédige|écris|explique|analyse|compare|résume|traduis|propose|liste|crée|génère|corrige|améliore|évalue|décris|calcule|trouve|donne|fais|montre|aide|write|explain|analyze|compare|summarize|translate|suggest|list|create|generate|fix|improve|evaluate|describe|calculate|find|give|make|show|help)\b/i;
  const FULL_DELEGATION = /^\s*(fais|écris|rédige|génère|crée|fais[- ]moi|donne[- ]moi|do|write|generate|create|make me|give me)\b/i;
  // Délégation détectée n'importe où (« ... fais mes devoirs ... ») : sert au
  // verrou anti-bourrage, que l'ancrage en début de texte laisserait contourner.
  const DELEGATION_ANYWHERE = /\b(fais|écris|rédige|génère|crée|do|write|generate|create|make)\b[^.!?\n]{0,30}\b(mes|mon|ma|my)\b/i;

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
  // d'usage (étudiant, consultant, salarié). Le dialogue est infini par
  // construction ; `label` sert au regroupement dans le prompt final compilé.
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
          { key: "clarte", level: 1, q: "Concrètement, qu'attends-tu comme résultat ? Un texte, un plan, une explication, du code ?" },
          { key: "intention-code", level: 1, cats: ["code"], q: "Que doit faire ce code exactement, et sur quel exemple d'entrée et de sortie le testeras-tu ?" },
          { key: "intention-redaction", level: 1, cats: ["rédaction"], q: "Quel effet ton texte doit-il produire sur son lecteur : convaincre, informer, rassurer ?" },
          { key: "intention-resume", level: 1, cats: ["résumé"], q: "Pour quel usage ce résumé : réviser, décider, transmettre ? Qu'est-ce qui doit absolument y survivre ?" },
          { key: "intention-analyse", level: 1, cats: ["analyse"], q: "Quelle décision ou conclusion cette analyse doit-elle te permettre de prendre ?" },
          { key: "intention-2", level: 1, q: "À quoi reconnaîtras-tu une bonne réponse ?" },
          { key: "intention-3", level: 2, q: "Que feras-tu de la réponse juste après l'avoir reçue ?" },
          { key: "intention-5", level: 2, q: "Décris la réponse idéale en une phrase : sa forme, sa longueur, son ton." },
          { key: "intention-4", level: 2, q: "Quelle est la vraie question derrière ta demande ?" },
          { key: "intention-6", level: 3, q: "Écris le critère précis qui te fera dire : cette réponse est utilisable telle quelle." },
          { key: "intention-7", level: 3, q: "De quel travail plus grand cette réponse n'est-elle qu'une étape, et qui jugera le résultat final ?" },
        ],
      },
      connaissance: {
        label: "Ce que je sais déjà ou ai tenté",
        questions: [
          { key: "delegation", level: 1, q: "Qu'as-tu déjà tenté ou réfléchi de ton côté, même rapidement ?" },
          { key: "connaissance-code", level: 1, cats: ["code"], q: "Quel message d'erreur ou comportement observes-tu exactement, et qu'as-tu déjà essayé ?" },
          { key: "connaissance-redaction", level: 1, cats: ["rédaction"], q: "Quelles idées ou quels fragments as-tu déjà, même en vrac ? Colle-les tels quels." },
          { key: "connaissance-recherche", level: 1, cats: ["recherche"], q: "Que crois-tu déjà savoir sur le sujet, et d'où te vient cette idée ?", qt: "Que crois-tu déjà savoir sur « {sujet} », et d'où te vient cette idée ?" },
          { key: "connaissance-2", level: 1, q: "Qu'en sais-tu déjà, même vaguement ?", qt: "Que sais-tu déjà sur « {sujet} », même vaguement ?" },
          { key: "connaissance-3", level: 1, q: "Quelle partie peux-tu faire toi-même, là, sans aide ?" },
          { key: "connaissance-4", level: 2, q: "Où as-tu déjà cherché avant de poser la question ici ?" },
          { key: "connaissance-5", level: 2, q: "Cite une source, un cours ou un document que tu as déjà sous la main sur ce sujet." },
          { key: "connaissance-6", level: 2, q: "Quelle partie du travail t'appartient de droit, celle où l'IA ne devrait être qu'un relecteur ?" },
          { key: "connaissance-7", level: 3, q: "Rédige d'abord ta version, même mauvaise, en trois phrases. C'est elle que l'IA améliorera." },
          { key: "connaissance-8", level: 3, q: "Qu'apprendrais-tu en le faisant toi-même que tu n'apprendras pas en le déléguant ?" },
        ],
      },
      hypothese: {
        label: "Ma tentative",
        questions: [
          { key: "hypothese-1", level: 1, q: "Si tu devais répondre toi-même, tu dirais quoi ?", qt: "Si tu devais répondre toi-même sur « {sujet} », tu dirais quoi ?" },
          { key: "hypothese-code", level: 1, cats: ["code"], q: "Quelle est ta piste : où penses-tu que ça casse, et pourquoi ?" },
          { key: "hypothese-4", level: 1, q: "Commence la réponse toi-même : écris la première phrase que tu attendrais de l'IA." },
          { key: "hypothese-analyse", level: 2, cats: ["analyse"], q: "Quel est ton avis provisoire, et quel fait pèse le plus dans la balance ?" },
          { key: "hypothese-2", level: 2, q: "Qu'est-ce qui te fait croire que c'est la bonne piste ?" },
          { key: "hypothese-5", level: 2, q: "De 0 à 10, quelle confiance as-tu dans ta piste ? Qu'est-ce qui te ferait monter d'un point ?" },
          { key: "hypothese-3", level: 3, q: "Et si c'était l'inverse ? Qu'est-ce qui rendrait la réponse opposée crédible ?" },
          { key: "hypothese-6", level: 3, q: "Formule le meilleur argument CONTRE ta piste. S'il est solide, que reste-t-il de ta position ?" },
          { key: "hypothese-7", level: 3, q: "Quelle preuve accepterais-tu comme démonstration que ta piste est fausse ?" },
        ],
      },
      contexte: {
        label: "Mon contexte",
        questions: [
          { key: "contexte", level: 1, q: "À quoi va servir cette réponse ? Donne le contexte en une phrase." },
          { key: "contexte-2", level: 1, q: "Quelles contraintes la réponse doit-elle absolument respecter ?" },
          { key: "contexte-3", level: 1, q: "Qui va lire ou utiliser {livrable}, et qu'est-ce qui compte pour cette personne ?" },
          { key: "contexte-code", level: 1, cats: ["code"], q: "Dans quel environnement ce code tourne-t-il : langage, version, bibliothèques, contraintes ?" },
          { key: "contexte-redaction", level: 1, cats: ["rédaction"], q: "Longueur, ton, échéance : quelles bornes ta rédaction doit-elle respecter ?" },
          { key: "contexte-traduction", level: 1, cats: ["traduction"], q: "Pour quel public et quel registre cette traduction : littérale, naturelle, technique ?" },
          { key: "contexte-4", level: 2, q: "Qu'est-ce qui distingue ta situation du cas général ? C'est ça que l'IA ne peut pas deviner." },
          { key: "contexte-5", level: 2, q: "Colle un extrait de ta matière (notes, brouillon, énoncé) : sur quoi l'IA doit-elle s'appuyer ?" },
          { key: "contexte-6", level: 3, q: "Quel détail de ton contexte, s'il manquait, rendrait la réponse inutilisable ?" },
        ],
      },
      critique: {
        label: "Comment je vérifierai",
        questions: [
          { key: "critique", level: 1, q: "Comment vérifieras-tu que la réponse est juste ?" },
          { key: "critique-recherche", level: 1, cats: ["recherche"], q: "Où pourras-tu croiser cette information ailleurs que dans l'IA ?" },
          { key: "critique-4", level: 1, q: "Quelles sources fiables demanderas-tu à l'appui de la réponse ?" },
          { key: "critique-code", level: 2, cats: ["code"], q: "Quel test écriras-tu pour prouver que le code marche, y compris sur les cas limites ?" },
          { key: "critique-analyse", level: 2, cats: ["analyse"], q: "Quels chiffres ou quels faits de la réponse exigeras-tu de pouvoir tracer jusqu'à une source ?" },
          { key: "critique-2", level: 2, q: "Que se passerait-il si la réponse était fausse et que tu ne t'en rendais pas compte ?" },
          { key: "critique-3", level: 2, q: "Sur quel point l'IA a-t-elle le plus de chances de se tromper ici ?", qt: "Sur « {sujet} », où l'IA a-t-elle le plus de chances de se tromper ?" },
          { key: "critique-5", level: 2, q: "Qu'est-ce que l'IA ne peut PAS savoir dans ton cas, et qui restera à vérifier par toi ?" },
          { key: "critique-9", level: 2, q: "À quel biais t'attends-tu dans la réponse : consensus mou, généralités, complaisance ?" },
          { key: "critique-6", level: 3, q: "Quel est le coût réel si tu utilises une réponse fausse : pour toi, pour qui te lit ?" },
          { key: "critique-7", level: 3, q: "Quelle partie de la réponse assumeras-tu de défendre sans pouvoir citer l'IA ?" },
          { key: "critique-8", level: 3, q: "Décide maintenant : qu'est-ce qui te fera rejeter la réponse plutôt que la retoucher ?" },
        ],
      },
      approfondissement: {
        label: "Ma réflexion",
        questions: [
          { key: "iteration", level: 1, q: "Ta demande a-t-elle bougé depuis le début de cette réflexion ? En quoi ?" },
          { key: "appro-7", level: 2, q: "Qu'est-ce que tu comprends mieux maintenant qu'au moment où tu as tapé ta demande ?" },
          { key: "appro-2", level: 2, q: "Qu'est-ce qui te ferait changer d'avis ?" },
          { key: "appro-3", level: 2, q: "Explique ton besoin comme à un enfant de 10 ans.", qt: "Explique « {sujet} » comme à un enfant de 10 ans." },
          { key: "appro-4", level: 2, q: "Qu'est-ce qui te manque vraiment pour avancer seul ?" },
          { key: "appro-6", level: 2, q: "Sans IA, quel serait ton plan en trois étapes ?" },
          { key: "appro-10", level: 2, q: "Quel est le point le plus fragile de ta compréhension du sujet ?", qt: "Quel est le point le plus fragile de ta compréhension de « {sujet} » ?" },
          { key: "appro-12", level: 2, q: "Dans une semaine, que voudras-tu avoir retenu de ce travail, IA mise à part ?" },
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
          { key: "clarte", level: 1, q: "Concretely, what do you expect as a result? A text, a plan, an explanation, some code?" },
          { key: "intention-code", level: 1, cats: ["code"], q: "What exactly must this code do, and on which input and output example will you test it?" },
          { key: "intention-redaction", level: 1, cats: ["rédaction"], q: "What effect must your text have on its reader: convince, inform, reassure?" },
          { key: "intention-resume", level: 1, cats: ["résumé"], q: "What is this summary for: revising, deciding, passing on? What must absolutely survive in it?" },
          { key: "intention-analyse", level: 1, cats: ["analyse"], q: "What decision or conclusion should this analysis allow you to make?" },
          { key: "intention-2", level: 1, q: "How will you recognize a good answer?" },
          { key: "intention-3", level: 2, q: "What will you do with the answer right after receiving it?" },
          { key: "intention-5", level: 2, q: "Describe the ideal answer in one sentence: its form, its length, its tone." },
          { key: "intention-4", level: 2, q: "What is the real question behind your request?" },
          { key: "intention-6", level: 3, q: "Write the precise criterion that will let you say: this answer is usable as is." },
          { key: "intention-7", level: 3, q: "What larger piece of work is this answer just one step of, and who will judge the final result?" },
        ],
      },
      connaissance: {
        label: "What I already know or tried",
        questions: [
          { key: "delegation", level: 1, q: "What have you already tried or thought about on your own, even briefly?" },
          { key: "connaissance-code", level: 1, cats: ["code"], q: "What error message or behavior are you actually seeing, and what have you already tried?" },
          { key: "connaissance-redaction", level: 1, cats: ["rédaction"], q: "What ideas or fragments do you already have, even messy ones? Paste them as they are." },
          { key: "connaissance-recherche", level: 1, cats: ["recherche"], q: "What do you think you already know about this, and where does that idea come from?", qt: "What do you think you already know about “{sujet}”, and where does that idea come from?" },
          { key: "connaissance-2", level: 1, q: "What do you already know about this, even vaguely?", qt: "What do you already know about “{sujet}”, even vaguely?" },
          { key: "connaissance-3", level: 1, q: "Which part can you do yourself, right now, without help?" },
          { key: "connaissance-4", level: 2, q: "Where did you already look before asking here?" },
          { key: "connaissance-5", level: 2, q: "Name one source, course or document you already have at hand on this topic." },
          { key: "connaissance-6", level: 2, q: "Which part of the work is rightfully yours, the one where AI should only be a proofreader?" },
          { key: "connaissance-7", level: 3, q: "Write your own version first, even a bad one, in three sentences. That is what the AI will improve." },
          { key: "connaissance-8", level: 3, q: "What would you learn by doing it yourself that you will not learn by delegating it?" },
        ],
      },
      hypothese: {
        label: "My attempt",
        questions: [
          { key: "hypothese-1", level: 1, q: "If you had to answer yourself, what would you say?", qt: "If you had to answer yourself about “{sujet}”, what would you say?" },
          { key: "hypothese-code", level: 1, cats: ["code"], q: "What is your lead: where do you think it breaks, and why?" },
          { key: "hypothese-4", level: 1, q: "Start the answer yourself: write the first sentence you would expect from the AI." },
          { key: "hypothese-analyse", level: 2, cats: ["analyse"], q: "What is your provisional view, and which fact weighs most in the balance?" },
          { key: "hypothese-2", level: 2, q: "What makes you believe it's the right lead?" },
          { key: "hypothese-5", level: 2, q: "From 0 to 10, how confident are you in your lead? What would move you up one point?" },
          { key: "hypothese-3", level: 3, q: "And if it were the opposite? What would make the opposite answer credible?" },
          { key: "hypothese-6", level: 3, q: "State the best argument AGAINST your lead. If it holds, what remains of your position?" },
          { key: "hypothese-7", level: 3, q: "What evidence would you accept as proof that your lead is wrong?" },
        ],
      },
      contexte: {
        label: "My context",
        questions: [
          { key: "contexte", level: 1, q: "What will this answer be used for? Give the context in one sentence." },
          { key: "contexte-2", level: 1, q: "Which constraints must the answer absolutely respect?" },
          { key: "contexte-3", level: 1, q: "Who will read or use {livrable}, and what matters to that person?" },
          { key: "contexte-code", level: 1, cats: ["code"], q: "In what environment does this code run: language, version, libraries, constraints?" },
          { key: "contexte-redaction", level: 1, cats: ["rédaction"], q: "Length, tone, deadline: which bounds must your writing respect?" },
          { key: "contexte-traduction", level: 1, cats: ["traduction"], q: "For which audience and register is this translation: literal, natural, technical?" },
          { key: "contexte-4", level: 2, q: "What makes your situation different from the general case? That is what the AI cannot guess." },
          { key: "contexte-5", level: 2, q: "Paste an excerpt of your material (notes, draft, assignment): what should the AI build on?" },
          { key: "contexte-6", level: 3, q: "Which detail of your context, if missing, would make the answer unusable?" },
        ],
      },
      critique: {
        label: "How I will verify",
        questions: [
          { key: "critique", level: 1, q: "How will you check that the answer is right?" },
          { key: "critique-recherche", level: 1, cats: ["recherche"], q: "Where will you be able to cross-check this information outside the AI?" },
          { key: "critique-4", level: 1, q: "Which reliable sources will you ask for in support of the answer?" },
          { key: "critique-code", level: 2, cats: ["code"], q: "What test will you write to prove the code works, including edge cases?" },
          { key: "critique-analyse", level: 2, cats: ["analyse"], q: "Which numbers or facts in the answer will you require to be traceable to a source?" },
          { key: "critique-2", level: 2, q: "What would happen if the answer were wrong and you didn't notice?" },
          { key: "critique-3", level: 2, q: "On which point is the AI most likely to be wrong here?", qt: "About “{sujet}”, where is the AI most likely to be wrong?" },
          { key: "critique-5", level: 2, q: "What can the AI NOT know in your case, that will remain for you to verify?" },
          { key: "critique-9", level: 2, q: "What bias do you expect in the answer: soft consensus, generalities, flattery?" },
          { key: "critique-6", level: 3, q: "What is the real cost if you use a wrong answer: for you, for whoever reads you?" },
          { key: "critique-7", level: 3, q: "Which part of the answer will you commit to defending without being able to cite the AI?" },
          { key: "critique-8", level: 3, q: "Decide now: what will make you reject the answer rather than patch it?" },
        ],
      },
      approfondissement: {
        label: "My reflection",
        questions: [
          { key: "iteration", level: 1, q: "Has your request shifted since the start of this reflection? How?" },
          { key: "appro-7", level: 2, q: "What do you understand better now than when you typed your request?" },
          { key: "appro-2", level: 2, q: "What would make you change your mind?" },
          { key: "appro-3", level: 2, q: "Explain your need as you would to a 10-year-old.", qt: "Explain “{sujet}” as you would to a 10-year-old." },
          { key: "appro-4", level: 2, q: "What do you really lack to move forward on your own?" },
          { key: "appro-6", level: 2, q: "Without AI, what would your three-step plan be?" },
          { key: "appro-10", level: 2, q: "What is the most fragile point in your understanding of the topic?", qt: "What is the most fragile point in your understanding of “{sujet}”?" },
          { key: "appro-12", level: 2, q: "A week from now, what will you want to have retained from this work, AI aside?" },
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

    const weakAxes = [
      ["intention", scores.clarte],
      ["contexte", scores.contexte],
      ["critique", scores.critique],
    ]
      .filter(([, v]) => v < 13)
      .sort((a, b) => a[1] - b[1])
      .map(([axis]) => axis);

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
