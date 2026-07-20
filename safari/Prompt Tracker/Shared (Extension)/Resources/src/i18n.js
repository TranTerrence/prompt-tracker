// Internationalisation FR/EN des surfaces de l'extension. La langue suit celle
// du navigateur (chrome.i18n), repli français. Les chaînes vivent ici (un seul
// catalogue) ; _locales/ ne porte que le nom et la description du manifest.

const CoachI18n = (() => {
  const MESSAGES = {
    fr: {
      brandDefault: "Prompt Tracker",
      // Badge
      badgeActive: (name, threshold) =>
        `${name} actif : au premier message d'un fil, un prompt sous ${threshold}/100 ouvre le dialogue de réflexion ; ensuite je te laisse la main. Clique pour replier.`,
      badgeWatch: (name) => `${name} actif : interception désactivée, tes prompts sont seulement analysés localement.`,
      badgeBroken: (name) => `${name}. Attention, l'UI du site a peut-être changé, la capture est à vérifier.`,
      badgeStandby: "(veille)",
      // Toast
      toastTitle: "Miroir socratique",
      toastUseful: "👍 Utile",
      toastPause: "Pas dans ce fil",
      pauseConfirmed: "C'est noté, je te laisse dérouler. On se retrouve à la prochaine conversation.",
      // Miroir d'après (post-réponse)
      postTitle: "Miroir d'après",
      postPlaceholder: "En une phrase, avec tes mots…",
      postReply: "Répondre",
      postSkip: "Pas cette fois",
      postThanks: "Noté. Ta réflexion compte dans ta progression.",
      // Modale
      modalTitle: (name) => `${name} : réfléchissons ensemble`,
      modalSub: (score) =>
        `Prompt retenu avant envoi. Score initial ${score}/100. Réponds autant de fois que tu veux : c'est toi qui décides quand envoyer.`,
      modalPromise: "Une fois la discussion lancée, je ne t'interromprai plus dans ce fil.",
      modalIntention: (plan) => `Ton plan : « ${plan} »`,
      modalSubReentry: (score) =>
        `Trois prompts d'affilée bien en dessous de ton niveau habituel (dernier : ${score}/100). On reprend deux minutes ? Tu peux toujours envoyer tel quel.`,
      modalPause: "Laisse-moi sur ce fil",
      modalAnswerPlaceholder: "Ta réponse… (Entrée pour valider, Shift+Entrée pour un saut de ligne)",
      modalReply: "Répondre",
      modalSkip: "Passer cette question",
      modalSkipped: "(question passée)",
      modalPreviewHead: "Prompt qui sera envoyé : score",
      rubClarte: "Clarté",
      rubContexte: "Contexte",
      rubCritique: "Esprit critique",
      modalRecompile: "recompiler depuis le dialogue",
      modalSend: "🚀 Envoyer au chat (avec ma réflexion)",
      modalSendAnyway: "Envoyer ma demande initiale telle quelle",
      modalCancelTitle: "Annuler (rien ne part, ton texte reste dans la zone de saisie)",
      // Compilation
      compileHeader: "Ma réflexion préalable :",
      // Popup
      popupTagline: "Le garde-fou de ton prompting",
      popupPrompts: "prompts",
      popupAvgScore: "premiers jets",
      popupTrend: "progression 7 j",
      popupMirror: "série de jours",
      popupStreakTitle: (n) => (n >= 2 ? `${n} jours d'affilée de premiers jets au niveau. C'est TA progression, sans coaching.` : "Jours consécutifs où tes premiers jets (avant tout coaching) atteignent le seuil."),
      popupStreakFreeze: (n) => (n === 1 ? "1 gel en réserve : un jour raté ne cassera pas ta série." : `${n} gels en réserve : gagnés par semaine complète réussie.`),
      popupEffThreshold: (base, eff) => (eff > base ? `Seuil effectif : ${eff} (la barre monte avec tes séries réussies)` : ""),
      popupRubrics: "Rubriques (moyenne /25)",
      popupCategories: "Catégories d'usage",
      popupSettings: "Réglages",
      popupThemeLabel: "Thème",
      themeLight: "Clair",
      themeDark: "Sombre",
      themeSystem: "Système",
      popupIntercept: "Interception socratique activée",
      popupThreshold: "Seuil d'interception :",
      popupFullText: "Conserver le texte des prompts (sinon : indicateurs seuls)",
      popupExport: "⬇️ Exporter CSV",
      popupReset: "Effacer les données",
      popupResetConfirm: "Effacer toutes les données locales ?",
      popupEmpty: "Aucun prompt capté pour l'instant. Utilise ChatGPT, Claude, Gemini, Mistral ou Grok, je te suis. 🙂",
      popupHealthBroken: (sites) => `⚠️ Capture peut-être cassée sur : ${sites} (UI modifiée)`,
      authEmail: "Email",
      authPassword: "Mot de passe",
      authLogin: "Se connecter",
      authSignup: "Créer un compte",
      authRequired: "Email et mot de passe requis.",
      authInvalid: "Identifiants invalides.",
      authConfirm: "Compte créé. Confirme ton email puis connecte-toi.",
      authHint: "Sans compte, tout reste local sur cet ordinateur.",
      authNoOrg: "aucune organisation rattachée",
      joinCodePlaceholder: "Code de classe (ex. ABC2345)",
      joinCta: "Rejoindre ma classe",
      joinInvalid: "Code invalide, désactivé ou expiré.",
      joinOtherOrg: "Ton compte est déjà rattaché à une autre organisation.",
      popupConsentLink: "🔒 Mes données partagées",
      // Divulgation à la jonction : rejoindre = partager les indicateurs.
      joinDiscTitle: "Avant de rejoindre",
      joinDiscBody:
        "Rejoindre une classe, c'est partager avec ton organisation : tes scores de qualité, catégories de prompts, nombres de mots, sites utilisés, issues (envoyé, amélioré, annulé) et dates. Jamais aucun texte sans ton accord séparé, catégorie par catégorie, à l'écran suivant. Ton email de compte t'identifie auprès de l'enseignant. Conservation : contenu 90 jours max, indicateurs 12 mois.",
      joinDiscAccept: "Rejoindre et partager ces indicateurs",
      joinDiscCancel: "Annuler",
      popupInertBanner: "Prompt Tracker est en veille : rien n'est enregistré tant que tu n'as pas accepté la divulgation des données.",
      popupInertCta: "Voir et activer",
      popupPrivacyLink: "Politique de confidentialité",
      // Consentement
      consentTitle: (org) => `Tes données partagées avec ${org}`,
      consentSubtitle: "C'est toi qui décides, catégorie par catégorie. Modifiable à tout moment.",
      consentBaseline:
        "Toujours partagé avec ton organisation : scores de qualité, catégories de prompts, nombres de mots, sites utilisés, issues (envoyé, amélioré, annulé) et dates, jamais aucun contenu. C'est ce qui alimente ta courbe de progression.",
      consentBaselineRetention:
        "Conservation : les contenus partagés sont effacés au bout de 90 jours, les indicateurs au bout de 12 mois. Tu peux tout effacer avant, à tout moment.",
      consentLlmNote:
        "Ton organisation a activé les questions sur mesure : si tu acceptes « texte de mes prompts » et « raisonnement socratique », ton prompt et ton dialogue transitent par notre serveur et par Anthropic (fournisseur IA, sans conservation) pour générer la prochaine question. Sinon, les questions viennent de la banque locale.",
      consentNoneRequested: (org) => `${org} ne demande aucun contenu. Rien d'autre que les indicateurs ne quitte ton navigateur.`,
      consentPurpose: (org) => `Pourquoi ${org} le demande`,
      catPromptText: "Le texte de mes prompts",
      catPromptTextDesc: "Ce que tu écris à l'IA, mot pour mot.",
      catDialogue: "Mon raisonnement socratique",
      catDialogueDesc: "Tes réponses aux questions du dialogue : ta réflexion avant l'envoi.",
      catPostReflection: "Mes réflexions d'après",
      catPostReflectionDesc: "Tes reformulations et vérifications après les réponses de l'IA.",
      catConversation: "Le fil de mes conversations",
      catConversationDesc: "Le regroupement de tes prompts par conversation (jamais le contenu des réponses de l'IA).",
      consentSave: "Valider mes choix",
      consentSaved: "Choix enregistrés ✓",
      consentDangerTitle: "Droit à l'effacement",
      consentPurge: "Effacer le contenu déjà partagé",
      consentPurgeConfirm: "Effacer définitivement le contenu déjà partagé (textes, raisonnements, fils de conversation) ? Tes indicateurs et scores restent.",
      consentPurgeDone: (n) => `Contenu effacé (${n} éléments). Tes indicateurs sont conservés.`,
      consentNotConnected: "Connecte-toi d'abord dans le popup de l'extension, puis reviens ici.",
      authConnected: "connecté",
      authPending: (n) => `${n} événement(s) en attente de synchronisation`,
      authSynced: "Tout est synchronisé ✓",
      authDashboard: "📊 Ouvrir le dashboard",
      authLogout: "Déconnexion",
      // Onboarding
      obTitle: "Bienvenue dans Prompt Tracker",
      obSubtitle: "Le garde-fou de ton prompting : un peu de friction, beaucoup de réflexion.",
      obPitch:
        "Comme les applications qui t'aident à décrocher de ton téléphone, Prompt Tracker ajoute une pause réfléchie avant tes prompts IA. Quand ta demande est trop vague, elle est retenue avant l'envoi et un dialogue socratique t'aide à penser par toi-même. Puis c'est toujours toi qui décides d'envoyer.",
      obHow: "Comment ça marche",
      obStep1: "Écris ton prompt sur ChatGPT, Claude, Gemini, Mistral ou Grok, comme d'habitude.",
      obStep2: "Sous le seuil de qualité, l'envoi est retenu : questions socratiques, une par une, aussi longtemps que tu veux.",
      obStep3: "Envoie ta version enrichie de ta réflexion, ou ta demande initiale telle quelle. Toujours ton choix.",
      // Divulgation bien visible (Chrome Web Store) : données, finalité,
      // destination, conservation. L'extension reste inerte avant l'accord.
      obDiscTitle: "Tes données : ce que l'extension enregistre, et pourquoi",
      obDiscCollectTitle: "Ce qui est enregistré",
      obDiscCollect:
        "Sur ChatGPT, Claude, Gemini, Mistral et Grok, l'extension enregistre pour chaque prompt : des scores de qualité, la catégorie, le nombre de mots, le site, la date, l'issue (envoyé, amélioré, annulé), tes réponses au dialogue socratique et tes réflexions d'après-réponse. Le texte complet de tes prompts n'est enregistré que si tu actives l'option dédiée dans les réglages.",
      obDiscPurposeTitle: "Pourquoi",
      obDiscPurpose:
        "Uniquement pour te montrer ta progression (miroir socratique, premiers jets, séries) et, si tu choisis de rejoindre une classe, la partager avec ton enseignant.",
      obDiscWhereTitle: "Où ça va",
      obDiscWhere:
        "Tout reste sur cet ordinateur. Un envoi vers un serveur suppose deux choix de ta part : créer un compte, puis rejoindre une organisation. À ce moment-là, un second écran te demandera ton accord explicite avant tout partage.",
      obDiscRetentionTitle: "Conservation et droits",
      obDiscRetention:
        "Données locales : supprimables à tout moment depuis le popup (« Effacer les données »). Données partagées avec une organisation : contenu conservé 90 jours maximum, indicateurs 12 mois, effaçables à tout moment.",
      obDiscPolicyLink: "Politique de confidentialité",
      obAccept: "J'accepte et j'active Prompt Tracker",
      obAccepted: "Activé ✓",
      obLater: "Plus tard (l'extension reste inactive)",
      obThemeTitle: "Ton thème",
      obThresholdTitle: "Niveau de friction",
      obThresholdHint: "Les prompts sous ce score déclenchent le dialogue. 40 est un bon départ.",
      obProfileTitle: "Ton usage principal",
      obProfileHint: "Les questions parleront ta langue : devoir, livrable ou dossier.",
      obIntentionTitle: "Ton plan quand ça devient vague",
      obIntentionHint:
        "Formuler un plan « si…, alors… » double presque les chances de s'y tenir (Gollwitzer). Il sera rappelé dans le dialogue les premières semaines, puis s'effacera.",
      obIntentionDefault: "Si mon prompt est vague, alors je précise mon intention et mon contexte avant d'envoyer.",
      profileStudent: "Étudiant",
      profileConsultant: "Consultant / freelance",
      profileEmployee: "Salarié",
      profileOther: "Autre",
      obSites: "Fonctionne sur ChatGPT, Claude, Gemini, Mistral (Le Chat) et Grok.",
      obTry: "Essaye maintenant : ouvre ChatGPT et tape « fais mes devoirs ».",
    },
    en: {
      brandDefault: "Prompt Tracker",
      badgeActive: (name, threshold) =>
        `${name} active: on the first message of a thread, a prompt under ${threshold}/100 opens the reflection dialogue; after that, you're in charge. Click to collapse.`,
      badgeWatch: (name) => `${name} active: interception off, your prompts are only analyzed locally.`,
      badgeBroken: (name) => `${name}. Warning, the site UI may have changed, capture needs checking.`,
      badgeStandby: "(standby)",
      toastTitle: "Socratic mirror",
      toastUseful: "👍 Helpful",
      toastPause: "Not in this thread",
      pauseConfirmed: "Got it, I'll let you roll. See you in the next conversation.",
      postTitle: "Second look",
      postPlaceholder: "One sentence, in your own words…",
      postReply: "Answer",
      postSkip: "Not this time",
      postThanks: "Noted. Your reflection counts toward your progress.",
      modalTitle: (name) => `${name}: let's think this through`,
      modalSub: (score) =>
        `Prompt held before sending. Initial score ${score}/100. Answer as many times as you like: you decide when to send.`,
      modalPromise: "Once the discussion is launched, I won't interrupt you again in this thread.",
      modalIntention: (plan) => `Your plan: "${plan}"`,
      modalSubReentry: (score) =>
        `Three prompts in a row well below your usual level (latest: ${score}/100). Two minutes to regroup? You can always send as is.`,
      modalPause: "Leave me alone on this thread",
      modalAnswerPlaceholder: "Your answer… (Enter to submit, Shift+Enter for a new line)",
      modalReply: "Answer",
      modalSkip: "Skip this question",
      modalSkipped: "(question skipped)",
      modalPreviewHead: "Prompt that will be sent: score",
      rubClarte: "Clarity",
      rubContexte: "Context",
      rubCritique: "Critical eye",
      modalRecompile: "recompile from the dialogue",
      modalSend: "🚀 Send to chat (with my reasoning)",
      modalSendAnyway: "Send my original request as is",
      modalCancelTitle: "Cancel (nothing is sent, your text stays in the input box)",
      compileHeader: "My prior reasoning:",
      popupTagline: "The guardrail for your prompting",
      popupPrompts: "prompts",
      popupAvgScore: "first drafts",
      popupTrend: "7-day trend",
      popupMirror: "day streak",
      popupStreakTitle: (n) => (n >= 2 ? `${n} days in a row of first drafts at level. That's YOUR progress, no coaching.` : "Consecutive days where your first drafts (before any coaching) reach the threshold."),
      popupStreakFreeze: (n) => (n === 1 ? "1 freeze banked: one missed day won't break your streak." : `${n} freezes banked: earned with every full successful week.`),
      popupEffThreshold: (base, eff) => (eff > base ? `Effective threshold: ${eff} (the bar rises with your streaks)` : ""),
      popupRubrics: "Rubrics (average /25)",
      popupCategories: "Usage categories",
      popupSettings: "Settings",
      popupThemeLabel: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "System",
      popupIntercept: "Socratic interception enabled",
      popupThreshold: "Interception threshold:",
      popupFullText: "Keep prompt text (otherwise: indicators only)",
      popupExport: "⬇️ Export CSV",
      popupReset: "Clear data",
      popupResetConfirm: "Clear all local data?",
      popupEmpty: "No prompts captured yet. Use ChatGPT, Claude, Gemini, Mistral or Grok, I've got you. 🙂",
      popupHealthBroken: (sites) => `⚠️ Capture may be broken on: ${sites} (UI changed)`,
      authEmail: "Email",
      authPassword: "Password",
      authLogin: "Sign in",
      authSignup: "Create account",
      authRequired: "Email and password required.",
      authInvalid: "Invalid credentials.",
      authConfirm: "Account created. Confirm your email, then sign in.",
      authHint: "Without an account, everything stays local on this computer.",
      authNoOrg: "no organization attached",
      joinCodePlaceholder: "Class code (e.g. ABC2345)",
      joinCta: "Join my class",
      joinInvalid: "Invalid, disabled or expired code.",
      joinOtherOrg: "Your account already belongs to another organization.",
      popupConsentLink: "🔒 My shared data",
      joinDiscTitle: "Before you join",
      joinDiscBody:
        "Joining a class means sharing with your organization: your quality scores, prompt categories, word counts, sites used, outcomes (sent, improved, cancelled) and dates. Never any text without your separate, category-by-category consent on the next screen. Your account email identifies you to the teacher. Retention: content 90 days max, indicators 12 months.",
      joinDiscAccept: "Join and share these indicators",
      joinDiscCancel: "Cancel",
      popupInertBanner: "Prompt Tracker is on standby: nothing is recorded until you accept the data disclosure.",
      popupInertCta: "Review and enable",
      popupPrivacyLink: "Privacy policy",
      consentTitle: (org) => `Your data shared with ${org}`,
      consentSubtitle: "You decide, category by category. Changeable at any time.",
      consentBaseline:
        "Always shared with your organization: quality scores, prompt categories, word counts, sites used, outcomes (sent, improved, cancelled) and dates, never any content. This is what feeds your progress curve.",
      consentBaselineRetention:
        "Retention: shared content is erased after 90 days, indicators after 12 months. You can erase everything sooner, at any time.",
      consentLlmNote:
        "Your organization enabled tailored questions: if you accept \"the text of my prompts\" and \"my Socratic reasoning\", your prompt and dialogue transit through our server and Anthropic (AI provider, no retention) to generate the next question. Otherwise, questions come from the local bank.",
      consentNoneRequested: (org) => `${org} requests no content. Nothing but indicators ever leaves your browser.`,
      consentPurpose: (org) => `Why ${org} asks for it`,
      catPromptText: "The text of my prompts",
      catPromptTextDesc: "What you write to the AI, word for word.",
      catDialogue: "My Socratic reasoning",
      catDialogueDesc: "Your answers to the dialogue questions: your thinking before sending.",
      catPostReflection: "My afterthoughts",
      catPostReflectionDesc: "Your restatements and verifications after the AI's answers.",
      catConversation: "My conversation threads",
      catConversationDesc: "The grouping of your prompts by conversation (never the AI's answers).",
      consentSave: "Confirm my choices",
      consentSaved: "Choices saved ✓",
      consentDangerTitle: "Right to erasure",
      consentPurge: "Erase already shared content",
      consentPurgeConfirm: "Permanently erase already shared content (texts, reasoning, conversation threads)? Your indicators and scores remain.",
      consentPurgeDone: (n) => `Content erased (${n} items). Your indicators are kept.`,
      consentNotConnected: "Sign in from the extension popup first, then come back here.",
      authConnected: "signed in",
      authPending: (n) => `${n} event(s) awaiting sync`,
      authSynced: "Everything is synced ✓",
      authDashboard: "📊 Open dashboard",
      authLogout: "Sign out",
      obTitle: "Welcome to Prompt Tracker",
      obSubtitle: "The guardrail for your prompting: a little friction, a lot of thinking.",
      obPitch:
        "Like the apps that help you unglue from your phone, Prompt Tracker adds a thoughtful pause before your AI prompts. When your request is too vague, it is held before sending and a Socratic dialogue helps you think for yourself. Then you always decide when to send.",
      obHow: "How it works",
      obStep1: "Write your prompt on ChatGPT, Claude, Gemini, Mistral or Grok, as usual.",
      obStep2: "Below the quality threshold, sending is held: Socratic questions, one at a time, for as long as you want.",
      obStep3: "Send your version enriched with your reasoning, or your original request as is. Always your call.",
      obDiscTitle: "Your data: what the extension records, and why",
      obDiscCollectTitle: "What is recorded",
      obDiscCollect:
        "On ChatGPT, Claude, Gemini, Mistral and Grok, the extension records for each prompt: quality scores, the category, the word count, the site, the date, the outcome (sent, improved, cancelled), your answers to the Socratic dialogue and your post-response reflections. The full text of your prompts is only recorded if you enable the dedicated setting.",
      obDiscPurposeTitle: "Why",
      obDiscPurpose:
        "Solely to show you your progress (Socratic mirror, first drafts, streaks) and, if you choose to join a class, to share it with your teacher.",
      obDiscWhereTitle: "Where it goes",
      obDiscWhere:
        "Everything stays on this computer. Sending anything to a server takes two choices on your part: creating an account, then joining an organization. At that point, a second screen will ask for your explicit consent before any sharing.",
      obDiscRetentionTitle: "Retention and rights",
      obDiscRetention:
        "Local data: deletable at any time from the popup (\"Clear data\"). Data shared with an organization: content kept 90 days maximum, indicators 12 months, erasable at any time.",
      obDiscPolicyLink: "Privacy policy",
      obAccept: "I accept and turn on Prompt Tracker",
      obAccepted: "Enabled ✓",
      obLater: "Later (the extension stays off)",
      obThemeTitle: "Your theme",
      obThresholdTitle: "Friction level",
      obThresholdHint: "Prompts under this score trigger the dialogue. 40 is a good start.",
      obProfileTitle: "Your main use",
      obProfileHint: "Questions will speak your language: assignment, deliverable or file.",
      obIntentionTitle: "Your plan for when it gets vague",
      obIntentionHint:
        "Writing an \"if…, then…\" plan nearly doubles follow-through (Gollwitzer). It will be shown in the dialogue for the first few weeks, then fade away.",
      obIntentionDefault: "If my prompt is vague, then I state my intent and context before sending.",
      profileStudent: "Student",
      profileConsultant: "Consultant / freelancer",
      profileEmployee: "Employee",
      profileOther: "Other",
      obSites: "Works on ChatGPT, Claude, Gemini, Mistral (Le Chat) and Grok.",
      obTry: "Try it now: open ChatGPT and type \"do my homework\".",
    },
  };

  function detectLang() {
    try {
      const ui =
        (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) ||
        navigator.language ||
        "fr";
      return ui.toLowerCase().startsWith("fr") ? "fr" : "en";
    } catch {
      return "fr";
    }
  }

  const lang = detectLang();

  function t(key, ...args) {
    const entry = (MESSAGES[lang] && MESSAGES[lang][key]) || MESSAGES.fr[key];
    return typeof entry === "function" ? entry(...args) : entry;
  }

  return { t, lang };
})();

if (typeof self !== "undefined") self.CoachI18n = CoachI18n;
